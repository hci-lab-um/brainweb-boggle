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
        insertAtCursor(text);
    } catch (error) {
        console.error('Error in textarea-populate handler:', error);
    }
});

ipcRenderer.on('textarea-moveCursor', async (event, iconName) => {
    // await stopManager();
    try {
        console.log("Icon name:", iconName);
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
                console.log("Left arrow pressed");
                if (textarea.selectionStart > 0) {
                    console.log("Left arrow pressed INSIDE IF");
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

        // getScenarioNumber().then(scenarioNumber => () => {
        //     console.log("DHANLAN");
        //     console.log(scenarioNumber);
        //     updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
        // });

        let scenarioNumber = await getScenarioNumber();
        console.log("DHANLAN");
        console.log(scenarioNumber);
        console.log("buttons", buttons);
        await updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);

        // textarea.focus();
    } catch (error) {
        console.error('Error in textarea-moveCursor handler:', error);
    }
});

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            console.log(`Button ${index + 1} clicked:`, button.textContent.trim());
            const buttonId = button.getAttribute('id');

            await stopManager();

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
                case 'symbolsBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 90, 'symbolsBtn');
                    break;
                case 'spaceBtn':
                    insertAtCursor(' ');
                    break;
                case 'enterBtn':
                    insertAtCursor('\n');
                    break;
                case 'dotComBtn':
                    insertAtCursor('.com');
                    break;
                case 'keyboardSendBtn':
                    break;
                case 'arrowKeysBtn':
                    ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 93, 'arrowKeysBtn');
                    break;
                case 'backspaceBtn':
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const value = textarea.value;

                    if (start === end && start > 0) {
                        // No selection, remove character before cursor
                        textarea.value = value.slice(0, start - 1) + value.slice(end);
                        textarea.selectionStart = textarea.selectionEnd = start - 1;
                    }
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

function insertAtCursor(insertText) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    textarea.value = value.slice(0, start) + insertText + value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + insertText.length;

    getScenarioNumber().then(scenarioNumber => {
        console.log(scenarioNumber);
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

    console.log('cursor at start', cursorAtStart);
    console.log('cursor at end', cursorAtEnd);
    console.log('text area populated', textAreaPopulated);
    console.log('suggestion available', suggestionAvailable);

    if (!textAreaPopulated) {
        console.log(`Scenario ID : 80`);
        return 80; // Scenario: No text in search field
    }

    if (textAreaPopulated && suggestionAvailable && cursorAtEnd) {
        console.log(`Scenario ID : 81`);
        return 81; // Scenario: Text in search field, word suggestion available, cursor at end position
    }

    if (textAreaPopulated && !suggestionAvailable && cursorAtStart) {
        console.log(`Scenario ID : 82`);
        // It doesn't matter if suggestion is available or not because the cursor is at the start position
        return 82; // Scenario: Text in search field, word suggestion unavailable, cursor at start position
    }

    if (textAreaPopulated && !suggestionAvailable && !cursorAtStart) {
        console.log(`Scenario ID : 83`);
        return 83; // Scenario: Text in search field, word suggestion unavailable, cursor NOT at start position
    }

    console.error("No matching scenario");
}