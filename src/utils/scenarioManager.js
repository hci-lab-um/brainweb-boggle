const stimuli = require("ssvep-stimuli");
const { scenarioConfig } = require('../../configs/scenarioConfig');
const { browserConfig } = require('../../configs/browserConfig');
const { ipcRenderer } = require("electron");

let manager;

async function updateScenarioId(scenarioId, buttons, viewName) {
    try {
        ipcRenderer.send('scenarioIdDict-update', scenarioId, viewName);

        let index = 0;
        const frequencies = scenarioConfig[`scenario_${scenarioId}`].frequencies;
        const phases = scenarioConfig[`scenario_${scenarioId}`].phases;
        const buttonIds = scenarioConfig[`scenario_${scenarioId}`].buttonIds;

        manager = new stimuli.CSS('approximation', frequencies.length);

        if (!frequencies) {
            console.error(`No frequencies found for scenario ID: ${scenarioId}`);
            return;
        }

        buttons.forEach((button) => {
            const currentBtnId = button.getAttribute('id');
            if (buttonIds.includes(currentBtnId)) {
                button.setAttribute('data-phase-shift', phases[index]);
                button.setAttribute('data-frequency', frequencies[index]);
                button.setAttribute('data-pattern', browserConfig.stimuli.customSetup.patterns.line);
                button.setAttribute('data-light-color', browserConfig.stimuli.customSetup.colors.lightColor);
                button.setAttribute('data-dark-color', browserConfig.stimuli.customSetup.colors.darkColor);

                manager.set(button);
                index++;
            }
        });

        await manager.start();
    } catch (error) {
        console.error('Error in updateScenarioId:', error);
    }
}

function stopManager() {
    try{ 
        if (manager) {
            manager.stop();
        }
    } catch (error) {
        console.error('Error in stopManager:', error);
    }    
}

module.exports = { updateScenarioId, stopManager };