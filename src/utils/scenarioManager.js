const stimuli = require("ssvep-stimuli");
// const scenarioConfig = require('../../configs/scenarioConfig.json');
const scenarioConfig = require('../../configs/scenarioConfig_lowFreqs.json');
const { browserConfig } = require('../../configs/browserConfig');
const { ipcRenderer } = require("electron");
const logger = require('../main/modules/logger');

let manager;
// -1 = all flickering; 0 = all off; 1..N = group number 
let currentAdaptiveGroupIndex = -1;

ipcRenderer.on('adaptiveSwitch-toggle', async (event, currentScenarioId) => {
    try {
        const groupedButtons = Array.from(document.querySelectorAll('button[data-group]'));
        if (groupedButtons.length === 0) return;

        const totalGroups = Array.from(new Set(groupedButtons.map(b => b.getAttribute('data-group')))).length;

        // Cycle: -1 (all) -> 0 (off) -> 1 -> 2 -> ... -> N -> -1 (all) ...
        currentAdaptiveGroupIndex = (currentAdaptiveGroupIndex + 2) % (totalGroups + 2) - 1;

        await stopManager();

        // 0 = off
        if (currentAdaptiveGroupIndex === 0) {
            console.log('Adaptive switch: all OFF');
            return;
        }

        const activeButtons = currentAdaptiveGroupIndex === -1
            ? groupedButtons // all buttons are active
            : groupedButtons.filter(b => b.getAttribute('data-group') === `group${currentAdaptiveGroupIndex}`); // only buttons in the current group are active

        manager = new stimuli.CSS('approximation', activeButtons.length);
        activeButtons.forEach(b => manager.set(b));

        await manager.start();

        console.log(currentAdaptiveGroupIndex === -1 ? 'Adaptive switch: ALL groups ON' : `Adaptive switch: group${currentAdaptiveGroupIndex} ON`);

        // Restart the BCI interval to ensure correct processing with the new active buttons
        ipcRenderer.send('bciInterval-restart', currentScenarioId);
    } catch (error) {
        logger.error('Error toggling adaptive switch group:', error);
    }
});

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

        // Splitting buttons into groups for adaptive switch
        const adaptiveSwitchButtons = Array.from(buttons).filter(button => button.hasAttribute('data-frequency'));
        const n = adaptiveSwitchButtons.length;

        if (n > 0) {
            // Determine number of groups based on rules:
            // - If there are fewer than 4 buttons: all in the same group
            // - If there are exactly 4 buttons: split into 2 groups (2 and 2)
            // - Otherwise: create ceil(n / 4) groups so each group has up to 4 buttons
            let groupCount;
            if (n < 4) groupCount = 1;
            else if (n === 4) groupCount = 2;
            else groupCount = Math.ceil(n / 4);

            adaptiveSwitchButtons.forEach((button, i) => {
                // Distribute buttons evenly into contiguous groups (sizes differ by at most 1)
                const groupIndex = Math.floor(i * groupCount / n);
                button.setAttribute('data-group', `group${groupIndex + 1}`);
            });
        }
        // }

        currentAdaptiveGroupIndex = -1;

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