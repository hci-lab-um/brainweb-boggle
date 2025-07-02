const math = require('mathjs');
const { EigenvalueDecomposition } = require('ml-matrix');

// Helper functions that are all used within the filterbank.js

// Used to reverse an array
function reverseArray(arr) {
    return arr.slice().reverse();
}

// Inverse hyperbolic cosine
function acosh(x) {
    return Math.log(x + Math.sqrt(x * x - 1));
}

function filter(B, A, x) {
    // Get the number of coefficients
    let M = B.length - 1; // Length of numerator coefficients
    let N = A.length - 1; // Length of denominator coefficients

    // Initialize output array
    let y = new Array(x.length).fill(0);

    // Normalize coefficients by A[0] (if A[0] != 1)
    if (A[0] !== 1) {
        for (let i = 0; i <= M; i++) B[i] /= A[0];
        for (let i = 1; i <= N; i++) A[i] /= A[0];
    }

    // Apply the difference equation for each sample of the input signal
    for (let n = 0; n < x.length; n++) {
        y[n] = 0; // Initialize current output to zero

        // Calculate the feedforward part (using input x[n])
        for (let i = 0; i <= M; i++) {
            if (n - i >= 0) {
                // for (let j = 0; j < x.length; j++) {
                y[n] += B[i] * x[n - i]; // Sum B[i] * x[n-i]
                // }
            }
        }

        // Calculate the feedback part (using previous outputs y[n-i])
        for (let j = 1; j <= N; j++) {
            if (n - j >= 0) {
                y[n] -= A[j] * y[n - j]; // Subtract A[j] * y[n-j]
            }
        }
    }

    return y;
}

// Manual filtfilt implementation
function filtfilt(B, A, x) {
    // Step 1: Apply the filter in the forward direction
    let yForward = filter(B, A, x);

    // Step 2: Reverse the forward filtered result
    let yReversed = reverseArray(yForward);

    // Step 3: Apply the filter again (backward pass) to the reversed signal
    let yBackward = filter(B, A, yReversed);

    // Step 4: Reverse the backward filtered result to get the final output
    let yFinal = reverseArray(yBackward);

    return yFinal;
}

function findMinOrder(wp, ws, rp, rs, opt) {
    // Check frequencies
    const freqCheckResult = freqCheck(wp, ws, opt);
    if (freqCheckResult.error) {
        throw new Error(freqCheckResult.message);
    }

    // Determine filter type
    let ftype = 2 * (wp.length - 1);
    if (wp[0] < ws[0]) {
        ftype += 1; // Low (1) or Reject (3)
    } else {
        ftype += 2; // High (2) or Pass (4)
    }

    // Prewarp frequencies from digital to analog
    let WPA, WSA;
    if (opt === 'z') {  // Digital
        WPA = wp.map(w => Math.tan(Math.PI * w / 2));
        WSA = ws.map(w => Math.tan(Math.PI * w / 2));
    } else { // Analog
        WPA = wp;
        WSA = ws;
    }

    let WA;

    // Transform to low pass prototype
    if (ftype === 1) { // Low
        WA = WSA[0] / WPA[0];
    } else if (ftype === 2) { // High
        WA = WPA[0] / WSA[0];
    } else if (ftype === 3) { // Stop
        WA = Math.min(
            (WSA[0] * (WPA[0] - WPA[1])) / (WSA[0] ** 2 - WPA[0] * WPA[1]),
            (WSA[1] * (WPA[1] - WPA[0])) / (WSA[1] ** 2 - WPA[1] * WPA[0])
        );
    } else if (ftype === 4) { // Pass
        WA = Math.min(
            (WSA[0] ** 2 - WPA[0] * WPA[1]) / (WSA[0] * (WPA[0] - WPA[1])),
            (WSA[1] ** 2 - WPA[1] * WPA[0]) / (WSA[1] * (WPA[1] - WPA[0]))
        );
    }

    // Find the minimum order of Chebyshev filter
    WA = Math.abs(WA);
    const ep = Math.sqrt(Math.pow(10, 0.1 * rp) - 1);
    const A = Math.pow(10, 0.05 * rs);
    const g = Math.sqrt((A * A - 1) / (ep * ep));

    const order = Math.ceil(acosh(g) / acosh(WA));
    return order;
}

