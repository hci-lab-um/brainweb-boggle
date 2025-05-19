const { ipcRenderer } = require('electron')
const { ViewNames } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');

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
            const buttonId = button.getAttribute('id');

            stopManager();

            switch (buttonId) {
                case "tabsBtn":
                    // tbi
                    break;
                case "bookmarksBtn":
                    // tbi
                    break;
                case "refreshBtn":
                    // tbi
                    break;
                case "zoomInBtn":
                    // tbi
                    break;
                case "zoomOutBtn":
                    // tbi
                    break;
                case "zoomResetBtn":
                    // tbi
                    break;
                case "settingsBtn":
                    // tbi
                    break;
                case "aboutBtn":
                    // tbi
                    break;
                case "exitBtn":
                    // tbi
                    break;
            }
        });
    });
}