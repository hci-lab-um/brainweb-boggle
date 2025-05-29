const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const fs = require('original-fs')
const path = require('path')

let buttons = [];
let textarea;
let corpusWords = null;
let isUpperCase = false;
let suggestion = '';
let wrapper;

ipcRenderer.on('keyboard-loaded', async (event, overlayData) => {
    try {
        const { scenarioId } = overlayData;

        buttons = document.querySelectorAll('button');
        textarea = document.querySelector('#textarea');
        wrapper = document.getElementById('textarea-autocomplete');

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
                ipcRenderer.send('keyboard-arrow', 'home');
                break;
            case 'keyboard_arrow_up':
                ipcRenderer.send('keyboard-arrow', 'up');
                break;
            case 'last_page':
                ipcRenderer.send('keyboard-arrow', 'end');
                break;
            case 'keyboard_arrow_left':
                ipcRenderer.send('keyboard-arrow', 'left');
                break;
            case 'keyboard_arrow_down':
                ipcRenderer.send('keyboard-arrow', 'down');
                break;
            case 'keyboard_arrow_right':
                ipcRenderer.send('keyboard-arrow', 'right');
                break;
        }

        updateGhostText();
        let scenarioNumber = await getScenarioNumber();
        await updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
        textarea.focus();
    } catch (error) {
        console.error('Error in textarea-moveCursor handler:', error);
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
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    insertText = isUpperCase ? insertText.toUpperCase() : insertText;

    if (insertText) {
        textarea.value = value.slice(0, start) + insertText + value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
    } else if (start === end && start > 0) {
        // No selection, remove character before cursor
        textarea.value = value.slice(0, start - 1) + value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start - 1;
    }

    updateGhostText();

    getScenarioNumber().then(scenarioNumber => {
        updateScenarioId(scenarioNumber, buttons, ViewNames.KEYBOARD);
    });

    textarea.focus();
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
    if (!textarea || textarea.selectionStart !== textarea.value.length) return false;
    const words = await loadCorpus();
    // Get the last word after the last whitespace
    const input = textarea.value;
    const lastWord = input.split(/\s+/).pop().toLowerCase();
    if (!lastWord) return false;
    return words.some(word => word.toLowerCase().startsWith(lastWord));
}

// Get suggestion for the last word
function getSuggestion(partialWord, corpus) {
    if (!partialWord) return '';
    partialWord = partialWord.toLowerCase();
    const match = corpus.find(word => word.startsWith(partialWord) && word !== partialWord);
    return match ? match.slice(partialWord.length) : '';
}

// Sync ghost text with textarea input
async function updateGhostText() {
    const text = textarea.value;
    const words = await loadCorpus();
    const parts = text.split(/\s+/);
    const lastWord = parts.pop();
    suggestion = getSuggestion(lastWord, words);

    // Show suggestion only if cursor is at end
    if (textarea.selectionStart === textarea.value.length && suggestion) {
        // If isUpperCase, show suggestion in caps
        const displaySuggestion = isUpperCase ? suggestion.toUpperCase() : suggestion;
        // Replace each character in the textarea with a space (except newlines)
        let ghost = '';
        let textIdx = 0;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') {
                ghost += '\n';
            } else {
                ghost += ' ';
            }
        }
        wrapper.innerHTML = ghost + `<span style="color:#aaa;">${displaySuggestion}</span>`;
    } else {
        wrapper.textContent = '';
    }
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
        console.error("Failed to fetch TLD list:", error.message);
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
                    console.warn(`Invalid TLD detected: ${urlObject.hostname}`);
                    url = `https://www.google.com/search?q=${encodeURIComponent(unprocessedInput)}`;
                }
            }
        } else {
            // Otherwise, treat it as a search query
            url = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
        }

        return url;
    } catch (error) {
        console.error("Error in browseToUrl:", error.message);
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
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.KEYBOARD);
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
                        updateGhostText();
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
                    case 'dotComBtn':
                        updateTextareaAtCursor('.com');
                        break;
                    case 'keyboardSendBtn':
                        const input = textarea.value.trim();
                        if (!input) break;

                        let processedInput = await processUrlInput(input)
                        console.log(processedInput);

                        ipcRenderer.send('url-load', processedInput);
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.KEYBOARD);
                        break;
                    case 'arrowKeysBtn':
                        ipcRenderer.send('overlay-create', ViewNames.KEYBOARD_KEYS, 93, 'arrowKeysBtn');
                        break;
                    case 'backspaceBtn':
                        updateTextareaAtCursor();
                        break;
                    case 'autoCompleteBtn':
                        if (suggestion && textarea.selectionStart === textarea.value.length) {
                            updateTextareaAtCursor(suggestion);
                            suggestion = '';
                        }
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        });
    });
}