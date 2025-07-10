const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const fs = require('original-fs')
const path = require('path')
const logger = require('../main/modules/logger');
const { getCenterCoordinates } = require('../utils/utilityFunctions');

let buttons = [];
let inputField;
let corpusWords = null;
let isUpperCase = false;
let elementProperties;      // This is set when the keyboard is loaded
let webpageBounds = null;   // This is set when the keyboard is loaded
let suggestion = '';
let autoCompleteButton;
let needsNumpad;
let inputFieldValue = '';

ipcRenderer.on('keyboard-loaded', async (event, overlayData) => {
    try {
        ({ elementProperties, webpageBounds } = overlayData)

        const NUMPAD_REQUIRED_ELEMENTS = ['number', 'tel', 'date', 'datetime-local', 'month', 'time', 'week']; // revise these
        const elementTypeAttribute = elementProperties.type ? elementProperties.type.toLowerCase() : null;
        console.log('Element type:', elementTypeAttribute);
        needsNumpad = NUMPAD_REQUIRED_ELEMENTS.indexOf(elementTypeAttribute) !== -1;

        const alphaKeyboard = document.querySelector('.keyboard');
        const numericKeyboard = document.querySelector('.keyboard--numeric');

        if (needsNumpad) {
            alphaKeyboard.style.display = 'none';
            numericKeyboard.style.display = '';
            inputField = document.querySelector('#numericTextarea');
            inputField.type = elementTypeAttribute;

            // Checks if the element type is "month" and display the month name next to the key
            if (elementTypeAttribute === "month") {
                const monthNames = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];

                const numKeys = document.querySelectorAll('.numKey');
                numKeys.forEach(keyElement => {
                    // Parses the key as a number and uses it to get the month name
                    const key = keyElement.textContent.trim();                    
                    const monthIndex = parseInt(key, 10) - 1; // Subtract 1 because months are 0-indexed

                    // Checks if the key is a valid month index (1-12)
                    if (!isNaN(monthIndex) && monthIndex >= 0 && monthIndex < 12) {
                        keyElement.textContent = `${key} (${monthNames[monthIndex]})`;
                    }
                });
            }
        } else {
            alphaKeyboard.style.display = '';
            numericKeyboard.style.display = 'none';
            inputField = document.querySelector('#textarea');
        }

        if (needsNumpad) {
            inputField.addEventListener('input', (e) => {
                console.log('Input field value changed:', e.target.value);
                console.log('inputfield.value:', inputField.value);
                inputFieldValue = e.target.value;

                getScenarioNumber().then(scenarioNumber => {
                    updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
                });
            });
        }

        buttons = document.querySelectorAll('button');
        autoCompleteButton = document.getElementById('autoCompleteBtn');


        inputField.value = elementProperties.value;
        // Ensuring textarea stays focused by refocusing it if focus is lost
        inputField.addEventListener("focusout", (event) => {
            setTimeout(() => inputField.focus(), 0);
        });

        updateAutoCompleteButton();

        getScenarioNumber().then(async scenarioNumber => {
            await updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
            attachEventListeners();
        });
    } catch (error) {
        logger.error('Error in keyboard-loaded handler:', error);
    }
});

ipcRenderer.on('scenarioId-update', async (event, scenarioId) => {
    try {
        await updateScenarioId(scenarioId, buttons, ViewNames.KEYBOARD);
        ipcRenderer.send('scenarioId-update-complete', scenarioId);
    } catch (error) {
        logger.error('Error in scenarioId-update handler:', error);
    }
});

ipcRenderer.on('selectedButton-click', (event, buttonId) => {
    try {
        document.getElementById(buttonId).click();
    } catch (error) {
        logger.error('Error in selectedButton-click handler:', error);
    }
});

ipcRenderer.on('textarea-populate', (event, text) => {
    try {
        if (!needsNumpad) updateTextareaAtCursor(text);
        else updateNumericTextareaAtCursor(text);
    } catch (error) {
        logger.error('Error in textarea-populate handler:', error);
    }
});

