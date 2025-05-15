const { ipcRenderer } = require('electron')
const { ViewNames } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');

const pageSize = 8;  // Number of symbols per page
let currentPage = 0; // Track the current page
let buttons = [];
let keysContainer = null;
let keysAndArrowsContainer = null;

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
        keysContainer = document.querySelector('.keyboard__keysContainer');

        if (keysContainer) {
            let keys = [];

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
                    keys = ['first_page', 'keyboard_arrow_up', 'last_page', 'keyboard_arrow_left', 'keyboard_arrow_down', 'keyboard_arrow_right'];
                    break;
                default:
                    keys = buttonId.replace('Btn', '').split('');
            }

            renderPage(keys, buttonId);
            resolve();
        } else {
            console.error('Keyboard keys element not found');
            reject(new Error('Keyboard keys element not found'));
        }
    });
}

function renderPage(keys, buttonId) {
    const keyboard = document.querySelector('#keyboard');
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
            const keyElement = createKey(keys[i], pageIndex, buttonId);
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
            const keyElement = createKey(keyValue, index, buttonId);
            keysContainer.appendChild(keyElement);
        });
    }

    buttons = document.querySelectorAll('button');
};

function createKey(keyValue, index, buttonId) {
    try {
        const idSuffix = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][index] || `${index + 1}th`;

        const key = document.createElement('button');
        key.classList.add('keyboard__key', 'keyboard__key--large');
        key.setAttribute('id', `${idSuffix}KeyBtn`);

        if (buttonId === 'arrowKeysBtn') {
            keysContainer.classList.add('keyboard__keysContainer--doubleRow', 'keyboard__keysContainer--threeColumns');
            key.innerHTML = createMaterialIcon(keyValue);
            key.classList.add('arrowKeyBtn');
        } else {
            key.textContent = keyValue;
        }
        return key;
    } catch (error) {
        console.error('Error creating key:', error);
    }
}

// Function to create navigation buttons
function createNavigationButton(direction, icon) {
    const button = document.createElement('button');
    button.classList.add('button__triangle', `button__triangle--${direction}`);
    button.innerHTML = `<i class="material-icons">${icon}</i>`;

    if (!document.getElementById('firstArrowKeyBtn')) {
        button.setAttribute('id', 'firstArrowKeyBtn');
    } else if (!document.getElementById('secondArrowKeyBtn')) {
        button.setAttribute('id', 'secondArrowKeyBtn');
    }

    button.addEventListener('click', async () => {
        // Update current page based on the direction
        currentPage += direction === 'left' ? -1 : 1;

        await stopManager();
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

function createMaterialIcon(icon_name) {
    return `<i class="material-icons--l">${icon_name}</i>`;
}

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            console.log(`Button ${index + 1} clicked:`, button.textContent.trim());
            const buttonId = button.getAttribute('id');
            const isArrowKey = button.classList.contains('arrowKeyBtn');
            const buttonText = button.textContent.trim();

            await stopManager();

            ipcRenderer.send('overlay-close', ViewNames.KEYBOARD_KEYS);

            if (isArrowKey) {
                ipcRenderer.send('textarea-moveCursor', buttonText);
            } else if (buttonId !== 'cancelBtn') {
                console.log(`Button text: ${buttonText}`);
                ipcRenderer.send('textarea-populate', buttonText);
            }
        });
    });
}