# fbccaConfig.json

## What the config file does
It configures the FBCCA EEG classification pipeline (Filter Bank Canonical Correlation Analysis). The values determine how data is preprocessed (filters, resampling), how long signals are analysed, and how strict classification is.

### Field meanings and impact when changed

- channels: Number of EEG channels used. This is being updated in the config file from the headset table.
- subBands: Number of filter bank sub-bands. This is set and never changed.
- idleStateLabel: Label used when no valid target is detected. This is set and never changed.
- samplingRate: Expected sample rate (Hz) of incoming EEG data. Must match device output or processing will be incorrect. This is being updated in the config file from the headset table.
- correlationThreshold: Minimum correlation required to accept a target. This is set and never changed. It should be altered according to the subject that is using Boggle.
- gazeLengthInSecs: Window length (seconds) of data used per decision. This is being updated in the config file from the settings table.
- applyBandpassFilter: Whether to run bandpass filtering. Since we use the FBCCA algorithm, this should remain off because `filterbank.py` already performs this step. The option to toggle it in code is kept for developers.
- applyNotchFilter: Whether to remove line noise (50 Hz). This is only turned on for headsets that make use of LSL or Python API connection types. Therefore, this is being updated in the config file from the connection_type table. 
- applyResampling: Whether to resample the incoming signal. Currently our headsets all have sampling rates very close to 256Hz. Therefore this is always kept off.
- saveRawData: Whether to save raw EEG data. Switching this on will create a folder datasets with the raw eeg of that session. This option is only for developers.