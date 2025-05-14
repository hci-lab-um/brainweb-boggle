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
            const pageSize = 8;  // Number of symbols per page
            let currentPage = 0; // Track the current page

            switch (buttonId) {
                case 'numbersBtn':
                    keys = '1234567890'.split('');
                    break;
                case 'symbolsBtn':
                    keys = `.,;:'"+-*=/()?!@#€%&_^[]`.split('');
                    break;
                default:
                    keys = buttonId.replace('Btn', '').split('');
            }

            const renderPage = () => {
                keysContainer.innerHTML = '';

                if (buttonId === 'symbolsBtn') {
                    // Calculate start and end indices for the current page
                    const start = currentPage * pageSize;
                    const end = Math.min(start + pageSize, keys.length);

                    // Add left navigation button                    
                    if (currentPage > 0) {
                        const leftArrow = createNavigationButton('left', 'keyboard_arrow_left');
                        keysContainer.appendChild(leftArrow);
                    }

                    // Add symbols for the current page
                    for (let i = start; i < end; i++) {
                        const pageIndex = i - start; // Index within the current page
                        const keyElement = createKey(keys[i], pageIndex);
                        keysContainer.appendChild(keyElement);
                    }

                    // Add right navigation button                    
                    if (end < keys.length) {
                        const rightArrow = createNavigationButton('right', 'keyboard_arrow_right');
                        keysContainer.appendChild(rightArrow);
                    }
                } else {
                    // Render all keys for non-symbol buttons
                    keys.forEach((keyValue, index) => {
                        const keyElement = createKey(keyValue, index);
                        keysContainer.appendChild(keyElement);
                    });
                }
                buttons = document.querySelectorAll('button');
            };

            // Function to create navigation buttons
            const createNavigationButton = (direction, icon) => {
                const button = document.createElement('button');
                button.classList.add('keyboard__key', 'keyboard__key--l');
                button.innerHTML = `<i class="material-icons">${icon}</i>`;

                if (!document.getElementById('firstArrowKeyBtn')) {
                    button.setAttribute('id', 'firstArrowKeyBtn');
                } else if (!document.getElementById('secondArrowKeyBtn')) {
                    button.setAttribute('id', 'secondArrowKeyBtn');
                }

                button.addEventListener('click', () => {
                    // Update current page based on the direction
                    currentPage += direction === 'left' ? -1 : 1;

                    stopManager();
                    renderPage();

                    // Waiting for the page to render all the buttons before updating the scenarioId 
                    // (IMP requestAnimationFrame remains in the event loop)
                    requestAnimationFrame(() => { 
                        if (currentPage === 0) {
                            updateScenarioId(82, buttons, ViewNames.KEYBOARD_KEYS);
                        } else if (currentPage === 1) {
                            updateScenarioId(83, buttons, ViewNames.KEYBOARD_KEYS);
                        } else if (currentPage === 2) {
                            updateScenarioId(82, buttons, ViewNames.KEYBOARD_KEYS);
                        }
                    });
                });
                return button;
            };

            renderPage();
            resolve(); 
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