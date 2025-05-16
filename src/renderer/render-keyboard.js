const { ipcRenderer } = require('electron')
const { ViewNames } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');

let buttons = [];
let textarea;
let corpusWords = null;

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
        updateTextareaAtCursor(text);
    } catch (error) {
        console.error('Error in textarea-populate handler:', error);
    }
});

ipcRenderer.on('textarea-moveCursor', async (event, iconName) => {
    try {
        switch (iconName) {
            case 'first_page':
                textarea.selectionStart = 0;
                textarea.selectionEnd = 0;
                break;
            case 'keyboard_arrow_up':
                textarea.selectionStart = textarea.selectionStart - 1;
                textarea.selectionEnd = textarea.selectionStart;
                break;
            case 'last_page':
                textarea.selectionStart = textarea.value.length;
                textarea.selectionEnd = textarea.value.length;
                break;
            case 'keyboard_arrow_left':
                if (textarea.selectionStart > 0) {
                    textarea.selectionStart -= 1;
                    textarea.selectionEnd = textarea.selectionStart;
                }
                break;
            case 'keyboard_arrow_down':
                if (textarea.selectionStart < textarea.value.length) {
                    textarea.selectionStart += 1;
                    textarea.selectionEnd = textarea.selectionStart;
                }
                break;
            case 'keyboard_arrow_right':
                if (textarea.selectionStart < textarea.value.length) {
                    textarea.selectionStart += 1;
                    textarea.selectionEnd = textarea.selectionStart;
                }
                break;
        }

        let scenarioNumber = await getScenarioNumber();
        await updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
        textarea.focus();
    } catch (error) {
        console.error('Error in textarea-moveCursor handler:', error);
    }
});

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            const buttonId = button.getAttribute('id');

            await stopManager();

            switch (buttonId) {
                case "keyboardCloseBtn":
                    ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.KEYBOARD);
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
                case 'symbolsBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 90, 'symbolsBtn');
                    break;
                case 'spaceBtn':
                    updateTextareaAtCursor(' ');
                    break;
                case 'enterBtn':
                    updateTextareaAtCursor('\n');
                    break;
                case 'dotComBtn':
                    updateTextareaAtCursor('.com');
                    break;
                case 'keyboardSendBtn':
                    break;
                case 'arrowKeysBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 93, 'arrowKeysBtn');
                    break;
                case 'backspaceBtn':
                    updateTextareaAtCursor();
                    break;
                case 'autoCompleteBtn':
                    break;
            }
        });
    });
}

function updateTextareaAtCursor(insertText = null) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    if (insertText) {
        textarea.value = value.slice(0, start) + insertText + value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
    } else if (start === end && start > 0) {
        // No selection, remove character before cursor
        textarea.value = value.slice(0, start - 1) + value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start - 1;
    }

    getScenarioNumber().then(scenarioNumber => {
        updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
    });

    textarea.focus();
}

async function loadCorpus() {
    if (corpusWords) return corpusWords;
    const response = await fetch('../../../resources/corpus/en.csv');
    const text = await response.text();
    corpusWords = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return corpusWords;
}

async function isSuggestionAvailable() {
    // If the textarea is empty or the cursor is not at the end, there will be no suggestion available
    if (!textarea || textarea.selectionStart !== textarea.value.length) return false;
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

    if (textAreaPopulated && !suggestionAvailable && cursorAtStart) {
        // It doesn't matter if suggestion is available or not because the cursor is at the start position
        return 82; // Scenario: Text in search field, word suggestion unavailable, cursor at start position
    }

    if (textAreaPopulated && !suggestionAvailable && !cursorAtStart) {
        return 83; // Scenario: Text in search field, word suggestion unavailable, cursor NOT at start position
    }

    console.error("No matching scenario");
}