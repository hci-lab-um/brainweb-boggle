const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const logger = require('../main/modules/logger');

let buttons = [];

ipcRenderer.on('more-loaded', async (event, overlayData) => {
    try {
        const { scenarioId } = overlayData;

        buttons = document.querySelectorAll('button');
        await updateScenarioId(scenarioId, buttons, ViewNames.MORE);
        attachEventListeners();
    } catch (error) {
        logger.error('Error in more-loaded handler:', error);
    }
});

ipcRenderer.on('selectedButton-click', (event, buttonId) => {
    try {
        document.getElementById(buttonId).click();
    } catch (error) {
        logger.error('Error in selectedButton-click handler:', error);
    }
});

ipcRenderer.on('scenarioId-update', async (event, scenarioId) => {
    try {
        await updateScenarioId(scenarioId, buttons, ViewNames.MORE);
        ipcRenderer.send('scenarioId-update-complete', scenarioId);
    } catch (error) {
        logger.error('Error in scenarioId-update handler:', error);
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
                await stopManager();

                switch (buttonId) {
                    case "tabsBtn":
                        // -1 is an invalid scenarioId. In this case, the scenarioId will be calculated inside the overlay itself.
                        ipcRenderer.send('overlay-create', ViewNames.TABS, -1);
                        break;
                    case "bookmarksBtn":
                        // -1 is an invalid scenarioId. In this case, the scenarioId will be calculated inside the overlay itself.
                        ipcRenderer.send('overlay-create', ViewNames.BOOKMARKS, -1);
                        break;
                    case "refreshBtn":
                        await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        ipcRenderer.send('webpage-refresh');
                        break;
                    case "zoomInBtn":
                        await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        ipcRenderer.send('webpage-zoomIn');
                        break;
                    case "zoomOutBtn":
                        await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        ipcRenderer.send('webpage-zoomOut');
                        break;
                    case "zoomResetBtn":
                        await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        ipcRenderer.send('webpage-zoomReset');
                        break;
                    case "settingsBtn":
                        //tbi
                        break;
                    case "aboutBtn":
                        ipcRenderer.send('overlay-create', ViewNames.ABOUT, 33);
                        break;
                    case "exitBtn":
                        ipcRenderer.send('app-exit');
                        break;
                    case "closeMoreBtn":
                        await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        });
    });
}