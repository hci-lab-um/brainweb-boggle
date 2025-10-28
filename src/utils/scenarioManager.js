const stimuli = require("ssvep-stimuli");
// const scenarioConfig = require('../../configs/scenarioConfig.json');
const scenarioConfig = require('../../configs/scenarioConfig_lowFreqs.json');
const { browserConfig } = require('../../configs/browserConfig');
const { ipcRenderer } = require("electron");
const logger = require('../main/modules/logger');

let manager;

async function updateScenarioId(scenarioId, buttons, viewName, stop = false) {
    try {
        buttons = document.querySelectorAll('button');
        ipcRenderer.send('scenarioIdDict-update', scenarioId, viewName);

        if (stop) await stopManager();
        let index = 0;
        const frequencies = scenarioConfig[`scenario_${scenarioId}`].frequencies;
        const phases = scenarioConfig[`scenario_${scenarioId}`].phases;
        const buttonIds = scenarioConfig[`scenario_${scenarioId}`].buttonIds;

        manager = new stimuli.CSS('approximation', frequencies.length);

        if (!frequencies) {
            logger.error(`No frequencies found for scenario ID: ${scenarioId}`);
            return;
        }

        buttons.forEach((button) => {
            const currentBtnId = button.getAttribute('id');
            const buttonIdIndex = buttonIds.indexOf(currentBtnId);

            if (buttonIdIndex !== -1) {
                button.setAttribute('data-phase-shift', phases[buttonIdIndex]);
                button.setAttribute('data-frequency', frequencies[buttonIdIndex]);
                button.setAttribute('data-pattern', browserConfig.stimuli.customSetup.patterns.line);
                button.setAttribute('data-light-color', browserConfig.stimuli.customSetup.colors.lightColor);
                button.setAttribute('data-dark-color', browserConfig.stimuli.customSetup.colors.darkColor);

                manager.set(button);
                index++;
            }
        });

        await manager.start();

        // Restart the BCI interval with the new scenario ID to be able to process the data according to the new scenario
        ipcRenderer.send('bciInterval-restart', scenarioId);
    } catch (error) {
        logger.error('Error in updateScenarioId:', error);
    }
}

async function stopManager() {
    try {
        if (manager) {
            await manager.stop();
        }
    } catch (error) {
        logger.error('Error in stopManager:', error);
    }
}

module.exports = { updateScenarioId, stopManager };