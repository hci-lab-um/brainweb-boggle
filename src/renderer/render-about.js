const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const logger = require('../main/modules/logger');

let buttons = [];
let browsingContainer = null;
const SCROLL_DISTANCE = 400; // Pixels scrolled per button press
let versionElement = null;

ipcRenderer.on('about-loaded', async (event, overlayData) => {
    try {
        const { scenarioId } = overlayData;

        buttons = document.querySelectorAll('button');
        browsingContainer = document.getElementById('browsing-container');
        versionElement = document.getElementById('appVersion');
        await setAppVersion();
        await updateScenarioId(scenarioId, buttons, ViewNames.ABOUT);
        attachEventListeners();
    } catch (error) {
        logger.error('Error in about-loaded handler:', error);
    }
});

ipcRenderer.on('selectedButton-click', (event, buttonId) => {
    try {
        document.getElementById(buttonId).click();
    } catch (error) {
        logger.error('Error in selectedButton-click handler:', error);
    }
});

async function setAppVersion() {
    try {
        if (!versionElement) return;
        const version = await ipcRenderer.invoke('app-getVersion');
        versionElement.textContent = version || 'Unknown';
    } catch (error) {
        logger.error('Error setting app version:', error);
    }
}

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
                    case "scrollUpBtn":
                        if (!browsingContainer) {
                            logger.warn('scrollUpBtn clicked but browsing container was not found.');
                            return;
                        }

                        browsingContainer.scrollBy({ top: -SCROLL_DISTANCE, behavior: 'smooth' });
                        break;
                    case "scrollDownBtn":
                        if (!browsingContainer) {
                            logger.warn('scrollDownBtn clicked but browsing container was not found.');
                            return;
                        }

                        browsingContainer.scrollBy({ top: SCROLL_DISTANCE, behavior: 'smooth' });
                        break;

                    case "closeAboutBtn":
                        await stopManager();
                        await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.ABOUT);
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        });
    });
}