ipcRenderer.on('textarea-moveCursor', async (event, iconName) => {
    try {
        switch (iconName) {
            case 'first_page':
                await ipcRenderer.invoke('keyboard-arrow-nutjs', 'home');
                break;
            case 'keyboard_arrow_up':
                await ipcRenderer.invoke('keyboard-arrow-nutjs', 'up');
                break;
            case 'last_page':
                await ipcRenderer.invoke('keyboard-arrow-nutjs', 'end');
                break;
            case 'keyboard_arrow_left':
                await ipcRenderer.invoke('keyboard-arrow-nutjs', 'left');
                break;
            case 'keyboard_arrow_down':
                await ipcRenderer.invoke('keyboard-arrow-nutjs', 'down');
                break;
            case 'keyboard_arrow_right':
                await ipcRenderer.invoke('keyboard-arrow-nutjs', 'right');
                break;
        }

        updateAutoCompleteButton();
        let scenarioNumber = await getScenarioNumber();
        await updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
        inputField.focus();
    } catch (error) {
        logger.error('Error in textarea-moveCursor handler:', error);
    }
});

function toggleLetterCase(toUpper) {
    const letterButtonIds = [
        'qwertBtn', 'yuiopBtn', 'asdBtn', 'fghBtn', 'jklBtn', 'zxcBtn', 'vbnmBtn'
    ];

    letterButtonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            const spans = button.querySelectorAll('.keyboard__key');
            spans.forEach(span => {
                const text = span.textContent;
                if (text.length === 1 && /^[a-zA-Z]$/.test(text)) {
                    span.textContent = toUpper ? text.toUpperCase() : text.toLowerCase();
                }
            });
        }
    });
}

function updateTextareaAtCursor(insertText = null) {
    if (!inputField) return;
    const start = inputField.selectionStart;
    const end = inputField.selectionEnd;
    const value = inputField.value;
    insertText = isUpperCase ? insertText.toUpperCase() : insertText;

    if (insertText) {
        inputField.value = value.slice(0, start) + insertText + value.slice(end);
        inputField.selectionStart = inputField.selectionEnd = start + insertText.length;
    } else if (start === end && start > 0) {
        // No selection, remove character before cursor
        inputField.value = value.slice(0, start - 1) + value.slice(end);
        inputField.selectionStart = inputField.selectionEnd = start - 1;
    }

    if (!needsNumpad) updateAutoCompleteButton();

    getScenarioNumber().then(scenarioNumber => {
        updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
    });

    inputField.focus();
}

async function updateNumericTextareaAtCursor(insertText = null) {
    if (!inputField) return;

    await ipcRenderer.invoke('numericKeyboard-type-nutjs', insertText);

    getScenarioNumber().then(scenarioNumber => {
        updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
    });

    inputField.focus();
}

async function loadCorpus() {
    if (corpusWords) return corpusWords;
    const response = await fetch('../../../resources/corpus/en.csv');
    const text = await response.text();
    corpusWords = text
        .split(/\r?\n/)
        .map(line => line.split(',')[0].trim().toLowerCase()) // get only the word
        .filter(word => /^[a-z]+$/.test(word)); // remove junk lines
    return corpusWords;
}

async function isSuggestionAvailable() {
    // If the textarea is empty or the cursor is not at the end, there will be no suggestion available
    if (!inputField || inputField.selectionStart !== inputField.value.length) return false;
    const words = await loadCorpus();
    // Get the last word after the last whitespace
    const input = inputField.value;
    const lastWord = input.split(/\s+/).pop().toLowerCase();
    if (!lastWord) return false;
    return words.some(word => word.toLowerCase().startsWith(lastWord) && word.toLowerCase() !== lastWord);
}

// Get suggestion for the last word
function getSuggestion(partialWord, corpus) {
    if (!partialWord) return '';
    partialWord = partialWord.toLowerCase();
    const match = corpus.find(word => word.startsWith(partialWord) && word !== partialWord);
    return match ? match.slice(partialWord.length) : '';
}

async function updateAutoCompleteButton() {
    const text = inputField.value;
    const words = await loadCorpus();
    const parts = text.split(/\s+/);
    const lastWord = parts.pop();
    suggestion = getSuggestion(lastWord, words);

    if (inputField.selectionStart === inputField.value.length && suggestion && lastWord) {
        // Display the complete suggested word, not just the completion part
        const fullSuggestedWord = lastWord + suggestion;
        const displaySuggestion = isUpperCase ? fullSuggestedWord.toUpperCase() : fullSuggestedWord;
        const buttonSpan = autoCompleteButton.querySelector('.keyboard__key');
        if (buttonSpan) {
            buttonSpan.textContent = displaySuggestion;
        }
    } else {
        const buttonSpan = autoCompleteButton.querySelector('.keyboard__key');
        if (buttonSpan) {
            buttonSpan.textContent = 'AUTO';
        }
    }
}

