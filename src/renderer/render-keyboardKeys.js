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
        const keyboard = document.querySelector('#keyboard');
        const keysContainer = document.querySelector('.keyboard__keysContainer');
        let keysAndArrowsContainer = null;

        if (keysContainer) {
            let keys = [];
            const pageSize = 8;  // Number of symbols per page
            let currentPage = 0; // Track the current page

            switch (buttonId) {
                case 'numbersBtn':
                    keys = '1234567890'.split('');
                    keysContainer.classList.add('keyboard__keysContainer--doubleRow');
                    break;
                case 'symbolsBtn':
                    keys = `.,;:'"+-*=/()?!@#€%&_^[]`.split('');
                    keysContainer.classList.add('keyboard__keysContainer--doubleRow', 'keyboard__keysContainer--fourColumns');

                    keysAndArrowsContainer = document.createElement('div');
                    keysAndArrowsContainer.classList.add('keyboard__keysAndArrowsContainer');
                    break;
                case 'arrowKeysBtn':
                // TO IMPLEMENT
                default:
                    keys = buttonId.replace('Btn', '').split('');
            }

            const renderPage = () => {
                keysContainer.innerHTML = '';

                if (buttonId === 'symbolsBtn') {
                    keysAndArrowsContainer.innerHTML = '';

                    // Calculate start and end indices for the current page
                    const start = currentPage * pageSize;
                    const end = Math.min(start + pageSize, keys.length);

                    // Add left navigation button                    
                    if (currentPage > 0) {
                        const leftArrow = createNavigationButton('left', 'keyboard_arrow_left');
                        keysAndArrowsContainer.insertBefore(leftArrow, keysAndArrowsContainer.firstChild);
                    }

                    // Add symbols for the current page
                    for (let i = start; i < end; i++) {
                        const pageIndex = i - start; // Index within the current page
                        const keyElement = createKey(keys[i], pageIndex);
                        keysContainer.appendChild(keyElement);
                        keysAndArrowsContainer.appendChild(keysContainer);
                    }

                    // Add right navigation button                    
                    if (end < keys.length) {
                        const rightArrow = createNavigationButton('right', 'keyboard_arrow_right');
                        keysAndArrowsContainer.appendChild(rightArrow);
                    }

                    keyboard.insertBefore(keysAndArrowsContainer, keyboard.firstChild);
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
                button.classList.add('button__triangle', `button__triangle--${direction}`);
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
                            updateScenarioId(90, buttons, ViewNames.KEYBOARD_KEYS);
                        } else if (currentPage === 1) {
                            updateScenarioId(91, buttons, ViewNames.KEYBOARD_KEYS);
                        } else if (currentPage === 2) {
                            updateScenarioId(90, buttons, ViewNames.KEYBOARD_KEYS);
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

            ipcRenderer.send('overlay-close', ViewNames.KEYBOARD_KEYS);

            switch (buttonId) {
                case 'arrowKeysBtn':
                    break;
                // TO IMPLEMENT
                default:
                    const buttonText = button.textContent.trim();
                    console.log(`Button text: ${buttonText}`);
                    ipcRenderer.send('textarea-populate', buttonText);
                    break;
            }
        });
    });
}