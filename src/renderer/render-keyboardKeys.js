const { ipcRenderer } = require('electron')
const { ViewNames } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');

let buttons = [];

ipcRenderer.on('keyboardKeys-loaded', async (event, scenarioId, buttonId) => {
    try {
        await initKeyboardKeys(buttonId);
        buttons = document.querySelectorAll('button');
        await updateScenarioId(scenarioId, buttons, ViewNames.KEYBOARD_KEYS);
        attachEventListeners();
    } catch (error) {
        console.error('Error in keyboard-loaded handler:', error);
    }
});

// // ONLY NEEDED IF THERE WILL BE A SCREEN WITH SCROLL BUTTONS - SYMBOLS
// // The logic might need updating!!
// ipcRenderer.on('scenarioId-update', async (event, scenarioId) => {
//     try {
//         await updateScenarioId(scenarioId, buttons, ViewNames.KEYBOARD_KEYS);
//     } catch (error) {
//         console.error('Error in scenarioId-update handler:', error);
//     }
// });

function initKeyboardKeys(buttonId) {
    return new Promise((resolve, reject) => {
        const keysContainer = document.querySelector('.keyboard__keysContainer');
        if (keysContainer) {
            let keys = [];

            switch (buttonId) {
                case 'numbersBtn':
                    keys = '1234567890';
                    break;
                case 'symbolsBtn':
                    keys = '+-?@/!():.,#'; // To be revised
                    break;
                default:
                    keys = buttonId.replace('Btn', ''); // Extract keys from buttonId
            }

            keys.split('').forEach((keyValue, index) => {
                const keyElement = createKey(keyValue, index);
                keysContainer.appendChild(keyElement);
            });

            resolve(); // Resolve the promise after all keys are created
        } else {
            console.error('Keyboard keys element not found');
            reject(new Error('Keyboard keys element not found'));
        }
    });
}

function createKey(keyValue, index) {
    try {
        const idSuffix = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][index] || `${index + 1}th`;

        const key = document.createElement('button');
        key.classList.add('keyboard__key', 'keyboard__key--large');
        key.setAttribute('id', `${idSuffix}KeyBtn`);
        key.textContent = keyValue;
        return key;
    } catch (error) {
        console.error('Error creating key:', error);
    }
}

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            console.log(`Button ${index + 1} clicked:`, button.textContent.trim());
            const buttonId = button.getAttribute('id');

            stopManager();

            switch (buttonId) {
                case "firstKeyBtn":
                    break;
                case 'secondKeyBtn':
                    break;
                case 'thirdKeyBtn':
                    break;
                case 'fourthKeyBtn':
                    break;
                case 'fifthKeyBtn':
                    break;
                case 'sixthKeyBtn':
                    break;
                case 'seventhKeyBtn':
                    break;
                case 'eighthKeyBtn':
                    break;
                case 'ninthKeyBtn':
                    break;
                case 'tenthKeyBtn':
                    break;
                case 'cancelBtn':
                    // TO DO NEXT  
                    break;
            }
        });
    });
}