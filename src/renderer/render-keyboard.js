const { ipcRenderer } = require('electron')
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');

let buttons = [];

ipcRenderer.on('keyboard-loaded', async (event, scenarioId) => {
    try {        
        buttons = document.querySelectorAll('button');
        await updateScenarioId(scenarioId, buttons);
        // attachEventListeners();
    } catch (error) {
        console.error('Error in keyboard-loaded handler:', error);
    }
});