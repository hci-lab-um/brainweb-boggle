const { decimate, resample, filter, filtfilt, cheb1ord, cheby1 } = require('./fb_helper.js');

function filterbank(eeg, fs_original, idx_fb, target_fs = 256) {
    if (arguments.length < 2) {
        throw new Error('Not enough input arguments.');
    }

    if (arguments.length < 3 || idx_fb === undefined) {
        console.warn('Missing filter index. Default value (idx_fb = 1) will be used.');
        idx_fb = 1;
    } else if (idx_fb < 1 || idx_fb > 10) {
        throw new Error('The number of sub-bands must be 0 < idx_fb <= 10.');
    }

    const num_chans = eeg.length;
    const data_length = eeg[0].length;
    const fs = fs_original / 2;

    // for set of freq 8-15.8Hz (public dataset) as set by default in Nakanishi code
    const passband = [6, 14, 22, 30, 38, 46, 54, 62, 70, 78];
    const stopband = [4, 10, 16, 24, 32, 40, 48, 56, 64, 72];

    // const Wp = [
    //     truncateToDecimalPlaces(passband[idx_fb - 1] / fs, 4), // [idx_fb - 1] is added because MATLAB arrays start from 1
    //     truncateToDecimalPlaces(90 / fs, 4)
    // ];
    const Wp = [passband[idx_fb - 1] / fs, 90 / fs]

    // const Ws = [
    //     truncateToDecimalPlaces(stopband[idx_fb - 1] / fs, 4), // [idx_fb - 1] is added because MATLAB arrays start from 1
    //     truncateToDecimalPlaces(100 / fs, 4)
    // ];

    const Ws = [stopband[idx_fb - 1] / fs, 100 / fs]

    // // for set of freq 8-15.8Hz (public dataset) as determined in paper Chen 2015    
    // const passband = [8, 16, 24, 32, 40]; 
    // const stopband = [4, 10, 18, 26, 34];

    // const Wp = [
    //     truncateToDecimalPlaces(passband[idx_fb - 1] / fs, 4), // [idx_fb - 1] is added because MATLAB arrays start from 1
    //     truncateToDecimalPlaces(88 / fs, 4)
    // ];

    // const Ws = [
    //     truncateToDecimalPlaces(stopband[idx_fb - 1] / fs, 4), // [idx_fb - 1] is added because MATLAB arrays start from 1
    //     truncateToDecimalPlaces(98 / fs, 4)
    // ];    

    // // for Alison's dataset
    // const passband = [4, 12, 20, 28, 36];
    // const stopband = [2, 8, 14, 22, 30];

    // const Wp = [
    //     truncateToDecimalPlaces(passband[idx_fb - 1] / fs, 4), // [idx_fb - 1] is added because MATLAB arrays start from 1
    //     truncateToDecimalPlaces(90 / fs, 4)
    // ];

    // const Ws = [
    //     truncateToDecimalPlaces(stopband[idx_fb - 1] / fs, 4), // [idx_fb - 1] is added because MATLAB arrays start from 1
    //     truncateToDecimalPlaces(100 / fs, 4)
    // ];    

    const { order: N, wn: Wn } = cheb1ord(Wp, Ws, 3, 40);

    const { den: A, num: B } = cheby1(N, 0.5, Wn);

    // Initialize 'y' to the same size as 'eeg'
    let y = new Array(num_chans);
    for (let i = 0; i < num_chans; i++) {
        y[i] = new Array(data_length).fill(0); // Filling with 0s 
    }

    // Assuming B and A are the filter coefficients and 'filter' is a defined function

    for (let ch_i = 0; ch_i < num_chans; ch_i++) {
        // y[ch_i] = filter(B, A, eeg[0][ch_i]);  // Filtering each channel of eeg
        y[ch_i] = filtfilt(B, A, eeg[ch_i]);  // Using filtfilt for larger eeg
    }


    // ---------------------------------------------- CATERING FOR RESAMPLING/DOWN SAMPLING ------------------------------------
    if (fs_original === target_fs) {
        return y;
    }

    // Downsample or resample
    const downsampleFactor = fs_original / target_fs;
    if (Number.isInteger(downsampleFactor)) {
        y = y.map(channel => decimate(channel, downsampleFactor));
    } else {
        y = y.map(channel => resample(channel, fs_original, target_fs));
    }

    return y;

    // ---------------------------------------------- CATERING FOR RESAMPLING/DOWN SAMPLING ------------------------------------
}

module.exports = { filterbank };