// Function to check frequency whether frequency is valid
function freqCheck(wp, ws, opt) {
    let errmsg = '';
    let msgobj = null;

    // Check for correct lengths
    if (wp.length !== ws.length) {
        msgobj = 'Mismatched frequency lengths';
        errmsg = msgobj;
        return { error: true, message: errmsg };
    }

    // Check for allowed interval values
    if (opt === 'z') { // Digital filter
        if (wp.some(w => w <= 0 || w >= 1) || ws.some(w => w <= 0 || w >= 1)) {
            msgobj = 'Cutoff frequencies must be in (0, 1)';
            errmsg = msgobj;
            return { error: true, message: errmsg };
        }
    } else { // Analog filter design
        if (wp.some(w => w <= 0) || ws.some(w => w <= 0)) {
            msgobj = 'Cutoff frequencies must be non-negative';
            errmsg = msgobj;
            return { error: true, message: errmsg };
        }
    }

    // For band specifications
    if (wp.length === 2) {
        // Check for frequencies to be in increasing order
        if (wp[0] >= wp[1] || ws[0] >= ws[1]) {
            msgobj = 'Cutoff frequencies must be in increasing order';
            errmsg = msgobj;
            return { error: true, message: errmsg };
        }

        // Check for passband and stopband frequency overlaps
        if (!(((wp[0] < ws[0]) && (wp[1] > ws[1])) ||
            ((wp[0] > ws[0]) && (wp[1] < ws[1])))) {
            msgobj = 'Passband and stopband cannot overlap';
            errmsg = msgobj;
            return { error: true, message: errmsg };
        }
    }

    return { error: false };
}

// Decimation (integer factor)
function decimate(signal, factor) {
    return signal.filter((_, index) => index % factor === 0);
}

// Resampling function (linear interpolation)
function resample(eeg, originalFs, targetFs = 256) {
    const originalLength = eeg.length;
    const targetLength = Math.round(originalLength * targetFs / originalFs);
    const result = new Array(targetLength);
    const scale = (originalLength - 1) / (targetLength - 1);

    for (let i = 0; i < targetLength; i++) {
        const rawIndex = i * scale;
        const lowerIndex = Math.floor(rawIndex);
        const upperIndex = Math.min(lowerIndex + 1, originalLength - 1);
        const weight = rawIndex - lowerIndex;
        result[i] = eeg[lowerIndex] * (1 - weight) + eeg[upperIndex] * weight;
    }

    return result;
}

function cheb1ord(wp, ws, rp, rs, opt = 'z') {
    // Validate input
    if (typeof wp === 'undefined' || typeof ws === 'undefined' || typeof rp === 'undefined' || typeof rs === 'undefined') {
        throw new Error('All input arguments must be provided');
    }
    if (opt !== 'z' && opt !== 's') {
        throw new Error('Invalid option. Use "z" for digital or "s" for analog.');
    }

    // Ensure wp and ws are arrays for bandpass or bandstop filters
    if (!Array.isArray(wp)) wp = [wp];
    if (!Array.isArray(ws)) ws = [ws];

    // Find minimum order
    let order = findMinOrder(wp, ws, rp, rs, opt);

    // Determine the natural frequencies
    let wn;
    if (opt === 'z') { // digital
        wn = wp;
    } else { // analog
        wn = wp;
    }

    return { order, wn };
}

