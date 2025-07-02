// ------------------------------------------------ !NOT! CATERING FOR RESAMPLING/DOWN SAMPLING ------------------------------------

// const math = require('mathjs');
// const { Configuration } = require('./config.js');
// const { filterbank } = require('./filterbank.js');
// const { canoncorr } = require('./cca.js');

// function test_fbcca(eeg, listFreqs) {
//     if (!eeg || !listFreqs) {
//         throw new Error('Not enough input arguments.');
//     }

//     // Filter bank coefficients
//     const fbCoefs = Array.from({ length: Configuration.subBands }, (_, i) => Math.pow(i + 1, -1.25) + 0.25);

//     const numSmpls = eeg[0].length;
//     const numTargs = listFreqs.length;
//     const yRef = ccaReference(listFreqs, numSmpls);

//     const r = Array(Configuration.subBands).fill(null).map(() => Array(numTargs).fill(0));

//     for (let fbI = 0; fbI < Configuration.subBands; fbI++) {
//         const testData = filterbank(eeg, Configuration.samplingRate, fbI + 1);
//         for (let classI = 0; classI < numTargs; classI++) {
//             const refData = yRef[classI];
//             // Perform canonical correlation analysis
//             const r_tmp = canoncorr(testData, refData);

//             r[fbI][classI] = r_tmp[0];
//         }
//     }

//     // Compute rho and find the max correlation
//     const rho = math.multiply(fbCoefs, r);
//     const correlation = Math.max(...rho);
//     const tau = rho.indexOf(correlation);

//     // Check correlation threshold
//     const estimatedLabel = correlation < Configuration.correlationThreshold ? Configuration.idleStateLabel : tau;

//     return estimatedLabel;
// }

// function ccaReference(listFreqs, numSmpls) {
//     if (!listFreqs || !numSmpls) {
//         throw new Error('Not enough input arguments.');
//     }

//     const numFreqs = listFreqs.length;
//     const tidx = Array.from({ length: numSmpls }, (_, i) => (i + 1) / Configuration.samplingRate);
//     const yRef = Array(numFreqs).fill(null).map(() => Array(2 * Configuration.harmonics).fill(null).map(() => Array(numSmpls).fill(0)));

//     for (let freqI = 0; freqI < numFreqs; freqI++) {
//         const tmp = [];
//         for (let harmI = 1; harmI <= Configuration.harmonics; harmI++) {
//             const stimFreq = listFreqs[freqI];
//             tmp.push(tidx.map(t => Math.sin(2 * Math.PI * t * harmI * stimFreq)));
//             tmp.push(tidx.map(t => Math.cos(2 * Math.PI * t * harmI * stimFreq)));
//         }
//         yRef[freqI] = tmp;
//     }

//     return yRef;
// }

// module.exports = { test_fbcca };





// ------------------------------------------------ CATERING FOR RESAMPLING/DOWN SAMPLING ------------------------------------
const math = require('mathjs');
const { fbccaConfiguration } = require('./fbcca_config.js');
const { filterbank } = require('./filterbank.js');
const { canoncorr } = require('./cca.js');

function test_fbcca(eeg, listFreqs) {
    if (!eeg || !listFreqs) {
        throw new Error('Not enough input arguments.');
    }

    // Filter bank coefficients
    const fbCoefs = Array.from({ length: fbccaConfiguration.subBands }, (_, i) => Math.pow(i + 1, -1.25) + 0.25);

    // Get number of samples after downsampling (assuming filterbank handles this)
    const testDataExample = filterbank(eeg, fbccaConfiguration.samplingRate, 1);  // Sub-band 1
    const numSmplsResampled = testDataExample[0].length;

    // Generate reference signals with matching length and 256 Hz sampling rate
    const yRef = ccaReference(listFreqs, numSmplsResampled, 256);  // <-- fixed sampling rate

    const r = Array(fbccaConfiguration.subBands).fill(null).map(() => Array(listFreqs.length).fill(0));

    for (let fbI = 0; fbI < fbccaConfiguration.subBands; fbI++) {
        const testData = filterbank(eeg, fbccaConfiguration.samplingRate, fbI + 1);  // Includes downsampling to 256 Hz
        for (let classI = 0; classI < listFreqs.length; classI++) {
            const refData = yRef[classI];

            const r_tmp = canoncorr(testData, refData);  // Make sure this returns an array of canonical correlations

            r[fbI][classI] = r_tmp[0];  // Only use the first canonical correlation
        }
    }

    // Weighted sum of correlations
    const rho = math.multiply(fbCoefs, r);
    const correlation = Math.max(...rho);
    const tau = rho.indexOf(correlation);

    const estimatedLabel = correlation < fbccaConfiguration.correlationThreshold
        ? fbccaConfiguration.idleStateLabel
        : tau;

    return estimatedLabel;
}

function ccaReference(listFreqs, numSmpls, fs = 256) {
    if (!listFreqs || !numSmpls) {
        throw new Error('Not enough input arguments.');
    }

    const numFreqs = listFreqs.length;
    const tidx = Array.from({ length: numSmpls }, (_, i) => i / fs);  // 0-based for JS
    const yRef = Array(numFreqs).fill(null).map(() =>
        Array(2 * fbccaConfiguration.harmonics).fill(null).map(() => Array(numSmpls).fill(0))
    );

    for (let freqI = 0; freqI < numFreqs; freqI++) {
        const tmp = [];
        const stimFreq = listFreqs[freqI];
        for (let harmI = 1; harmI <= fbccaConfiguration.harmonics; harmI++) {
            tmp.push(tidx.map(t => Math.sin(2 * Math.PI * t * harmI * stimFreq)));
            tmp.push(tidx.map(t => Math.cos(2 * Math.PI * t * harmI * stimFreq)));
        }
        yRef[freqI] = tmp;
    }

    return yRef;
}

module.exports = { test_fbcca };