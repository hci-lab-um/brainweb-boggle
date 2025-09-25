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
let elementTypeAttribute = null;
let maskOverlay = null; // Reference to the mask overlay

const INPUT_MASKS = {
    'date': 'dd/mm/yyyy',
    'time': 'hh:mm',
    'datetime-local': 'dd/mm/yyyy hh:mm',
    'month': 'mm yyyy',
    'week': 'ww yyyy',
    'tel': '',
    'number': '',
    'range': '',
};

ipcRenderer.on('keyboard-loaded', async (event, overlayData) => {
    try {
        ({ elementProperties, webpageBounds } = overlayData)

        const NUMPAD_REQUIRED_ELEMENTS = ['number', 'tel', 'date', 'datetime-local', 'month', 'time', 'week', 'range'];

        elementTypeAttribute = elementProperties.type ? elementProperties.type.toLowerCase() : null;
        console.log('Element type:', elementTypeAttribute);
        needsNumpad = NUMPAD_REQUIRED_ELEMENTS.includes(elementTypeAttribute);

        const alphaKeyboard = document.querySelector('.keyboard');
        const numericKeyboard = document.querySelector('.keyboard--numeric');

        if (needsNumpad) {
            setupNumericKeyboard(alphaKeyboard, numericKeyboard);
            handleRangeType(elementTypeAttribute);
            maskOverlay = setupInputMaskOverlay(elementTypeAttribute, INPUT_MASKS, inputField, elementProperties);
        } else {
            setupAlphaKeyboard(alphaKeyboard, numericKeyboard);
            inputField = document.querySelector('#textarea');
            setupPasswordAndAutoComplete(elementTypeAttribute);
            maskOverlay = null;
        }

        buttons = document.querySelectorAll('button');
        autoCompleteButton = document.getElementById('autoCompleteBtn');

        // Ensure inputField.value is always in the correct format for date-like types
        if (needsNumpad && ['date', 'month', 'time', 'datetime-local', 'week'].includes(elementTypeAttribute)) {
            inputField.value = elementProperties.value;
        } else {
            inputField.value = elementProperties.value;
        }

        // Prevent losing focus
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

// Function to apply mask to input
function applyInputMask(value, mask, type = '') {
    let maskedValue = '';
    let valIndex = 0;
    for (let i = 0; i < mask.length && valIndex < value.length; i++) {
        if (/[a-zA-Z]/.test(mask[i])) {
            let char = value[valIndex];
            // Validate based on position and type
            if (type === 'date' || type === 'datetime-local') {
                // DAY
                if (i === 0 && parseInt(char) > 3) { // If first digit of day is greater than 3, pad with zero
                    char = `0${char}`;
                    i += 1; // skips a digit because we padded with zero
                }
                if (i === 1 && maskedValue[0] === '3' && parseInt(char) > 1) char = '1'; // If greater than 31, set to 31

                // MONTH
                if (i === 3 && parseInt(char) > 1) { // If first digit of month is greater than 1, pad with zero
                    char = `0${char}`;
                    i += 1; // skips a digit because we padded with zero
                }
                if (i === 4 && maskedValue[3] === '1' && parseInt(char) > 2) char = '2'; // If greater than 12, set to 12

                // YEAR - no validation needed, just append

                if (i > 9) { // This is for datetime-local, after the date part
                    // HOUR
                    if (i === 11 && parseInt(char) > 2) { // If first digit of hour is greater than 2, pad with zero
                        char = `0${char}`;
                        i += 1; // skips a digit because we padded with zero
                    }
                    if (i === 12 && maskedValue[11] === '2' && parseInt(char) > 3) char = '3'; // If greater than 23, set to 23

                    // MINUTE
                    if (i === 14 && parseInt(char) > 5) { // If first digit of minute is greater than 5, pad with zero
                        char = `0${char}`;
                        i += 1; // skips a digit because we padded with zero
                    }
                    if (i === 15 && maskedValue[14] === '5' && parseInt(char) > 9) char = '9'; // If greater than 59, set to 59
                }
            } else if (type === 'time') {
                // HOUR
                if (i === 0 && parseInt(char) > 2) { // If first digit of hour is greater than 2, pad with zero
                    char = `0${char}`;
                    i += 1; // skips a digit because we padded with zero
                }
                if (i === 1 && maskedValue[0] === '2' && parseInt(char) > 3) char = '3'; // If greater than 23, set to 23

                // MINUTE
                if (i === 3 && parseInt(char) > 5) { // If first digit of minute is greater than 5, pad with zero
                    char = `0${char}`;
                    i += 1; // skips a digit because we padded with zero
                }
                if (i === 4 && maskedValue[2] === '5' && parseInt(char) > 9) char = '9'; // If greater than 59, set to 59
            } else if (type === 'month') {
                if (i === 0 && parseInt(char) > 1) { // If first digit of month is greater than 1, pad with zero
                    char = `0${char}`;
                    i += 1; // skips a digit because we padded with zero
                }
                if (i === 1 && maskedValue[0] === '1' && parseInt(char) > 2) char = '2'; // If greater than 12, set to 12
            } else if (type === 'week') {
                if (i === 0 && parseInt(char) > 5) { // If first digit of week is greater than 5, pad with zero
                    char = `0${char}`;
                    i += 1; // skips a digit because we padded with zero
                }
                if (i === 1 && maskedValue[0] === '5' && parseInt(char) > 3) char = '3'; // If greater than 53, set to 53
            }
            maskedValue += char;
            valIndex++;
        } else {
            maskedValue += mask[i];
        }
    }
    return maskedValue;
}

function setupNumericKeyboard(alphaKeyboard, numericKeyboard) {
    alphaKeyboard.style.display = 'none';
    numericKeyboard.style.display = '';
    inputField = document.querySelector('#numericTextarea');
    inputField.type = 'textarea';
}

function handleRangeType(elementTypeAttribute) {
    if (elementTypeAttribute === 'range') {
        document.getElementById('numericSymbolMinus').style.display = 'none';
        document.getElementById('numericSymbolPlus').style.display = 'none';
    }
}

function setupInputMaskOverlay(elementTypeAttribute, INPUT_MASKS, inputField, elementProperties) {
    let maskTemplate = INPUT_MASKS[elementTypeAttribute] || '';
    if (!maskTemplate) return null;

    let maskOverlay = document.createElement('div');
    maskOverlay.id = 'maskOverlay';
    maskOverlay.style.fontSize = window.getComputedStyle(inputField).fontSize;
    maskOverlay.style.width = inputField.offsetWidth + 'px';
    maskOverlay.style.height = inputField.offsetHeight + 'px';
    maskOverlay.classList.add('maskOverlay');

    inputField.parentNode.style.position = 'relative';
    inputField.parentNode.appendChild(maskOverlay);

    inputField.addEventListener('input', (e) => {
        let rawValue = e.target.value.replace(/\D/g, '');
        const maskedValue = applyInputMask(rawValue, maskTemplate, elementTypeAttribute);
        inputField.value = maskedValue;

        // Show remaining mask with placeholders
        const paddedMask = applyInputMask(rawValue + '_'.repeat(maskTemplate.length), maskTemplate, elementTypeAttribute);
        maskOverlay.textContent = paddedMask;

        getScenarioNumber().then(scenarioNumber => {
            updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
        });
    });

    // Initial mask display
    let initialValue = elementProperties.value || '';
    let initialRawValue = getInitialRawValue(elementTypeAttribute, initialValue);

    let initialMaskedValue = applyInputMask(initialRawValue, maskTemplate);
    inputField.value = initialMaskedValue;

    // Updating the textarea's value property for correct visible value
    if (["date", "month", "time", "datetime-local", "week"].includes(elementTypeAttribute)) {
        elementProperties.value = initialMaskedValue;
    }

    if (initialMaskedValue.length === maskTemplate.length && initialMaskedValue.replace(/[^a-zA-Z0-9]/g, '').length === maskTemplate.replace(/[^a-zA-Z]/g, '').length) {
        maskOverlay.textContent = initialMaskedValue;
    } else if (!initialMaskedValue) {
        maskOverlay.textContent = maskTemplate;
    } else {
        const paddedMask = applyInputMask(initialRawValue + '_'.repeat(maskTemplate.length), maskTemplate);
        maskOverlay.textContent = paddedMask;
    }
    return maskOverlay;
}

function getInitialRawValue(elementTypeAttribute, initialValue) {
    if (elementTypeAttribute === 'date' && initialValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = initialValue.split('-');
        return day + month + year;
    } else if (elementTypeAttribute === 'month' && initialValue.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = initialValue.split('-');
        return month + year;
    } else if (elementTypeAttribute === 'time' && initialValue.match(/^\d{2}:\d{2}$/)) {
        const [hour, minute] = initialValue.split(':');
        return hour + minute;
    } else if (elementTypeAttribute === 'datetime-local' && initialValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        const [datePart, timePart] = initialValue.split('T');
        const [year, month, day] = datePart.split('-');
        const [hour, minute] = timePart.split(':');
        return day + month + year + hour + minute;
    } else if (elementTypeAttribute === 'week' && initialValue.match(/^\d{4}-W\d{2}$/)) {
        const [year, week] = initialValue.split('-W');
        return week + year;
    } else {
        return initialValue.replace(/\D/g, '');
    }
}

function setupAlphaKeyboard(alphaKeyboard, numericKeyboard) {
    alphaKeyboard.style.display = '';
    numericKeyboard.style.display = 'none';
}

function setupPasswordAndAutoComplete(elementTypeAttribute) {
    const passwordToggleBtn = document.getElementById('showHidePasswordBtn');
    const autoCompleteBtn = document.getElementById('autoCompleteBtn');

    if (elementTypeAttribute === "password") {
        const oldTextarea = document.getElementById('textarea');
        if (oldTextarea) {
            const inputElement = document.createElement('input');
            inputElement.type = 'password';
            inputElement.id = 'textarea';
            inputElement.className = 'textarea textarea--numeric';
            inputElement.autocomplete = 'off';
            oldTextarea.parentNode.replaceChild(inputElement, oldTextarea);
            inputField = inputElement;
        }
        passwordToggleBtn.style.display = 'block';
        autoCompleteBtn.style.display = 'none';
    } else {
        passwordToggleBtn.style.display = 'none';
        autoCompleteBtn.style.display = 'block';
    }
}

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

    await ipcRenderer.invoke('keyboardOverlay-type-nutjs', insertText);

    if (maskOverlay && ['date', 'time', 'month', 'datetime-local', 'week'].includes(elementTypeAttribute)) {
        const raw = inputField.value.replace(/\D/g, '');
        const mask = INPUT_MASKS[elementTypeAttribute];
        const masked = applyInputMask(raw, mask, elementTypeAttribute);
        inputField.value = masked;

        const padded = applyInputMask(raw + '_'.repeat(mask.length), mask, elementTypeAttribute);
        maskOverlay.textContent = padded;
    }

    // Update mask overlay if present and the input field is empty
    if (maskOverlay && inputField.value === '') {
        const maskTemplate = INPUT_MASKS[elementTypeAttribute] || '';
        maskOverlay.textContent = maskTemplate;
    }

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
            // Disable the button immediately to prevent multiple clicks
            button.disabled = true;
            setTimeout(() => { button.disabled = false; }, 1500);

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
                        if (!needsNumpad) updateAutoCompleteButton();

                        // Update mask overlay if present
                        if (maskOverlay) {
                            const maskTemplate = INPUT_MASKS[elementTypeAttribute] || '';
                            maskOverlay.textContent = maskTemplate;
                        }

                        getScenarioNumber().then(scenarioNumber => {
                            updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
                        });

                        inputField.focus();
                        break;
                    case 'keyboardSendBtn':
                    case 'numericKeyboardSendBtn':
                        let input = inputField.value.trim();
                        if (!input) break;

                        // For date/time/month types, replace spaces with right arrow before sending
                        let sendValue = input;
                        if (needsNumpad && ['date', 'month', 'time', 'datetime-local', 'week'].includes(elementTypeAttribute)) {
                            sendValue = input.replace(/ /g, '→');
                        }

                        if (elementProperties.id === 'omnibox') {
                            let processedInput = await processUrlInput(input)
                            ipcRenderer.send('url-load', processedInput);
                        } else if (elementProperties.id === 'findInPage') {
                            ipcRenderer.send('text-findInPage', input);
                        } else if (elementTypeAttribute === 'range') {
                            ipcRenderer.send('rangeElement-setValue', input, elementProperties.boggleId);
                        } else {
                            const coordinates = getCenterCoordinates(elementProperties, webpageBounds);

                            ipcRenderer.send('mouse-click-nutjs', coordinates);
                            ipcRenderer.send('keyboard-type-nutjs', sendValue, needsNumpad, elementTypeAttribute);
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
                    case 'showHidePasswordBtn':
                        const showHidePasswordBtn = document.getElementById('showHidePasswordBtn');
                        const icon = showHidePasswordBtn.querySelector('.keyboard__key i');

                        if (inputField.type === 'password') {
                            inputField.type = 'text';
                            icon.innerText = 'visibility_off';
                        } else {
                            inputField.type = 'password';
                            icon.innerText = 'visibility';
                        }

                        getScenarioNumber().then(scenarioNumber => {
                            updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
                        });

                        inputField.focus();
                        break;

                    // The following are the keys inside the NUMERIC keyboard
                    case 'numericSymbolsBtn':
                        if (elementTypeAttribute !== 'range') ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 96, 'numericSymbolsBtn');
                        else updateNumericTextareaAtCursor('.');
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