function cheby1(n, Rp, Wp, varargin) {
    if (arguments.length < 3 || arguments.length > 6) {
        throw new Error('Incorrect number of input arguments');
    }

    // Validate inputs
    if (!Number.isInteger(n) || n <= 0 || n > 500) {
        throw new Error('N must be a positive integer less than or equal to 500');
    }

    if (typeof Rp !== 'number' || Rp < 0) {
        throw new Error('Rp must be a non-negative number');
    }

    // Step 1: Get analog, pre-warped frequencies
    let analog = false;  // Assuming digital by default
    let btype = 1;  // Default to lowpass
    if (typeof Wp === 'object' && Wp.length === 2) {
        btype = 2;  // Bandpass
    } else if (typeof Wp === 'number' && Wp > 0) {
        // Wp is single frequency
    } else {
        throw new Error('Invalid passband edge frequency Wp');
    }

    let fs = 2;  // Assuming a normalized frequency
    let u;

    if (!analog) {
        if (Array.isArray(Wp)) {
            // Wp is an array, so process each element
            u = Wp.map(freq => 2 * fs * Math.tan(Math.PI * freq / fs));
        } else {
            // Wp is a single value
            u = 2 * fs * Math.tan(Math.PI * Wp / fs);
        }
    } else {
        u = Wp;  // Use Wp directly if analog
    }

    let Bw;
    // Step 2: Convert to low-pass prototype estimate
    if (btype === 1) {  // Lowpass
        Wp = u;

    } else if (btype === 2) {  // Bandpass
        Bw = u[1] - u[0];
        Wp = Math.sqrt(u[0] * u[1]);
    }

    // Step 3: Get N-th order Chebyshev type-I lowpass analog prototype
    let { z, p, k } = cheb1ap(n, Rp);

    // Transform to state-space
    let { a, b, c, d } = zp2ss(z, p, k);

    // Step 4: Transform to lowpass, bandpass, highpass, or bandstop of desired Wn
    if (btype === 1) {
        throw new Error("btype is 1");
    } else if (btype === 2) {
        ({ a, b, c, d } = lp2bp(a, b, c, d, Wp, Bw));
    }

    // Step 5: Use Bilinear transformation to find discrete equivalent:
    if (!analog) {
        ({ a, b, c, d } = bilinear(a, b, c, d, fs));
    }

    // Transform to zero-pole-gain and polynomial forms
    let p_temp = new EigenvalueDecomposition(a._data);
    p = [];
    for (let i = 0; i < p_temp.d.length; i++) {
        p.push(math.complex(p_temp.d[i], p_temp.e[i]));
    }

    let result = cheb1zeros(btype, n, Wp, analog, p, Rp);
    z = result.z;
    k = result.k;

    let den = poly(p); // Polynomial coefficients (denominator)

    let num = new Array(p.length - z.length).fill(0).concat(math.multiply(k, poly(z).map(x => math.re(x))));

    return { den, num }
}

function poly(roots) {
    let poly = [math.complex(1, 0)]; // Start with the constant polynomial "1"

    for (let i = 0; i < roots.length; i++) {
        const root = roots[i];

        // If the root is real, use the linear factor (x - root)
        if (math.im(root) === 0) {
            const linearFactor = [math.complex(1, 0), math.complex(-root, 0)];
            poly = multiplyPolynomials(poly, linearFactor);
        }
        // For complex roots, ensure you're treating conjugate pairs
        else {
            const quadratic = complexConjugateQuadratic(root);
            poly = multiplyPolynomials(poly, quadratic);
            i++; // Skip the next root since it's the conjugate
        }
    }

    // Extract real parts of the coefficients
    return poly.map(c => math.re(c));
}

// Function to generate a quadratic polynomial from a complex conjugate pair
function complexConjugateQuadratic(c) {
    // (x - c)(x - conj(c)) = x^2 - 2*Re(c)*x + (Re(c)^2 + Im(c)^2)
    const realPart = math.re(c);
    const imPart = math.im(c);

    const a = math.complex(1, 0);  // x^2 coefficient
    const b = math.complex(-2 * realPart, 0);  // -2 * Re(c)
    const c2 = math.complex(realPart * realPart + imPart * imPart, 0);  // Re(c)^2 + Im(c)^2

    return [a, b, c2]; // Quadratic: ax^2 + bx + c
}

// Multiply two polynomials (arrays of complex numbers)
function multiplyPolynomials(p1, p2) {
    const result = new Array(p1.length + p2.length - 1).fill(math.complex(0, 0));

    for (let i = 0; i < p1.length; i++) {
        for (let j = 0; j < p2.length; j++) {
            result[i + j] = math.add(result[i + j], math.multiply(p1[i], p2[j]));
        }
    }

    return result;
}

