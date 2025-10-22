import numpy as np
from scipy.signal import cheb1ord, cheby1, filtfilt, resample, decimate
from fbcca_config import fbcca_config

# Cache filter coefficients per sub-band so we only design each filter once
_FILTER_COEFF_CACHE = {}

# Sub-band definitions used across calls
_PASSBAND = [6, 14, 22, 30, 38, 46, 54, 62, 70, 78]
_STOPBAND = [4, 10, 16, 24, 32, 40, 48, 56, 64, 72]

def resample_eeg(eeg, original_fs, target_fs=256):
    num_samples = int(eeg.shape[1] * target_fs / original_fs)
    return resample(eeg, num_samples, axis=1)  # Resample along time axis

def downsample_eeg(eeg, original_fs, target_fs=256):
    factor = original_fs // target_fs  # Integer factor
    if original_fs % target_fs != 0:
        raise ValueError("Downsampling factor must be an integer. Use resampling instead.")

    return decimate(eeg, factor, axis=1, ftype='iir')  # Decimate along time axis

def filterbank(eeg, idx_fb=1, target_fs=256):   
    if eeg is None or idx_fb is None:
        raise ValueError('Not enough input arguments.')

    if idx_fb < 1 or idx_fb > 10:
        raise ValueError('The number of sub-bands must be 0 < idx_fb <= 10.')

    num_chans, _ = eeg.shape
    fs_original = fbcca_config.samplingRate
    fs = fs_original / 2

    if idx_fb not in _FILTER_COEFF_CACHE:
        Wp = [_PASSBAND[idx_fb - 1] / fs, 90 / fs]
        Ws = [_STOPBAND[idx_fb - 1] / fs, 100 / fs]
        N, Wn = cheb1ord(Wp, Ws, 3, 40)
        _FILTER_COEFF_CACHE[idx_fb] = cheby1(N, 0.5, Wn, btype='band')

    B, A = _FILTER_COEFF_CACHE[idx_fb]

    # Filter the EEG data
    y = np.zeros_like(eeg)
    
    # Apply the filter to each channel
    for ch_i in range(num_chans):
        y[ch_i, :] = filtfilt(B, A, eeg[ch_i, :], padtype = None)
        
    if fs_original == target_fs:
        return y
    
    # Downsample or resample
    if fs_original % target_fs == 0:
        y = downsample_eeg(y, fs_original, target_fs)
    else:
        y = resample_eeg(y, fs_original, target_fs)

    return y