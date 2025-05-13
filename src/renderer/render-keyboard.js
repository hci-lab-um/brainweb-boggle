const { ipcRenderer } = require('electron')
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');

let buttons = [];

ipcRenderer.on('keyboard-loaded', async (event, scenarioId) => {
    try {
        buttons = document.querySelectorAll('button');
        await updateScenarioId(scenarioId, buttons);
        attachEventListeners();
    } catch (error) {
        console.error('Error in keyboard-loaded handler:', error);
    }
});

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            console.log(`Button ${index + 1} clicked:`, button.textContent.trim());
            const buttonId = button.getAttribute('id');

            switch (buttonId) {
                case "keyboardCloseBtn":
                    stopManager();
                    ipcRenderer.send('overlay-close', "keyboard");
                    break;
                case 'numbersBtn':
                    break;
                case 'qwertBtn':
                    break;
                case 'yuiopBtn':
                    break;
                case 'asdBtn':
                    break;
                case 'fghBtn':
                    break;
                case 'jklBtn':
                    break;
                case 'upperCaseBtn':
                    break;
                case 'zxcBtn':
                    break;
                case 'vbnmBtn':
                    break;
                case 'enterBtn':
                    break;
                case 'symbolsBtn':
                    break;
                case 'dotComBtn':
                    break;
                case 'spaceBtn':
                    break;
                case 'keyboardSendBtn':
                    break;
            }
        });
    });
}