import numpy as np
from fbcca_config_service import fbcca_config
from sklearn.cross_decomposition import CCA
from filterbank import filterbank  # Make sure it downsample to 256 Hz internally

def test_fbcca(eeg, list_freqs):
    if eeg is None or list_freqs is None:
        raise ValueError('Not enough input arguments.')

    # Filter bank coefficients
    fb_coefs = np.array([i for i in range(1, fbcca_config['subBands'] + 1)])**(-1.25) + 0.25

    # Compute all sub-bands once per invocation to avoid redundant filtering
    filtered_subbands = [filterbank(eeg, fb_idx + 1) for fb_idx in range(fbcca_config['subBands'])]
    if not filtered_subbands:
        raise ValueError('No sub-bands computed; check fbcca_config.subBands.')

    num_smpls_resampled = filtered_subbands[0].shape[1]

    # Generate reference signals to match downsampled EEG length
    y_ref = cca_reference(list_freqs, num_smpls_resampled, fs=256)  # <-- updated

    r = np.zeros((fbcca_config['subBands'], len(list_freqs)))

    for fb_i, testdata in enumerate(filtered_subbands):
        for class_i in range(len(list_freqs)):
            refdata = y_ref[class_i, :, :]

            n_components = min(testdata.shape[0], refdata.shape[0])
            cca = CCA(n_components=n_components)
            cca.fit(testdata.T, refdata.T)

            testdata_c, refdata_c = cca.transform(testdata.T, refdata.T)
            r_tmp = [np.corrcoef(testdata_c[:, i], refdata_c[:, i])[0, 1] for i in range(n_components)]
            r[fb_i, class_i] = r_tmp[0]

    # Weighted sum of correlations
    rho = np.dot(fb_coefs, r)
    correlation = np.max(rho)
    tau = np.argmax(rho)

    if correlation < fbcca_config['correlationThreshold']:
        estimated_label = fbcca_config['idleStateLabel']
    else:
        estimated_label = tau

    return estimated_label


def cca_reference(list_freqs, num_smpls, fs=256):  # fs parameter added
    if list_freqs is None or num_smpls is None:
        raise ValueError('Not enough input arguments.')

    num_freqs = len(list_freqs)
    tidx = np.arange(1, num_smpls + 1) / fs  # <-- use fs, not fbcca_config['samplingRate']

    y_ref = np.zeros((num_freqs, 2 * fbcca_config['harmonics'], num_smpls))

    for freq_i in range(num_freqs):
        tmp = []
        for harm_i in range(1, fbcca_config['harmonics'] + 1):
            stim_freq = list_freqs[freq_i]
            tmp.append(np.sin(2 * np.pi * tidx * harm_i * stim_freq))
            tmp.append(np.cos(2 * np.pi * tidx * harm_i * stim_freq))
        y_ref[freq_i, :, :] = np.array(tmp)

    return y_ref