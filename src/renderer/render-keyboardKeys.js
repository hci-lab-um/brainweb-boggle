const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const { createMaterialIcon, createNavigationButton, updatePaginationIndicators, paginate } = require('../utils/utilityFunctions');
const logger = require('../main/modules/logger');

let buttons = [];

ipcRenderer.on('keyboardKeys-loaded', async (event, overlayData) => {
    try {
        const { scenarioId, buttonId, isUpperCase } = overlayData;

        await initKeyboardKeys(buttonId, isUpperCase);
        buttons = document.querySelectorAll('button');
        await updateScenarioId(scenarioId, buttons, ViewNames.KEYBOARD_KEYS);
    } catch (error) {
        logger.error('Error in keyboard-loaded handler:', error);
    }
});

ipcRenderer.on('selectedButton-click', (event, buttonId) => {
    try {
        document.getElementById(buttonId).click();
    } catch (error) {
        logger.error('Error in selectedButton-click handler:', error);
    }
});

// // ONLY NEEDED IF THERE WILL BE A SCREEN WITH SCROLL BUTTONS - SYMBOLS
// // The logic might need updating!!
// ipcRenderer.on('scenarioId-update', async (event, scenarioId) => {
//     try {
//         await updateScenarioId(scenarioId, buttons, ViewNames.KEYBOARD_KEYS);
//     } catch (error) {
//         logger.error('Error in scenarioId-update handler:', error);
//     }
// });

function initKeyboardKeys(buttonId, isUpperCase) {
    return new Promise((resolve, reject) => {
        const keyboard = document.querySelector('#keyboard');
        const keysContainer = document.querySelector('.keyboard__keysContainer');
        let keysAndArrowsContainer = null;

        if (keysContainer) {
            let keys = [];
            let currentPage = 0; // Track the current page
            const pageSize = 8;  // Number of symbols per page

            switch (buttonId) {
                case 'numbersBtn':
                    keys = '1234567890'.split('');
                    keysContainer.classList.add('keyboard__keysContainer--doubleRow');
                    break;
                case 'symbolsBtn':
                    keys = `.,;:'"?!+-*=/()@#€%&_^[]`.split('');
                    keysContainer.classList.add('keyboard__keysContainer--doubleRow', 'keyboard__keysContainer--fourColumns');

                    keysAndArrowsContainer = document.createElement('div');
                    keysAndArrowsContainer.classList.add('keyboard__keysAndArrowsContainer');
                    break;
                case 'arrowKeysBtn':
                case 'numericArrowKeysBtn':
                    keys = ['first_page', 'keyboard_arrow_up', 'last_page', 'keyboard_arrow_left', 'keyboard_arrow_down', 'keyboard_arrow_right'];
                    break;
                case 'numericSymbolsBtn':
                    keys = `+-.`.split('');
                    break;
                default:
                    keys = buttonId.replace('Btn', '').split('');
            }

            const createKey = (keyValue, index) => {
                try {
                    const idSuffix = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][index] || `${index + 1}th`;

                    const key = document.createElement('button');
                    key.classList.add('button', 'keyboard__key', 'keyboard__key--large');
                    key.setAttribute('id', `${idSuffix}KeyBtn`);

                    if (buttonId === 'arrowKeysBtn' || buttonId === 'numericArrowKeysBtn') {
                        keysContainer.classList.add('keyboard__keysContainer--doubleRow', 'keyboard__keysContainer--threeColumns');
                        key.innerHTML = createMaterialIcon('l', keyValue);
                        key.classList.add('arrowKeyBtn');
                    } else {
                        key.textContent = isUpperCase ? keyValue.toUpperCase() : keyValue.toLowerCase();
                    }
                    return key;
                } catch (error) {
                    logger.error('Error creating key:', error);
                }
            };

            const handleNavigation = async (direction) => {
                currentPage += direction === 'left' ? -1 : 1;
                await stopManager();
                renderPage();
                requestAnimationFrame(async () => {
                    if (currentPage === 0) {
                        await updateScenarioId(90, buttons, ViewNames.KEYBOARD_KEYS);
                    } else if (currentPage === 1) {
                        await updateScenarioId(91, buttons, ViewNames.KEYBOARD_KEYS);
                    } else if (currentPage === 2) {
                        await updateScenarioId(90, buttons, ViewNames.KEYBOARD_KEYS);
                    }
                });
            };

            const renderPage = () => {
                keysContainer.innerHTML = '';
                if (buttonId === 'symbolsBtn') {
                    keysAndArrowsContainer.innerHTML = '';
                    const pageKeys = paginate(keys, pageSize, currentPage);
                    // Add left navigation button
                    if (currentPage > 0) {
                        const leftArrow = createNavigationButton('left', () => handleNavigation('left'));
                        keysAndArrowsContainer.insertBefore(leftArrow, keysAndArrowsContainer.firstChild);
                    }

                    // Add keys for the current page
                    pageKeys.forEach((keyValue, pageIndex) => {
                        const keyElement = createKey(keyValue, pageIndex);
                        keysContainer.appendChild(keyElement);
                        keysAndArrowsContainer.appendChild(keysContainer);
                    });

                    // Add right navigation button
                    if ((currentPage + 1) * pageSize < keys.length) {
                        const rightArrow = createNavigationButton('right', () => handleNavigation('right'));
                        keysAndArrowsContainer.appendChild(rightArrow);
                    }

                    // Add pagination indicators using utility function
                    updatePaginationIndicators(keys, pageSize, currentPage, '.pagination__container');
                    keyboard.insertBefore(keysAndArrowsContainer, keyboard.firstChild);
                } else {
                    // Render all keys for non-symbol buttons
                    keys.forEach((keyValue, index) => {
                        const keyElement = createKey(keyValue, index);
                        keysContainer.appendChild(keyElement);
                    });
                }

                buttons = document.querySelectorAll('button');
                attachEventListeners();
            };

            renderPage();
            resolve();
        } else {
            logger.error('Keyboard keys element not found');
            reject(new Error('Keyboard keys element not found'));
        }
    });
}

function attachEventListeners() {
    const keyboard = document.querySelector('#keyboard');
    if (!keyboard) return;

    // Ensure only one global listener is attached
    if (keyboard.dataset.listenerAttached === 'true') return;
    keyboard.dataset.listenerAttached = 'true';

    keyboard.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        addButtonSelectionAnimation(button);
        const buttonId = button.getAttribute('id');
        const buttonText = button.textContent.trim();
        const isArrowKey = button.classList.contains('arrowKeyBtn');

        // Navigation buttons (pagination) should NOT be delayed
        if (['firstArrowKeyBtn', 'secondArrowKeyBtn'].includes(buttonId)) {
            await stopManager();
            // Navigation is handled by their own event listeners in createNavigationButton
            return;
        }

        setTimeout(async () => {
            await stopManager();

            if (isArrowKey) {
                ipcRenderer.send('overlay-close', ViewNames.KEYBOARD_KEYS);
                ipcRenderer.send('textarea-moveCursor', buttonText);
            } else if (buttonId === 'cancelBtn') {
                await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.KEYBOARD_KEYS);
            } else if (!['firstArrowKeyBtn', 'secondArrowKeyBtn'].includes(buttonId)) {
                ipcRenderer.send('overlay-close', ViewNames.KEYBOARD_KEYS);
                ipcRenderer.send('textarea-populate', buttonText);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });
}