function cheb1zeros(btype, n, Wn, analog, p, Rp) {
    let z, k;
    let g = (n % 2 === 0) ? Math.pow(10, -Rp / 20) : 1; // Handle even/odd gain calculation

    if (analog) {
        switch (btype) {
            case 1: // Lowpass: H(0) = g
                z = [];  // Empty array for zeros
                k = g * math.re(math.prod(math.unaryMinus(p)));  // Gain calculation with real part of product of poles
                break;
            case 2: // Bandpass: H(1i*Wn) = 1
                z = new Array(n).fill(0);  // Zeros for bandpass
                k = g * math.re(math.prod(math.add(math.multiply(math.complex(0, Wn), 1), math.unaryMinus(p))) / math.pow(math.complex(0, Wn), n));  // Complex product and division
                break;
            case 3: // Highpass: H(inf) = g
                z = new Array(n).fill(0);  // Zeros for highpass
                k = g;  // Gain is directly g
                break;
            default: // Bandstop: H(0) = g
                z = math.multiply(math.complex(0, Wn), math.pow(-1, math.range(0, 2 * n, true).toArray()));  // Complex calculation for bandstop
                k = g;
        }
    } else {
        Wn = 2 * Math.atan2(Wn, 4);  // Adjust Wn for digital case
        switch (btype) {
            case 1: // Lowpass: H(1) = g
                z = new Array(n).fill(-1);  // Zeros for lowpass
                k = g * (math.re(math.prod(math.unaryMinus(p))) / Math.pow(2, n));  // Gain calculation with real part
                break;
            case 2: // Bandpass: H(z) = g for z=exp(1i*sqrt(Wn(1)*Wn(2)))
                z = new Array(n).fill(1).concat(new Array(n).fill(-1));  // Zeros for bandpass
                let zWn = math.exp(math.multiply(math.complex(0, Wn), 1));  // Complex exponential of Wn
                k = g * (math.re(math.prod(math.add(zWn, math.unaryMinus(p)))) / math.re(math.prod(math.add(zWn, math.unaryMinus(z)))));  // Gain calculation using product of poles and zeros
                break;
            case 3: // Highpass: H(-1) = g
                z = new Array(n).fill(1);  // Zeros for highpass
                k = g * (math.re(math.prod(math.add(1, p))) / Math.pow(2, n));  // Gain calculation
                break;
            default: // Bandstop: H(1) = g
                z = math.exp(math.multiply(math.complex(0, Wn), math.range(0, 2 * n).map((v) => Math.pow(-1, v)).toArray()));  // Complex exponential for bandstop
                k = g * (math.re(math.prod(math.add(1, p))) / math.re(math.prod(math.add(1, z))));  // Gain calculation for bandstop
        }
    }

    return { z, k };  // Return zeros and gain
}

// Bilinear transformation function
function bilinear(z, p, k, fs, fp = 2, fp1 = null) {
    // Validate arguments
    if (arguments.length < 3 || arguments.length > 6) {
        throw new Error("Invalid number of arguments");
    }

    let zSize = math.size(z); // returns an array [rows, columns]
    let pSize = math.size(p); // returns an array [rows, columns]
    let mn = zSize.get([0]);  // Number of rows in z
    let nn = zSize.get([1]);  // Number of columns in z
    let md = pSize.get([0]);  // Number of rows in p
    let nd = pSize.get([1]);  // Number of columns in p

    // Determine the input type (Zero-Pole-Gain, State-Space, or Transfer Function)
    let isZeroPoleGain = (nd === 1 && nn < 2) && false; // false: ouput arguments != 4 
    let isStateSpace = true;                            // true: ouput arguments == 4
    let isTransferFunction = (mn === 1 && md === 1);

    let sampleFreq = fp;  // Default sampling frequency

    if (isZeroPoleGain) {
        throw new Error("Zero-Pole-Gain form is not implemented");
    } else if (isStateSpace) {
        // State-Space form (A, B, C, D matrices)
        let A = z;
        let B = p;
        let C = k;
        let D = fs;

        // Pre-warp frequency if fp1 is provided
        if (fp1) {
            let preWarp = Math.PI * fp1 / Math.tan(Math.PI * fp1 / sampleFreq);
            sampleFreq = preWarp;
        }

        // Bilinear transformation for state-space matrices
        let t = 1 / sampleFreq;

        let identityMatrix = math.identity(math.size(A));
        // Calculate t1 
        let t1 = math.add(identityMatrix, math.multiply(A, t / 2));
        // Calculate t2
        let t2 = math.subtract(identityMatrix, math.multiply(A, t / 2));

        let Ad = math.multiply(math.inv(t2), t1);
        let Bd = math.multiply(t / Math.sqrt(t), math.multiply(math.inv(t2), B));
        let Cd = math.multiply(Math.sqrt(t), math.multiply(C, math.inv(t2)));

        let t2Inv = math.inv(t2);  // Invert t2 since matrix division in MATLAB means multiplication by inverse
        // Matrix multiplication: cs * inv(t2) * bs * t / 2
        let ddPart1 = math.multiply(C, t2Inv);      // cs * inv(t2)
        ddPart1 = math.multiply(ddPart1, B);        // (cs * inv(t2)) * bs
        ddPart1 = math.multiply(ddPart1, t / 2);     // ((cs * inv(t2)) * bs) * (t / 2)
        let Dd = math.add(ddPart1, D);

        return { a: Ad, b: Bd, c: Cd, d: Dd };
    } else if (isTransferFunction) {
        throw new Error("Transfer Function form is not implemented");
    } else {
        throw new Error("Invalid input format");
    }
}

