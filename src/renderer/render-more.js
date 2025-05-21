const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants  } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');

let buttons = [];

ipcRenderer.on('more-loaded', async (event, scenarioId) => {
    try {
        buttons = document.querySelectorAll('button');
        await updateScenarioId(scenarioId, buttons, ViewNames.MORE);
        attachEventListeners();
    } catch (error) {
        console.error('Error in more-loaded handler:', error);
    }
});

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            addButtonSelectionAnimation(button)
            const buttonId = button.getAttribute('id');

            setTimeout(async () => {
                stopManager();

                switch (buttonId) {
                    case "tabsBtn":
                        // tbi
                        break;
                    case "bookmarksBtn":
                        // tbi
                        break;
                    case "refreshBtn":
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        ipcRenderer.send('webpage-refresh');
                        break;
                    case "zoomInBtn":
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        ipcRenderer.send('webpage-zoomIn');
                        break;
                    case "zoomOutBtn":
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        ipcRenderer.send('webpage-zoomOut');
                        break;
                    case "zoomResetBtn":
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        ipcRenderer.send('webpage-zoomReset');
                        break;
                    case "settingsBtn":
                        // tbi
                        break;
                    case "aboutBtn":
                        // tbi
                        break;
                    case "exitBtn":
                        ipcRenderer.send('app-exit');
                        break;
                    case "closeMoreBtn":
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.MORE);
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        });
    });
}