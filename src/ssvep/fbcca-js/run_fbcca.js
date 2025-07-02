const { fbccaConfiguration } = require('./fbcca_config.js');
const scenarioConfig = require('../../../configs/scenarioConfig.json');
const { test_fbcca } = require('./test_fbcca.js');

let scenarioId;

function run_fbcca(eeg, scenId) {    
    scenarioId = scenId;
    const eegData = eeg.slice(0, fbccaConfiguration.totalDataPointCount());
    const stimuliFrequencies = getStimuliFrequencies();

    let selectedButtonId;
    if (any(eegData) && all(stimuliFrequencies)) {
        const freqIdx = test_fbcca(eegData, stimuliFrequencies);

        // We are using the index of the frequency to get the button ID in that same index
        selectedButtonId = getSelectedButtonId(freqIdx);
    } else {
        selectedButtonId = fbccaConfiguration.idleStateLabel;
    }

    return selectedButtonId;
}

function getStimuliFrequencies() {
    let stimuliFrequencies;
    if (scenarioId !== -1) {
        stimuliFrequencies = scenarioConfig[`scenario_${scenarioId}`].frequencies;
    } else {
        stimuliFrequencies = 0;
    }

    return stimuliFrequencies;
}

function getSelectedButtonId(freqIdx) {
    let selectedButtonId;
    if (freqIdx !== fbccaConfiguration.idleStateLabel) {
        selectedButtonId = scenarioConfig[`scenario_${scenarioId}`].buttonIds[freqIdx];
    } else {
        selectedButtonId = freqIdx;
    }

    return selectedButtonId;
}

function any(array) {
    return Array.from(array).some(value => value !== 0);
}

function all(array) {
    return Array.from(array).every(value => value !== 0);
}

module.exports = { run_fbcca };