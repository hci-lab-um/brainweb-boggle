const stimuli = require("ssvep-stimuli");
const { scenarioConfig } = require('../../configs/scenarioConfig');
const { browserConfig } = require('../../configs/browserConfig');
const { ipcRenderer } = require("electron");

let manager;
let managerId = 0;

async function updateScenarioId(scenarioId, buttons, viewName) {
    try {
        buttons = document.querySelectorAll('button');
        ipcRenderer.send('scenarioIdDict-update', scenarioId, viewName);

        // await stopManager();
        let index = 0;
        console.log(`GOXXX OMMMI: ${scenarioId}`);
        const frequencies = scenarioConfig[`scenario_${scenarioId}`].frequencies;
        const phases = scenarioConfig[`scenario_${scenarioId}`].phases;
        const buttonIds = scenarioConfig[`scenario_${scenarioId}`].buttonIds;

        managerId++;
        const localManagerId = managerId;
        console.log(`Creating manager instance ${localManagerId}`);
        manager = new stimuli.CSS('approximation', frequencies.length);

        if (!frequencies) {
            console.error(`No frequencies found for scenario ID: ${scenarioId}`);
            return;
        }

        buttons.forEach((button) => {
            const currentBtnId = button.getAttribute('id');
            if (buttonIds.includes(currentBtnId)) {
                console.log(`Current Button ID: ${currentBtnId}`);
                button.setAttribute('data-phase-shift', phases[index]);
                button.setAttribute('data-frequency', frequencies[index]);
                button.setAttribute('data-pattern', browserConfig.stimuli.customSetup.patterns.line);
                button.setAttribute('data-light-color', browserConfig.stimuli.customSetup.colors.lightColor);
                button.setAttribute('data-dark-color', browserConfig.stimuli.customSetup.colors.darkColor);

                manager.set(button);
                index++;
            }
        });

        console.log(`Manager ${localManagerId} started`);
        await manager.start();
    } catch (error) {
        console.error('Error in updateScenarioId:', error);
    }
}

async function stopManager() {
    try {
        if (manager) {
            console.log(`Stopping manager ${managerId}`);
            await manager.stop();
        }
    } catch (error) {
        console.error('Error in stopManager:', error);
    }
}

module.exports = { updateScenarioId, stopManager };