async function getScenarioNumber() {
    if (needsNumpad) {
        return 84;

    } else {
        const suggestionAvailable = await isSuggestionAvailable();
        const textAreaPopulated = inputField.value.toString().length > 0;
        const cursorAtStart = inputField.selectionStart === 0;
        const cursorAtEnd = inputField.selectionStart === inputField.value.length;

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

        logger.error("No matching scenario");

    }
}

async function fetchValidTLDs() {
    try {
        const tldFilePath = path.join(__dirname, '../../resources/validTLDs.json');

        // Checking if TLDs are already stored in a file
        if (fs.existsSync(tldFilePath)) {
            const storedTLDs = fs.readFileSync(tldFilePath, 'utf-8');
            return new Set(JSON.parse(storedTLDs));
        }
        return new Set();
    } catch (error) {
        logger.error("Failed to fetch TLD list:", error.message);
        return new Set();
    }
}

async function isValidTLD(domain, validTLDs) {
    try {
        const domainParts = domain.split(".");
        const tld = domainParts[domainParts.length - 1].toLowerCase();
        return validTLDs.has(tld);
    } catch (error) {
        return false;
    }
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (error) {
        return false;
    }
}

function isLocalOrIP(hostname) {
    try {
        const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^\[[a-fA-F0-9:]+\]$/;
        const LOCALHOST = "localhost";

        return ipv4Regex.test(hostname) || ipv6Regex.test(hostname) || hostname.toLowerCase() === LOCALHOST;
    } catch (error) {
        logger.error("Error in isLocalOrIP:", error.message);
        return false;
    }
}

