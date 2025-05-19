const { ipcRenderer } = require('electron')
const { ViewNames } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');

let buttons = [];

ipcRenderer.on('mainWindow-loaded', async (event, scenarioId) => {
    try {
        buttons = document.querySelectorAll('button');
        await updateScenarioId(scenarioId, buttons, ViewNames.MAIN_WINDOW);
        attachEventListeners();
    } catch (error) {
        console.error('Error in mainWindow-loaded handler:', error);
    }
});

ipcRenderer.on('scenarioId-update', async (event, scenarioId) => {
    try {
        await updateScenarioId(scenarioId, buttons, ViewNames.MAIN_WINDOW);
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

// Add event listeners to each button
function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            const buttonId = button.getAttribute('id');

            stopManager();

            switch (buttonId) {
                case "selectBtn":
                    // tbi
                    break;
                case "readBtn":
                    try {
                        const textElement = button.querySelector('p'); // Fix to access the <p> element inside the button
                        if (textElement.textContent.trim() === "Read") {
                            textElement.textContent = "Stop Reading";
                            await updateScenarioId(4, buttons, ViewNames.MAIN_WINDOW);
                        } else {
                            textElement.textContent = "Read";
                            await updateScenarioId(0, buttons, ViewNames.MAIN_WINDOW);
                        }
                    } catch (error) {
                        console.error('Error toggling read mode:', error);
                    }
                    break;
                case "searchBtn":
                    try {
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD, 80);
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
            }
        });
    });
}
