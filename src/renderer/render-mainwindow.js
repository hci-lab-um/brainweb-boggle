const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');

let buttons = [];

ipcRenderer.on('mainWindow-loaded', async (event, scenarioId) => {
    try {
        buttons = document.querySelectorAll('button');
        // This line below was commented out because the scenario will be updated when the tab stops loading
        // await updateScenarioId(scenarioId, buttons, ViewNames.MAIN_WINDOW);  
        attachEventListeners();
        ipcRenderer.send('mainWindow-loaded-complete');
    } catch (error) {
        console.error('Error in mainWindow-loaded handler:', error);
    }
});

ipcRenderer.on('scenarioId-update', async (event, scenarioId, stopManager) => {
    try {
        await updateScenarioId(scenarioId, buttons, ViewNames.MAIN_WINDOW, stopManager);
    } catch (error) {
        console.error('Error in scenarioId-update handler:', error);
    }
});

ipcRenderer.on('omniboxText-update', (event, title) => {
    try {
        console.log('title in omniboxText-update', title)
        updateOmniboxText(title);
    } catch (error) {
        console.error('Error in omniboxText-update handler:', error);
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

function updateOmniboxText(title) {
    const omniboxText = document.getElementById('omnibox');
    omniboxText.value = title;
}

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            addButtonSelectionAnimation(button);
            const buttonId = button.getAttribute('id');

            setTimeout(async () => {
                await stopManager();

                switch (buttonId) {
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
                            console.error('Error toggling read mode:', error);
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
                            console.error('Error creating keyboard overlay:', error);
                        }
                        break;
                    case "moreBtn":
                        try {
                            ipcRenderer.send('overlay-create', ViewNames.MORE, 20);
                        } catch (error) {
                            console.error('Error creating keyboard overlay:', error);
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