async function processUrlInput(input) {
    try {
        const VALID_TLDs = await fetchValidTLDs();
        const URL_REGEX = /^(?:(?:https?:\/\/)?((?:[\w-]+\.)+[a-zA-Z]{2,})(?::\d+)?(?:[\w.,@?^=%&:/~+#-]*)?)$/
        const FILE_PATH_REGEX = /^(?:[a-zA-Z]:\\(?:[^\\\/:*?"<>|\r\n]+\\)*[^\\\/:*?"<>|\r\n]*|\/(?:[^\\\/:*?"<>|\r\n]+\/)*[^\\\/:*?"<>|\r\n]*)$/;
        let url = '';
        let unprocessedInput = input;

        // If input does NOT start with http/https but looks like a valid domain, prepend "https://"
        if (!input.startsWith("http") && (URL_REGEX.test(input) || isLocalOrIP(input))) {
            input = `https://${input}`;
        }

        if (isValidUrl(input)) {
            let urlObject = new URL(input);
            console.log(urlObject);
            let pathname = urlObject.pathname;

            if (urlObject.protocol === "http:") {
                urlObject.protocol = "https:";
            }

            if (urlObject.protocol === "file:" && pathname.startsWith("/")) {
                pathname = pathname.substring(1); // removing the first forward slash
            }

            // The new URL(input) does not validate the URL strictly, — it just attempts to parse it, hence regex is used to validate the URL more strictly
            // Note: FILE_PATH_REGEX.test(input.replace(/\//g, '\\')) is used to recheck the input with forward slashes replaced with backslashes
            if (URL_REGEX.test(urlObject.hostname) || FILE_PATH_REGEX.test(pathname) || FILE_PATH_REGEX.test(pathname.replace(/\//g, '\\')) || isLocalOrIP(urlObject.hostname)) {
                url = urlObject.toString();
            } else {
                url = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
            }

            // If the url has a TLD, check if it is found in the list of valid TLDs
            if (!isLocalOrIP(urlObject.hostname)) {
                // If TLD is invalid, treat it as a search query
                if (!(await isValidTLD(urlObject.hostname, VALID_TLDs))) {
                    logger.warn(`Invalid TLD detected: ${urlObject.hostname}`);
                    url = `https://www.google.com/search?q=${encodeURIComponent(unprocessedInput)}`;
                }
            }
        } else {
            // Otherwise, treat it as a search query
            url = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
        }

        return url;
    } catch (error) {
        logger.error("Error in browseToUrl:", error.message);
    }
}

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            addButtonSelectionAnimation(button);
            const buttonId = button.getAttribute('id');

            setTimeout(async () => {
                // The only button that should not stop the manager is the upperCaseBtn
                if (buttonId !== 'upperCaseBtn') await stopManager();

                switch (buttonId) {
                    case "closeKeyboardBtn":
                    case "numericCloseKeyboardBtn":
                        await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.KEYBOARD);
                        break;
                    case 'numbersBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 92, 'numbersBtn', isUpperCase);
                        break;
                    case 'qwertBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 94, 'qwertBtn', isUpperCase);
                        break;
                    case 'yuiopBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 94, 'yuiopBtn', isUpperCase);
                        break;
                    case 'asdBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 96, 'asdBtn', isUpperCase);
                        break;
                    case 'fghBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 96, 'fghBtn', isUpperCase);
                        break;
                    case 'jklBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 96, 'jklBtn', isUpperCase);
                        break;
                    case 'upperCaseBtn':
                        isUpperCase = !isUpperCase;
                        let span = button.querySelector('.keyboard__key');
                        span.classList.toggle("keyboard__key--active", isUpperCase);
                        toggleLetterCase(isUpperCase);
                        updateAutoCompleteButton();
                        break;
                    case 'zxcBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 96, 'zxcBtn', isUpperCase);
                        break;
                    case 'vbnmBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 95, 'vbnmBtn', isUpperCase);
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
                    case 'clearAllBtn':
                    case 'numericClearAllBtn':
                        inputField.value = '';
                        inputFieldValue = '';
                        if (!needsNumpad) updateAutoCompleteButton();

                        getScenarioNumber().then(scenarioNumber => {
                            updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
                        });

                        inputField.focus();
                        break;
                    case 'keyboardSendBtn':
                    case 'numericKeyboardSendBtn':
                        const input = inputField.value.trim();
                        if (!input) break;

                        if (elementProperties.id === 'omnibox') {
                            let processedInput = await processUrlInput(input)
                            ipcRenderer.send('url-load', processedInput);
                        } else if (elementProperties.id === 'findInPage') {
                            ipcRenderer.send('text-findInPage', input);
                        } else {
                            const coordinates = getCenterCoordinates(elementProperties, webpageBounds);

                            ipcRenderer.send('mouse-click-nutjs', coordinates);
                            ipcRenderer.send('keyboard-type-nutjs', input);
                        }

                        ipcRenderer.send('overlay-close', ViewNames.KEYBOARD);
                        break;
                    case 'arrowKeysBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 93, 'arrowKeysBtn');
                        break;
                    case 'numericArrowKeysBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 93, 'numericArrowKeysBtn');
                        break;
                    case 'backspaceBtn':
                        updateTextareaAtCursor();
                        break;
                    case 'autoCompleteBtn':
                        if (suggestion && inputField.selectionStart === inputField.value.length) {
                            updateTextareaAtCursor(suggestion);
                            suggestion = '';
                        }
                        break;

                    // The following are the keys inside the NUMERIC keyboard

                    case 'numericSymbolsBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 96, 'numericSymbolsBtn');
                        break;
                    case 'numericBackspaceBtn':
                        updateNumericTextareaAtCursor('backspace');
                        break;
                    case 'numericSpaceBtn':
                        updateNumericTextareaAtCursor('space');
                        break;
                    case 'oneBtn':
                        updateNumericTextareaAtCursor('1');
                        break;
                    case 'twoBtn':
                        updateNumericTextareaAtCursor('2');
                        break;
                    case 'threeBtn':
                        updateNumericTextareaAtCursor('3');
                        break;
                    case 'fourBtn':
                        updateNumericTextareaAtCursor('4');
                        break;
                    case 'fiveBtn':
                        updateNumericTextareaAtCursor('5');
                        break;
                    case 'sixBtn':
                        updateNumericTextareaAtCursor('6');
                        break;
                    case 'sevenBtn':
                        updateNumericTextareaAtCursor('7');
                        break;
                    case 'eightBtn':
                        updateNumericTextareaAtCursor('8');
                        break;
                    case 'nineBtn':
                        updateNumericTextareaAtCursor('9');
                        break;
                    case 'zeroBtn':
                        updateNumericTextareaAtCursor('0');
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        });
    });
}