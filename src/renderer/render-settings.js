const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const logger = require('../main/modules/logger');

let buttons = [];
let settingsSelection = null;

ipcRenderer.on('settings-loaded', async (event, overlayData) => {
    try {
        const { scenarioId } = overlayData;

        buttons = document.querySelectorAll('button');
        settingsSelection = document.getElementById('settingsSelection');

        await updateScenarioId(scenarioId, buttons, ViewNames.SETTINGS);
        attachEventListeners();
    } catch (error) {
        logger.error('Error in settings-loaded handler:', error);
    }
});

ipcRenderer.on('selectedButton-click', (event, buttonId) => {
    try {
        document.getElementById(buttonId).click();
    } catch (error) {
        logger.error('Error in selectedButton-click handler:', error);
    }
});

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            // Disable the button immediately to prevent multiple clicks
            button.disabled = true;
            setTimeout(() => { button.disabled = false; }, 1500);

            addButtonSelectionAnimation(button)
            const buttonId = button.getAttribute('id');

            setTimeout(async () => {
                switch (buttonId) {
                    case "generalSettingsBtn":
                        //tbi 
                        break;
                    case "stimuliSettingsBtn":
                        //tbi
                        break;
                    case "calibrationBtn":
                        // tbi
                        break;
                    case "closeSettingsBtn":
                        await stopManager();
                        await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.SETTINGS);
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        });
    });
}
