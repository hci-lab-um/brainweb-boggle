const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { initStatusBar, applyStatusBarStateChange } = require('../utils/statusBar');
const logger = require('../main/modules/logger');

let buttons = [];

ipcRenderer.on('mainWindow-loaded', async (event, scenarioId) => {
    try {
        initStatusBar();

        buttons = document.querySelectorAll('button');
        // This line below was commented out because the scenario will be updated when the tab stops loading
        // await updateScenarioId(scenarioId, buttons, ViewNames.MAIN_WINDOW);  
        attachEventListeners();
        ipcRenderer.send('mainWindow-loaded-complete');
    } catch (error) {
        logger.error('Error in mainWindow-loaded handler:', error);
    }
});

ipcRenderer.on('statusBar-applyStateChange', (event, changes) => {
    try {
        applyStatusBarStateChange(changes);
    } catch (error) {
        logger.error('Error handling statusBar-applyStateChange:', error);
    }
});

ipcRenderer.on('selectedButton-click', (event, buttonId) => {
    try {
        document.getElementById(buttonId).click();
    } catch (error) {
        logger.error('Error in selectedButton-click handler:', error);
    }
});

ipcRenderer.on('scenarioId-update', async (event, scenarioId, stopManager) => {
    try {
        await updateScenarioId(scenarioId, buttons, ViewNames.MAIN_WINDOW, stopManager);
        ipcRenderer.send('scenarioId-update-complete', scenarioId);
    } catch (error) {
        logger.error('Error in scenarioId-update handler:', error);
    }
});

ipcRenderer.on('omniboxText-update', (event, title, isErrorPage = false) => {
    try {
        console.log('title in omniboxText-update', title)
        updateOmniboxText(title, isErrorPage);
    } catch (error) {
        logger.error('Error in omniboxText-update handler:', error);
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

function updateOmniboxText(title, isErrorPage = false) {
    const omniboxText = document.getElementById('omnibox');
    omniboxText.value = title;

    const omniboxFav = document.querySelector('#favicon');
    const omniboxIcon = omniboxFav.querySelector('i');

    if (isErrorPage) {
        omniboxIcon.innerText = 'close';
        omniboxFav.classList.add('favicon--error');
    } else {
        omniboxIcon.innerText = 'check';
        omniboxFav.classList.remove('favicon--error');
    }
}

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            // Disable the button immediately to prevent multiple clicks
            button.disabled = true;
            setTimeout(() => { button.disabled = false; }, 1500);

            addButtonSelectionAnimation(button);
            const buttonId = button.getAttribute('id');

            setTimeout(async () => {
                await stopManager();

                switch (buttonId) {
                    case "seekBtn":
                        // -1 is an invalid scenarioId. In this case, the scenarioId will be calculated inside the overlay itself.
                        ipcRenderer.send('overlay-create', ViewNames.SEEK, -1);
                        break;
                    case "selectBtn":
                        // -1 is an invalid scenarioId. In this case, the scenarioId will be calculated inside the overlay itself.
                        ipcRenderer.send('overlay-create', ViewNames.SELECT, -1);
                        break;
                    case "readBtn":
                        try {
                            const textElement = button.querySelector('p'); // Fix to access the <p> element inside the button
                            if (textElement.textContent.trim() === "Read") {
                                textElement.textContent = "Stop Reading";
                                await updateScenarioId(4, buttons, ViewNames.MAIN_WINDOW);
                            } else {
                                textElement.textContent = "Read";
                                ipcRenderer.send('readMode-stop');
                            }
                        } catch (error) {
                            logger.error('Error toggling read mode:', error);
                        }
                        break;
                    case "searchBtn":
                        try {
                            const omnibox = document.getElementById('omnibox');
                            let elementProperties = {
                                id: 'omnibox',
                                type: omnibox.type,
                            }
                            ipcRenderer.send('overlay-create', ViewNames.KEYBOARD, 80, null, null, elementProperties);
                        } catch (error) {
                            logger.error('Error creating keyboard overlay:', error);
                        }
                        break;
                    case "moreBtn":
                        try {
                            ipcRenderer.send('overlay-create', ViewNames.MORE, 20);
                        } catch (error) {
                            logger.error('Error creating keyboard overlay:', error);
                        }
                        break;
                    case "backBtn":
                        ipcRenderer.send('webpage-goBack');
                        break;
                    case "forwardBtn":
                        ipcRenderer.send('webpage-goForward');
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        });
    });
}