function zp2ctf(z, p, k, sectionOrder) {
    // This function needs to be implemented 
    let num = []; // Calculated numerator coefficients
    let den = []; // Calculated denominator coefficients
    return { num, den };
}

// Helper function to convert lowpass to lowpass
function lp2lp(a, b, c, d, Wp) {
    // (This function needs to be implemented)
}

// Function to convert a low-pass filter to a band-pass filter
function lp2bp(a, b, c, d, wo, bw) {
    // Check if input arguments are valid (length 4 is not allowed)
    if (arguments.length === 4) {
        throw new Error("Invalid number of arguments: Length 4 is not allowed.");
    }

    // Define variables
    let w1 = wo;   // Center frequency
    let bw1 = bw;  // Bandwidth

    // Cast inputs to ensure proper precision
    let as = a;
    let bs = b;
    let cs = c;
    let ds = d;

    // Get dimensions
    let nb = bs._size[1]; // Number of columns in B
    let mc = cs._size[0]; // Number of rows in C
    let ma = as._size[0]; // Number of rows in A

    // Transform lowpass to bandpass
    let q = w1 / bw1;

    // Create the new state-space matrices
    let at = math.matrix(new Array(ma * 2).fill(0).map(() => new Array(ma * 2).fill(0)), 'dense');

    // Step 1: Fill the upper-left block with as/q
    for (let i = 0; i < ma; i++) {
        for (let j = 0; j < ma; j++) {
            at._data[i][j] = w1 * as._data[i][j] / q;
        }
    }

    // Step 2: Fill the upper-right block with the identity matrix (eye(ma))
    // This fills the correct rows for the identity matrix part
    for (let i = 0; i < ma; i++) {
        at._data[i][i + ma] = w1; // Set the diagonal element for identity matrix in the same row
    }

    // Step 3: Fill the lower-left block with -identity matrix (-eye(ma))
    // This also fills the correct rows for the negative identity matrix part
    for (let i = 0; i < ma; i++) {
        at._data[i + ma][i] = -w1; // Set the diagonal element for negative identity matrix
    }

    // Divide bs by q
    let bsDivided = math.divide(bs, q);
    // Create a zeros matrix of size ma x nb
    let zerosMatrix = math.zeros(ma, nb);
    // Concatenate bs/q with zeros matrix vertically
    let concatenatedMatrix = math.concat(bsDivided, zerosMatrix, 0); // 0 for row-wise (vertical) concatenation
    // Perform matrix multiplication
    let bt = math.multiply(w1, concatenatedMatrix);

    // Create a new zeros matrix of size mc x ma
    zerosMatrix = math.zeros(mc, ma);
    // Concatenate cs and zerosMatrix horizontally
    let cd = math.concat(cs, zerosMatrix, 1); // 1 for column-wise (horizontal) concatenation

    let dd = ds;

    let ad = at;
    let bd = bt;

    return { a: ad, b: bd, c: cd, d: dd };
}

