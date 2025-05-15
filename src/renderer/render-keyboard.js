const { ipcRenderer } = require('electron')
const { ViewNames } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');

let buttons = [];
let textarea;

ipcRenderer.on('keyboard-loaded', async (event, scenarioId) => {
    try {
        buttons = document.querySelectorAll('button');
        textarea = document.querySelector('#textarea');

        // Ensuring textarea stays focused by refocusing it if focus is lost
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
        console.log(`textarea: ${textarea}`);
        if (textarea) {
            console.log(` text: ${text}`);
            textarea.value += text;
            getScenarioNumber().then(scenarioNumber => {
                console.log(scenarioNumber);                        
                updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
            });
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
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 92, 'numbersBtn');
                    break;
                case 'qwertBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 94, 'qwertBtn');
                    break;
                case 'yuiopBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 94, 'yuiopBtn');
                    break;
                case 'asdBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 96, 'asdBtn');
                    break;
                case 'fghBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 96, 'fghBtn');
                    break;
                case 'jklBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 96, 'jklBtn');
                    break;
                case 'upperCaseBtn':
                    break;
                case 'zxcBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 96, 'zxcBtn');
                    break;
                case 'vbnmBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 95, 'vbnmBtn');
                    break;
                case 'enterBtn':
                    textarea.value += '\n';
                    getScenarioNumber().then(scenarioNumber => {
                        console.log(scenarioNumber);                        
                        updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
                    });
                    break;
                case 'symbolsBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 90, 'symbolsBtn');
                    break;
                case 'dotComBtn':
                    textarea.value += '.com';
                    getScenarioNumber().then(scenarioNumber => {
                        console.log(scenarioNumber);                        
                        updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
                    });
                    break;
                case 'spaceBtn':
                    textarea.value += ' ';
                    getScenarioNumber().then(scenarioNumber => {
                        console.log(scenarioNumber);                        
                        updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
                    });
                    break;
                case 'keyboardSendBtn':
                    break;
                case 'arrowKeysBtn':                    
                    break;
                case 'backspaceBtn':
                    textarea.value = textarea.value.slice(0, -1);
                    getScenarioNumber().then(scenarioNumber => {
                        console.log(scenarioNumber);                        
                        updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
                    });
                    break;
                case 'autoCompleteBtn':
                    break;
            }
        });
    });
}

let corpusWords = null;

async function loadCorpus() {
    if (corpusWords) return corpusWords;
    const response = await fetch('../../../resources/corpus/en.csv');
    const text = await response.text();
    corpusWords = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return corpusWords;
}

async function isSuggestionAvailable() {
    if (!textarea) return false;
    const words = await loadCorpus();
    // Get the last word after the last whitespace
    const input = textarea.value;
    const lastWord = input.split(/\s+/).pop().toLowerCase();
    if (!lastWord) return false;
    return words.some(word => word.toLowerCase().startsWith(lastWord));
}

async function getScenarioNumber() {
    const textAreaPopulated = textarea.value.length > 0;
    const cursorAtStart = textarea.selectionStart === 0;
    const cursorAtEnd = textarea.selectionStart === textarea.value.length;
    const suggestionAvailable = await isSuggestionAvailable();

    if (!textAreaPopulated) {
        return 80; // Scenario: No text in search field
    }

    if (textAreaPopulated && suggestionAvailable && cursorAtEnd) {
        return 81; // Scenario: Text in search field, word suggestion available, cursor at end position
    }

    if (textAreaPopulated && cursorAtStart) { // && !suggestionAvailable. 
        // It doesn't matter if suggestion is available or not because the cursor is at the start position
        return 82; // Scenario: Text in search field, word suggestion unavailable, cursor at start position
    }

    if (textAreaPopulated && !suggestionAvailable && !cursorAtStart) {
        return 83; // Scenario: Text in search field, word suggestion unavailable, cursor NOT at start position
    }

    return null; // Default case if no scenario matches
}