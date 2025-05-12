const stimuli = require("ssvep-stimuli");
const { ipcRenderer } = require('electron')
const { scenarioConfig } = require('../../configs/scenarioConfig');
const { browserConfig } = require('../../configs/browserConfig');

let buttons = [];
let manager;

ipcRenderer.on('mainWindow-loaded', async (event, scenarioId) => {
    try {
        await updateScenarioId(scenarioId);
        attachEventListeners();
    } catch (error) {
        console.error('Error in mainWindow-loaded handler:', error);
    }
});

ipcRenderer.on('scenarioId-update', async (event, scenarioId) => {
    try {
        await updateScenarioId(scenarioId);
    } catch (error) {
        console.error('Error in scenarioId-update handler:', error);
    }
});

ipcRenderer.on('webpageBounds-get', () => {
    const element = document.querySelector('#webpage');
    if (element) {
        const rect = element.getBoundingClientRect();
        ipcRenderer.send('webpageBounds-response', {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
        });
    } else {
        ipcRenderer.send('webpageBounds-response', null);
    }
});

async function updateScenarioId(scenarioId) {
    try {
        // This index counter is used to track the number of buttons that have been assigned
        // properties and to ensure that the properties are assigned in the correct order
        let index = 0;

        // Get the frequencies for the current scenario using the config.js file
        // Contains the number of active frequencies in the current scenario
        const frequencies = scenarioConfig[`scenario_${scenarioId}`].frequencies;
        const phases = scenarioConfig[`scenario_${scenarioId}`].phases;
        const buttonIds = scenarioConfig[`scenario_${scenarioId}`].buttonIds;

        manager = new stimuli.CSS('approximation', frequencies.length); // Using frequencies.length to set the number of ACTIVE buttons
        buttons = document.querySelectorAll('button');

        if (!frequencies) {
            console.error(`No frequencies found for scenario ID: ${scenarioId}`);
            return;
        }

        // Assign properties to buttons
        buttons.forEach((button) => {
            const currentBtnId = button.getAttribute('id');

            // Check if the buttonProperties array has a value for the current index
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

// Add event listeners to each button
function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            console.log(`Button ${index + 1} clicked:`, button.textContent.trim());
            const buttonId = button.getAttribute('id');

            switch (buttonId) {
                case "selectBtn":
                    // tbi
                    break;
                case "readBtn":
                    try {
                        const textElement = button.querySelector('p'); // Fix to access the <p> element inside the button
                        if (textElement.textContent.trim() === "Read") {
                            manager.stop();
                            textElement.textContent = "Stop Reading";
                            await updateScenarioId(4);
                        } else {
                            manager.stop();
                            textElement.textContent = "Read";
                            await updateScenarioId(0);
                        }
                    } catch (error) {
                        console.error('Error toggling read mode:', error);
                    }
                    break;
                case "searchBtn":
                    // tbi
                    break;
                case "moreBtn":
                    // tbi
                    break;
            }
        });
    });
}