// Helper function to get N-th order Chebyshev type-I lowpass analog prototype
function cheb1ap(n, rp) {
    // Validate inputs
    if (!Number.isInteger(n) || n <= 0) {
        throw new Error('N must be a positive integer.');
    }

    if (typeof rp !== 'number' || rp < 0) {
        throw new Error('Rp must be a non-negative number.');
    }

    const epsilon = Math.sqrt(Math.pow(10, 0.1 * rp) - 1);
    const mu = Math.asinh(1 / epsilon) / n;

    // Compute poles
    let poles = [];
    for (let k = 1; k <= 2 * n - 1; k += 2) {
        let angle = Math.PI * k / (2 * n) + Math.PI / 2;
        poles.push(math.complex(Math.sinh(mu) * Math.cos(angle), Math.cosh(mu) * Math.sin(angle)));
    }

    // Symmetrize poles to ensure numerical stability
    let realp = poles.map(p => math.re(p));
    realp = realp.map((value, index) => (value + realp[realp.length - 1 - index]) / 2);
    let imagp = poles.map(p => math.im(p));
    imagp = imagp.map((value, index) => (value - imagp[imagp.length - 1 - index]) / 2);
    poles = realp.map((re, index) => math.complex(re, imagp[index]));

    const z = []; // No zeros for Chebyshev Type I lowpass filter

    // Compute the gain k using direct calculation of the real part of the complex number
    let realPart = 1;
    let imagPart = 0;

    poles.forEach(p => {
        const currentReal = math.re(p);
        const currentImag = math.im(p);
        const tempRealPart = realPart * currentReal - imagPart * currentImag; // Temp real part
        imagPart = realPart * currentImag + imagPart * currentReal; // Update imaginary part
        realPart = tempRealPart; // Update real part
    });

    let k = Math.abs(realPart);

    // Adjust k if n is even
    if (n % 2 === 0) {
        k /= Math.sqrt(1 + Math.pow(epsilon, 2));
    }

    k = [parseFloat(k)];
    poles = poles.map(p => {
        const realPart = parseFloat(math.re(p));
        const imagPart = parseFloat(math.im(p));
        return math.complex(realPart, imagPart);
    });

    return { z, p: poles, k };
}

