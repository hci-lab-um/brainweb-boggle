const { ipcRenderer } = require('electron')
const { ViewNames } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');

let buttons = [];

ipcRenderer.on('keyboard-loaded', async (event, scenarioId) => {
    try {
        buttons = document.querySelectorAll('button');

        // Ensuring textarea stays focused by refocusing it if focus is lost
        const textarea = document.querySelector('#textarea');
        textarea.addEventListener("focusout", (event) => {
            setTimeout(() => textarea.focus(), 0);
        });

        await updateScenarioId(scenarioId, buttons, ViewNames.KEYBOARD);
        attachEventListeners();
    } catch (error) {
        console.error('Error in keyboard-loaded handler:', error);
    }
});

ipcRenderer.on('scenarioId-update', async (event, scenarioId) => {
    try {
        await updateScenarioId(scenarioId, buttons, ViewNames.KEYBOARD);
    } catch (error) {
        console.error('Error in scenarioId-update handler:', error);
    }
});

ipcRenderer.on('textarea-populate', (event, text) => {
    try {
        const textarea = document.querySelector('#textarea');
        console.log(`textarea: ${textarea}`);
        if (textarea) {
            console.log(` text: ${text}`);
            textarea.value += text;
        }
    } catch (error) {
        console.error('Error in textarea-populate handler:', error);
    }
});

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            console.log(`Button ${index + 1} clicked:`, button.textContent.trim());
            const buttonId = button.getAttribute('id');

            stopManager();

            switch (buttonId) {
                case "keyboardCloseBtn":
                    ipcRenderer.send('overlay-close', ViewNames.KEYBOARD);
                    break;
                case 'numbersBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 84, 'numbersBtn');
                    break;
                case 'qwertBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 86, 'qwertBtn');
                    break;
                case 'yuiopBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 86, 'yuiopBtn');
                    break;
                case 'asdBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 88, 'asdBtn');
                    break;
                case 'fghBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 88, 'fghBtn');
                    break;
                case 'jklBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 88, 'jklBtn');
                    break;
                case 'upperCaseBtn':
                    break;
                case 'zxcBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 88, 'zxcBtn');
                    break;
                case 'vbnmBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 87, 'vbnmBtn');
                    break;
                case 'enterBtn':
                    break;
                case 'symbolsBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 82, 'symbolsBtn');
                    break;
                case 'dotComBtn':
                    break;
                case 'spaceBtn':
                    break;
                case 'keyboardSendBtn':
                    break;
                case 'arrowKeysBtn':
                    break;
                case 'backspaceBtn':
                    break;
                case 'autoCompleteBtn':
                    break;
            }
        });
    });
}