// Helper function to transform zero-pole-gain to state-space
function zp2ss(z, p, k) {
    function parseInput(z, p, k) {
        if (!Array.isArray(z) || !Array.isArray(p) || !Array.isArray(k)) {
            throw new Error("Inputs must be arrays");
        }
        let pCol = Array.isArray(p[0]) ? p.flat() : p;
        let kCol = Array.isArray(k[0]) ? k.flat() : k;
        let zCol = Array.isArray(z[0]) ? z : z.map(el => [el]);

        let isSIMO = kCol.length > 1;
        return { zCol, pCol, kCol, isSIMO };
    }

    function cplxPair(arr, tol = 1e-12) {
        // Helper function to compare complex numbers for pairing
        function isConjugatePair(num1, num2, tol) {
            return Math.abs(num1.re - num2.re) <= tol * Math.abs(num1.re) &&
                Math.abs(num1.im + num2.im) <= tol * Math.abs(num1.im);
        }

        // Separate real and imaginary parts
        let realParts = arr.map(num => num.re);
        let imagParts = arr.map(num => num.im);

        // Create array of complex numbers
        let complexNumbers = arr.map((num, index) => {
            return { re: realParts[index], im: imagParts[index] };
        });

        // Sort by real part first, then imaginary part
        complexNumbers.sort((a, b) => {
            if (Math.abs(a.re - b.re) <= tol * Math.abs(a.re)) {
                return a.im - b.im;
            }
            return a.re - b.re;
        });

        // Ensure complex conjugate pairs
        let result = [];
        for (let i = 0; i < complexNumbers.length; i++) {
            let num1 = complexNumbers[i];

            if (i + 1 < complexNumbers.length) {
                let num2 = complexNumbers[i + 1];

                // Check if num1 and num2 form a conjugate pair
                if (isConjugatePair(num1, num2, tol)) {
                    // Add the pair in the correct order: negative imaginary part first
                    if (num1.im < 0) {
                        result.push(num1, num2);
                    } else {
                        result.push(num2, num1);
                    }
                    i++; // Skip the next number since it's already paired
                } else {
                    result.push(num1); // Single number, no pair
                }
            } else {
                result.push(num1); // Last number, no pair
            }
        }

        // Sort real numbers to the end
        let realNumbers = result.filter(num => Math.abs(num.im) <= tol);
        let complexNumbersOnly = result.filter(num => Math.abs(num.im) > tol);

        return [...complexNumbersOnly, ...realNumbers];
    }


    let { zCol, pCol, kCol, isSIMO } = parseInput(z, p, k);

    if (isSIMO) {
        throw new Error("Numerically unreliable method through polynomial form. Conversion not supported for multi-output systems.");
    }

    let pf = pCol;
    let zf = zCol;

    pf = cplxPair(pf);
    zf = cplxPair(zf);

    let np = pf.length;
    let nz = zf.length;
    const ZERO = 0;
    const ONE = 1;

    let oddPoles = false;
    let oddZerosOnly = false;
    let a = math.zeros(np, np); // Initialize matrices
    let b = math.zeros(np, 1);
    let c = math.zeros(1, np);
    let d = ONE;

    if (np % 2 !== 0 && nz % 2 !== 0) {
        a = [[Math.real(pf[np - 1][0])]];
        b = [ONE];
        c = [Math.real(pf[np - 1][0] - zf[nz - 1][0])];
        d = ONE;
        np -= 1;
        nz -= 1;
        oddPoles = true;
    } else if (np % 2 !== 0) {
        // If odd number of poles only, convert the pole at the end into state-space.
        a._data[0][0] = pf[np - 1].re;
        b = math.zeros(np, 1);
        b._data[0][0] = 1;
        c = math.zeros(1, np);
        c._data[0][0] = 1;
        d = ZERO;
        np -= 1;
        oddPoles = true;
    } else if (nz % 2 !== 0) {
        // If odd number of zeros only, convert the zero at the end, along with a pole-pair into state-space.
        let num = poly([Math.real(zf[nz - 1][0])]);
        let den = poly(pf.slice(np - 2, np).map(p => Math.real(p[0])));
        let wn = Math.sqrt(prod(pf.slice(np - 2, np).map(p => Math.abs(p[0]))));
        if (wn === ZERO) {
            wn = ONE;
        }
        let t = [
            [ONE, 0],
            [0, ONE / wn]
        ]; // Balancing transformation
        a = math.multiply(math.inv(t), math.multiply([[-den[1], -den[2]], [ONE, ZERO]], t));
        b = math.multiply(math.inv(t), [[ONE], [ZERO]]);
        c = math.multiply([ONE, num[1]], t);
        d = ZERO;
        nz -= 1;
        np -= 2;
        oddZerosOnly = true;
    }

    let i = 0;

    while (i < np - 1) {
        // Get complex conjugate pair of poles
        let poles = [math.complex(pf[i].re, pf[i].im), math.complex(pf[i + 1].re, pf[i + 1].im)];

        // Compute polynomial coefficients from the poles (denominator)
        let den = math.re(poly(poles));

        // Compute wn, the square root of the product of the absolute values of the poles
        let wn = math.sqrt(math.prod(math.abs(poles)));

        if (wn == ZERO) {
            wn = ONE;
        }

        // Balancing transformation
        let t = math.diag([ONE, ONE / wn]);

        // Compute a1, b1, c1, d1 matrices
        let a1 = math.multiply(math.inv(t), math.multiply([[-den[1], -den[2]], [ONE, ZERO]], t));
        let b1 = math.multiply(math.inv(t), [[ONE], [ZERO]]);
        let c1 = math.multiply([ZERO, ONE], t);
        let d1 = ZERO;

        // Determine j based on oddPoles and oddZerosOnly
        let j;
        if (oddPoles) {
            j = i - 1;
        } else if (oddZerosOnly) {
            j = i;
        } else {
            j = i - 2;
        }

        // Assign matrix values depending on the value of j
        if (j === -2) {
            // First iteration, assign to the first 2x2 block of 'a' and 'c'
            // Copy a1 into the top-left 2x2 submatrix of a
            for (let i = 0; i < 2; i++) {
                for (let k = 0; k < 2; k++) {
                    a._data[i][k] = a1[i][k];
                }
            }

            // Copy c1 into the first two elements of c
            for (let i = 0; i < 2; i++) {
                c = c.subset(math.index(0, i), c1[i]);
            }

        } else {
            // Assign the b1 * c[0:j] product to a[j+2:j+3, 1:j+1]
            let b1_c = math.multiply(b1, c.subset(math.index(0, math.range(0, j + 2))));
            a.subset(math.index(math.range(j + 2, j + 4), math.range(0, j + 2)), b1_c);

            // Assign a1 to a[j+2:j+3, j+2:j+3]
            a.subset(math.index(math.range(j + 2, j + 4), math.range(j + 2, j + 4)), a1);

            // Update c
            let c_subset = c.subset(math.index(0, math.range(0, j + 2)));
            c.subset(math.index(0, math.range(0, j + 2)), math.multiply(d1, c_subset));
            c.subset(math.index(0, [j + 2, j + 3]), c1);
        }

        // Update b
        b.subset(math.index(math.range(j + 2, j + 4), 0), math.multiply(b1, d));

        // Update d
        d = math.multiply(d, d1);

        // Increment i by 2 to move to the next pair of poles
        i += 2;
    }

    // Apply the gain factor k:
    c = math.multiply(c, kCol[0]);
    d = math.multiply(d, kCol[0]);

    return { a, b, c, d };
}

module.exports = { filter, filtfilt, cheb1ord, cheby1, decimate, resample }