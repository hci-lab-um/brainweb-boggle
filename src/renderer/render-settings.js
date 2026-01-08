const { ipcRenderer, View } = require('electron')
const { ViewNames, CssConstants, Settings, Stimuli } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const logger = require('../main/modules/logger');
const { createPopup, toBoolean } = require('../utils/utilityFunctions');

let buttons = [];
let settingsContentContainer = null;
let homeUrl = '';
let keyboardLayoutInUse = '';
let headsetInUse = '';
let connectionTypeInUse = '';
let closeSettingsButton = null;
let adaptiveSwitchInUse;
let stimuliInUse = '';
let updateCredentialsBtn = null;

ipcRenderer.on('settings-loaded', async (event, overlayData) => {
    try {
        const { scenarioId, buttonId } = overlayData;

        buttons = document.querySelectorAll('button');
        settingsContentContainer = document.querySelector('.settingsContent');
        closeSettingsButton = document.getElementById('closeSettingsBtn');
        homeUrl = overlayData.settingsObject.homeUrl || '';
        keyboardLayoutInUse = overlayData.settingsObject.keyboardLayout || '';
        headsetInUse = overlayData.settingsObject.headsetInUse || '';
        connectionTypeInUse = overlayData.settingsObject.connectionTypeInUse || '';
        adaptiveSwitchInUse = toBoolean(overlayData.settingsObject.adaptiveSwitchInUse);
        stimuliInUse = overlayData.settingsObject.stimuliInUse || '';

        setCloseButtonMode('close');
        await updateScenarioId(scenarioId, buttons, ViewNames.SETTINGS);
        attachEventListeners();

        if (buttonId === 'headsetSettingsBtn') {
            await showHeadsetSettings();
        }
    } catch (error) {
        logger.error('Error in settings-loaded handler:', error.message);
    }
});

ipcRenderer.on('selectedButton-click', (event, buttonId) => {
    try {
        document.getElementById(buttonId).click();
    } catch (error) {
        logger.error('Error in selectedButton-click handler:', error.message);
    }
});

ipcRenderer.on('scenarioId-update', async (event, scenarioId) => {
    try {
        await updateScenarioId(scenarioId, buttons, ViewNames.SETTINGS);
        ipcRenderer.send('scenarioId-update-complete', scenarioId);
    } catch (error) {
        logger.error('Error in scenarioId-update handler:', error.message);
    }
});

ipcRenderer.on('homeUrl-update', (event, newUrl) => {
    try {
        homeUrl = newUrl;
        const homeUrlBtn = document.getElementById('homeUrlBtn');
        if (homeUrlBtn) {
            homeUrlBtn.textContent = homeUrl ? homeUrl : 'Not configured';
        }
    } catch (error) {
        logger.error('Error in homeUrl-update handler:', error.message);
    }
});

ipcRenderer.on('keyboardLayout-update', (event, newLayout) => {
    try {
        keyboardLayoutInUse = newLayout;
        const keyboardLayoutBtn = document.getElementById('keyboardLayoutBtn');
        if (keyboardLayoutBtn) {
            keyboardLayoutBtn.textContent = keyboardLayoutInUse ? keyboardLayoutInUse : 'Not configured';
        }
    } catch (error) {
        logger.error('Error in keyboardLayout-update handler:', error.message);
    }
});

async function showGeneralSettings() {
    updateVisibility('generalSettings');
    populateGeneralSettings();
    setCloseButtonMode('back');

    await updateScenarioId(104, buttons, ViewNames.SETTINGS);
}

async function showHeadsetSettings() {
    updateVisibility('headsetSettings');
    populateHeadsetSettings();
    setCloseButtonMode('back');

    const scenarioId = await getScenarioIdForHeadset();
    await updateScenarioId(scenarioId, buttons, ViewNames.SETTINGS);
}

async function showStimuliSettings() {
    updateVisibility('stimuliSettings');
    populateStimuliSettings();
    setCloseButtonMode('back');

    await updateScenarioId(105, buttons, ViewNames.SETTINGS);
}

async function showSettingsSelection() {
    updateVisibility('settingsSelection');
    setCloseButtonMode('close');

    buttons = document.querySelectorAll('button');
    await updateScenarioId(100, buttons, ViewNames.SETTINGS);
}

async function getScenarioIdForHeadset() {
    // Extracting company and headset name from headsetInUse to be used in the database query
    const companyName = headsetInUse.split(' - ')[1] || '';
    const headsetName = headsetInUse.split(' - ')[0] || '';
    const multipleConnectionTypesExist = (await ipcRenderer.invoke('headsetConnectionTypes-get', headsetName, companyName)).length > 1;

    buttons = document.querySelectorAll('button');
    if (multipleConnectionTypesExist) {
        return 101;
    } else {
        return 102;
    }
}

function updateVisibility(containerIdToShow) {
    // Makes the required container visible and all other containers hidden
    const containers = settingsContentContainer.children;
    const titleElement = document.getElementById('settingsTitle');

    for (const container of containers) {
        if (container.id !== containerIdToShow) {
            container.style.display = 'none';
        } else {
            switch (container.id) {
                case 'settingsSelection':
                    titleElement.textContent = 'Settings';
                    container.style.display = 'flex';
                    break;
                case 'generalSettings':
                    titleElement.textContent = 'General Settings';
                    container.style.display = 'flex';
                    break;
                case 'stimuliSettings':
                    titleElement.textContent = 'Stimuli Settings';
                    container.style.display = 'block';
                    break;
                case 'headsetSettings':
                    titleElement.textContent = 'Headset Settings';
                    container.style.display = 'flex';
                    break;
                default:
                    logger.warn(`Unknown containerIdToShow: ${containerIdToShow}`);
                    return;
            }
        }
    }
}

// Maps an RGBA string to a defined colour name from enums
function getColorNameFromRgba(rgbaString, palette) {
    if (!rgbaString || !palette) return '';
    try {
        // palette is Stimuli.LIGHT_COLORS.COLOURS or Stimuli.DARK_COLORS.COLOURS
        for (const key of Object.keys(palette)) {
            const colour = palette[key];
            if (colour && colour.RGBA === rgbaString) {
                return colour.NAME;
            }
        }
    } catch (err) {
        logger.warn(`Error mapping RGBA to color name: ${err.message}`);
    }
    return '';
}

function setCloseButtonMode(mode) {
    if (!closeSettingsButton) {
        return;
    }

    closeSettingsButton.dataset.mode = mode;

    const iconElement = closeSettingsButton.querySelector('i');
    // Update button text and aria-label based on whether to close or go back
    if (mode === 'back') {
        if (iconElement) {
            iconElement.textContent = 'arrow_back';
        } else {
            closeSettingsButton.textContent = 'Back';
        }
        closeSettingsButton.setAttribute('aria-label', 'Back to Settings');
    } else {
        if (iconElement) {
            iconElement.textContent = 'close';
        } else {
            closeSettingsButton.textContent = 'Close';
        }
        closeSettingsButton.setAttribute('aria-label', 'Close Settings');
    }
}

function populateGeneralSettings() {
    const container = document.getElementById('generalSettings');
    container.innerHTML = ''; // Clear existing content

    const cardsContainer = document.createElement('div');
    cardsContainer.classList.add('cardsContainer');
    container.appendChild(cardsContainer);

    // -------------------------------
    // Home URL Setting
    // -------------------------------
    const homeUrlCard = document.createElement('div');
    homeUrlCard.classList.add('settingCard');

    const homeTextContainer = document.createElement('div');

    const homeUrlTitle = document.createElement('h3');
    homeUrlTitle.textContent = Settings.DEFAULT_URL.LABEL;
    homeTextContainer.appendChild(homeUrlTitle);

    const homeUrlDesc = document.createElement('p');
    homeUrlDesc.textContent = Settings.DEFAULT_URL.DESCRIPTION;
    homeTextContainer.appendChild(homeUrlDesc);
    homeUrlCard.appendChild(homeTextContainer);

    const homeUrlBtn = document.createElement('button');
    homeUrlBtn.innerHTML = `<span>${homeUrl ? homeUrl : 'Not configured'}</span>`;
    homeUrlBtn.id = 'homeUrlBtn';
    homeUrlBtn.classList.add('button');
    homeUrlBtn.rel = 'noreferrer noopener';
    homeUrlCard.appendChild(homeUrlBtn);

    // -------------------------------
    // Keyboard Layout Setting
    // -------------------------------
    const keyboardLayoutCard = document.createElement('div');
    keyboardLayoutCard.classList.add('settingCard');

    const keyboardLayoutTextContainer = document.createElement('div');

    const keyboardLayoutTitle = document.createElement('h3');
    keyboardLayoutTitle.textContent = Settings.DEFAULT_KEYBOARD_LAYOUT.LABEL;
    keyboardLayoutTextContainer.appendChild(keyboardLayoutTitle);

    const keyboardLayoutDesc = document.createElement('p');
    keyboardLayoutDesc.textContent = Settings.DEFAULT_KEYBOARD_LAYOUT.DESCRIPTION;
    keyboardLayoutTextContainer.appendChild(keyboardLayoutDesc);

    keyboardLayoutCard.appendChild(keyboardLayoutTextContainer);

    const keyboardLayoutBtn = document.createElement('button');
    keyboardLayoutBtn.innerHTML = `<span>${keyboardLayoutInUse ? keyboardLayoutInUse : 'Not configured'}</span>`;
    keyboardLayoutBtn.id = 'keyboardLayoutBtn';
    keyboardLayoutBtn.classList.add('button');
    keyboardLayoutBtn.rel = 'noreferrer noopener';
    keyboardLayoutCard.appendChild(keyboardLayoutBtn);

    // -------------------------------
    // Adaptive Switch Setting
    // -------------------------------
    const adaptiveSwitchCard = document.createElement('div');
    adaptiveSwitchCard.classList.add('settingCard');

    const adaptiveSwitchTextContainer = document.createElement('div');

    const adaptiveSwitchTitle = document.createElement('h3');
    adaptiveSwitchTitle.textContent = Settings.ADAPTIVE_SWITCH_CONNECTED.LABEL;
    adaptiveSwitchTextContainer.appendChild(adaptiveSwitchTitle);

    const adaptiveSwitchDesc = document.createElement('p');
    adaptiveSwitchDesc.textContent = Settings.ADAPTIVE_SWITCH_CONNECTED.DESCRIPTION;
    adaptiveSwitchTextContainer.appendChild(adaptiveSwitchDesc);

    adaptiveSwitchCard.appendChild(adaptiveSwitchTextContainer);

    const adaptiveSwitchBtn = document.createElement('button');
    adaptiveSwitchBtn.innerHTML = `<span>${adaptiveSwitchInUse ? 'Enabled' : 'Disabled'}</span>`;
    adaptiveSwitchBtn.id = 'adaptiveSwitchBtn';
    adaptiveSwitchBtn.classList.add('button', 'button--activatable');
    if (adaptiveSwitchInUse) adaptiveSwitchBtn.classList.add('button--active');
    adaptiveSwitchBtn.rel = 'noreferrer noopener';
    adaptiveSwitchCard.appendChild(adaptiveSwitchBtn);

    // --------------------------------
    // Attaching all cards to container
    // --------------------------------     
    cardsContainer.appendChild(homeUrlCard);
    cardsContainer.appendChild(keyboardLayoutCard);
    cardsContainer.appendChild(adaptiveSwitchCard);

    // -------------------------------
    // Event Listeners for Buttons
    // ------------------------------- 
    homeUrlBtn.addEventListener('click', async () => {
        // Disable the button immediately to prevent multiple clicks
        homeUrlBtn.disabled = true;
        setTimeout(() => { homeUrlBtn.disabled = false; }, 1500);
        addButtonSelectionAnimation(homeUrlBtn);

        try {
            const homeUrlBtn = document.getElementById('homeUrlBtn');
            let elementProperties = {
                id: 'homeUrl',
                value: homeUrlBtn.textContent || ''
            }
            ipcRenderer.send('overlay-create', ViewNames.KEYBOARD, 80, null, null, elementProperties);
        } catch (error) {
            logger.error('Error creating keyboard overlay:', error.message);
        }
    });

    keyboardLayoutBtn.addEventListener('click', async () => {
        // Disable the button immediately to prevent multiple clicks
        keyboardLayoutBtn.disabled = true;
        setTimeout(() => { keyboardLayoutBtn.disabled = false; }, 1500);
        addButtonSelectionAnimation(keyboardLayoutBtn);

        setTimeout(async () => {
            await stopManager();

            try {
                await showKeyboardLayoutSelectionPopup();
            } catch (error) {
                logger.error('Error creating keyboard layout selection modal:', error.message);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });

    adaptiveSwitchBtn.addEventListener('click', async () => {
        // Disable the button immediately to prevent multiple clicks
        adaptiveSwitchBtn.disabled = true;
        setTimeout(() => { adaptiveSwitchBtn.disabled = false; }, 1500);
        addButtonSelectionAnimation(adaptiveSwitchBtn);

        setTimeout(async () => {
            try {
                // Toggle the adaptive switch status
                adaptiveSwitchInUse = !adaptiveSwitchInUse;
                // Update the UI
                if (adaptiveSwitchInUse) {
                    adaptiveSwitchBtn.classList.add('button--active');
                    adaptiveSwitchBtn.innerHTML = `<span>Enabled</span>`;
                } else {
                    adaptiveSwitchBtn.classList.remove('button--active');
                    adaptiveSwitchBtn.innerHTML = `<span>Disabled</span>`;
                }

                // Update the adaptive switch status in the db
                ipcRenderer.send('adaptiveSwitch-update', adaptiveSwitchInUse);
            } catch (error) {
                logger.error('Error toggling adaptive switch status:', error.message);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });
}

async function populateHeadsetSettings() {
    const container = document.getElementById('headsetSettings');
    container.innerHTML = ''; // Clear existing content

    const cardsContainer = document.createElement('div');
    cardsContainer.classList.add('cardsContainer');
    container.appendChild(cardsContainer);

    // const description = document.createElement('p');
    // description.classList.add('descriptionText');
    // description.textContent = 'Focus on the flickering buttons below to change the default settings for Boggle';
    // container.appendChild(description);

    const disclaimer = document.createElement('p');
    disclaimer.classList.add('disclaimerText');
    disclaimer.textContent = '* Changes to these settings will take effect the next time the application is started';

    // -------------------------------
    // Default Headset Setting
    // -------------------------------
    const headsetCard = document.createElement('div');
    headsetCard.classList.add('settingCard');

    const headsetTextContainer = document.createElement('div');

    const headsetCardH3 = document.createElement('h3');
    headsetCardH3.innerHTML = `${Settings.DEFAULT_HEADSET.LABEL}<span class="asterisk"> *</span>`;
    headsetTextContainer.appendChild(headsetCardH3);

    const headsetDesc = document.createElement('p');
    headsetDesc.textContent = Settings.DEFAULT_HEADSET.DESCRIPTION;
    headsetTextContainer.appendChild(headsetDesc);
    headsetCard.appendChild(headsetTextContainer);

    const headsetBtn = document.createElement('button');
    headsetBtn.innerHTML = `<span>${headsetInUse || 'Unknown'}</span>`;
    headsetBtn.id = 'headsetBtn';
    headsetBtn.classList.add('button');
    headsetBtn.rel = 'noreferrer noopener';
    headsetCard.appendChild(headsetBtn);

    // -------------------------------
    // Default Connection Type Setting
    // ------------------------------- 
    const connectionTypeCard = document.createElement('div');
    connectionTypeCard.classList.add('settingCard');

    const connectionTypeTextContainer = document.createElement('div');

    const connectionTypeCardH3 = document.createElement('h3');
    connectionTypeCardH3.innerHTML = `${Settings.DEFAULT_CONNECTION_TYPE.LABEL}<span class="asterisk"> *</span>`;
    connectionTypeTextContainer.appendChild(connectionTypeCardH3);

    const connectionTypeDesc = document.createElement('p');
    connectionTypeDesc.textContent = Settings.DEFAULT_CONNECTION_TYPE.DESCRIPTION;
    connectionTypeTextContainer.appendChild(connectionTypeDesc);
    connectionTypeCard.appendChild(connectionTypeTextContainer);

    const connectionTypeBtn = document.createElement('button');
    connectionTypeBtn.innerHTML = `<span>${connectionTypeInUse || 'Unknown'}</span>`;
    connectionTypeBtn.id = 'connectionTypeBtn';
    connectionTypeBtn.classList.add('button');
    connectionTypeBtn.rel = 'noreferrer noopener';
    connectionTypeCard.appendChild(connectionTypeBtn);


    cardsContainer.appendChild(headsetCard);
    cardsContainer.appendChild(connectionTypeCard);

    // container.appendChild(description);
    container.appendChild(cardsContainer);
    container.appendChild(disclaimer);

    // Ensure the Update Credentials button is only created after its DOM container exists
    await updateCredentialsButtonVisibility();

    // -------------------------------
    // Event Listeners for Buttons
    // ------------------------------- 
    headsetBtn.addEventListener('click', async () => {
        // Disable the button immediately to prevent multiple clicks
        headsetBtn.disabled = true;
        setTimeout(() => { headsetBtn.disabled = false; }, 1500);
        addButtonSelectionAnimation(headsetBtn);

        setTimeout(async () => {
            await stopManager();

            try {
                await showHeadsetSelectionPopup();
            } catch (error) {
                logger.error('Error creating headset selection modal:', error.message);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });

    connectionTypeBtn.addEventListener('click', async () => {
        // Disable the button immediately to prevent multiple clicks
        connectionTypeBtn.disabled = true;
        setTimeout(() => { connectionTypeBtn.disabled = false; }, 1500);
        addButtonSelectionAnimation(connectionTypeBtn);

        setTimeout(async () => {
            await stopManager();

            try {
                await showConnectionTypeSelectionPopup();
            } catch (error) {
                logger.error('Error creating connection type selection modal:', error.message);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });

    if (updateCredentialsBtn) {
        updateCredentialsBtn.addEventListener('click', handleUpdateCredentialsClick);
    }
}

async function updateCredentialsButtonVisibility() {
    try {
        const connectionTypeBtn = document.getElementById('connectionTypeBtn');
        if (!connectionTypeBtn) return;

        const connectionTypeCard = connectionTypeBtn.closest('.settingCard');
        if (!connectionTypeCard) return;

        const headsetName = (headsetInUse || '').split(' - ')[0] || '';
        const companyName = (headsetInUse || '').split(' - ')[1] || '';

        if (!headsetName || !companyName || !connectionTypeInUse) {
            if (updateCredentialsBtn) {
                updateCredentialsBtn.remove();
                updateCredentialsBtn = null;
            }
            return;
        }

        const requiresCredentials = await ipcRenderer.invoke('credentials-exist', headsetName, companyName, connectionTypeInUse);

        if (requiresCredentials) {
            if (!updateCredentialsBtn) {
                updateCredentialsBtn = document.createElement('button');
                updateCredentialsBtn.innerHTML = `<span>Update Credentials</span>`;
                updateCredentialsBtn.id = 'updateCredentialsBtn';
                updateCredentialsBtn.classList.add('button', 'button--clickable');
                connectionTypeCard.insertBefore(updateCredentialsBtn, connectionTypeBtn);
                updateCredentialsBtn.addEventListener('click', handleUpdateCredentialsClick);
            } else if (!connectionTypeCard.contains(updateCredentialsBtn)) {
                connectionTypeCard.insertBefore(updateCredentialsBtn, connectionTypeBtn);
            }
        } else if (updateCredentialsBtn) {
            updateCredentialsBtn.remove();
            updateCredentialsBtn = null;
        }
    } catch (error) {
        logger.error('Error updating credentials button visibility:', error.message);
    }
}

async function handleUpdateCredentialsClick() {
    if (!updateCredentialsBtn) return;

    // Disable the button immediately to prevent multiple clicks
    updateCredentialsBtn.disabled = true;
    setTimeout(() => {
        if (updateCredentialsBtn) {
            updateCredentialsBtn.disabled = false;
        }
    }, 1500);

    await stopManager();

    try {
        const headsetName = (headsetInUse || '').split(' - ')[0] || '';
        const companyName = (headsetInUse || '').split(' - ')[1] || '';
        const credentials = await ipcRenderer.invoke('credentials-get', headsetName, companyName, connectionTypeInUse);
        const loadedFrom = ViewNames.SETTINGS;
        ipcRenderer.send('overlay-create', ViewNames.CREDENTIALS, -1, null, null, { headsetName, companyName, connectionType: connectionTypeInUse, credentials, loadedFrom });
    } catch (error) {
        logger.error('Error creating credentials overlay:', error.message);
    }
}

function populateStimuliSettings() {
    const container = document.getElementById('stimuliSettings');
    container.innerHTML = ''; // Clear existing content    

    const cardsContainer = document.createElement('div');
    cardsContainer.classList.add('cardsContainer');
    container.appendChild(cardsContainer);

    // -------------------------------
    // Default Stimuli Pattern
    // ------------------------------- 
    const patternCard = document.createElement('div');
    patternCard.classList.add('settingCard');

    const patternTextContainer = document.createElement('div');

    const patternCardH3 = document.createElement('h3');
    patternCardH3.innerHTML = `${Settings.DEFAULT_STIMULI_PATTERN.LABEL}`;
    patternTextContainer.appendChild(patternCardH3);

    const patternDesc = document.createElement('p');
    patternDesc.textContent = Settings.DEFAULT_STIMULI_PATTERN.DESCRIPTION;
    patternTextContainer.appendChild(patternDesc);
    patternCard.appendChild(patternTextContainer);

    const patternBtn = document.createElement('button');
    patternBtn.innerHTML = `<span>${stimuliInUse.pattern || 'Unknown'}</span>`;
    patternBtn.id = 'stimuliPatternBtn';
    patternBtn.classList.add('button');
    patternBtn.rel = 'noreferrer noopener';
    patternCard.appendChild(patternBtn);

    cardsContainer.appendChild(patternCard);

    // -------------------------------
    // Default Stimuli Light Color
    // -------------------------------
    const lightColorCard = document.createElement('div');
    lightColorCard.classList.add('settingCard');

    const lightColorTextContainer = document.createElement('div');

    const lightColorH3 = document.createElement('h3');
    lightColorH3.innerHTML = `${Settings.DEFAULT_STIMULI_LIGHT_COLOR.LABEL}`;
    lightColorTextContainer.appendChild(lightColorH3);

    const lightColorDesc = document.createElement('p');
    lightColorDesc.textContent = Settings.DEFAULT_STIMULI_LIGHT_COLOR.DESCRIPTION;
    lightColorTextContainer.appendChild(lightColorDesc);
    lightColorCard.appendChild(lightColorTextContainer);

    const lightColorBtn = document.createElement('button');
    const lightRgba = stimuliInUse.lightRgba || Settings.DEFAULT_STIMULI_LIGHT_COLOR.DEFAULT || '';
    const lightColorName = getColorNameFromRgba(lightRgba, Stimuli.LIGHT_COLORS.COLOURS) || stimuliInUse.lightRgba;
    lightColorBtn.innerHTML = `<span>${lightColorName || lightRgba || 'Not configured'}</span>`;
    lightColorBtn.id = 'stimuliLightColorBtn';
    lightColorBtn.classList.add('button');
    lightColorCard.appendChild(lightColorBtn);

    cardsContainer.appendChild(lightColorCard);

    // -------------------------------
    // Default Stimuli Dark Color
    // -------------------------------
    const darkColorCard = document.createElement('div');
    darkColorCard.classList.add('settingCard');

    const darkColorTextContainer = document.createElement('div');

    const darkColorH3 = document.createElement('h3');
    darkColorH3.innerHTML = `${Settings.DEFAULT_STIMULI_DARK_COLOR.LABEL}`;
    darkColorTextContainer.appendChild(darkColorH3);

    const darkColorDesc = document.createElement('p');
    darkColorDesc.textContent = Settings.DEFAULT_STIMULI_DARK_COLOR.DESCRIPTION;
    darkColorTextContainer.appendChild(darkColorDesc);
    darkColorCard.appendChild(darkColorTextContainer);

    const darkColorBtn = document.createElement('button');
    const darkRgba = stimuliInUse.darkRgba || Settings.DEFAULT_STIMULI_DARK_COLOR.DEFAULT;
    const darkColorName = getColorNameFromRgba(darkRgba, Stimuli.DARK_COLORS.COLOURS) || stimuliInUse.darkRgba;
    darkColorBtn.innerHTML = `<span>${darkColorName || darkRgba || 'Not configured'}</span>`;
    darkColorBtn.id = 'stimuliDarkColorBtn';
    darkColorBtn.classList.add('button');
    darkColorCard.appendChild(darkColorBtn);

    cardsContainer.appendChild(darkColorCard);

    // -------------------------------
    // Default Gaze Length
    // -------------------------------
    const gazeLengthCard = document.createElement('div');
    gazeLengthCard.classList.add('settingCard');

    const gazeLengthTextContainer = document.createElement('div');

    const gazeLengthH3 = document.createElement('h3');
    gazeLengthH3.innerHTML = `${Settings.DEFAULT_GAZE_LENGTH.LABEL}`;
    gazeLengthTextContainer.appendChild(gazeLengthH3);

    const gazeLengthDesc = document.createElement('p');
    gazeLengthDesc.textContent = Settings.DEFAULT_GAZE_LENGTH.DESCRIPTION;
    gazeLengthTextContainer.appendChild(gazeLengthDesc);
    gazeLengthCard.appendChild(gazeLengthTextContainer);

    const gazeLengthBtn = document.createElement('button');
    const gazeLengthValue = (stimuliInUse.gazeLengthInSecs) || Settings.DEFAULT_GAZE_LENGTH.DEFAULT;
    gazeLengthBtn.innerHTML = `<span>${gazeLengthValue ?? 'Not configured'}</span>`;
    gazeLengthBtn.id = 'gazeLengthBtn';
    gazeLengthBtn.classList.add('button');
    gazeLengthCard.appendChild(gazeLengthBtn);

    cardsContainer.appendChild(gazeLengthCard);

    // -------------------------------
    // Restore Default Stimuli Settings
    // -------------------------------
    const restoreDefaultsCard = document.createElement('div');
    restoreDefaultsCard.classList.add('settingCard');

    const restoreDefaultsTextContainer = document.createElement('div');

    const restoreDefaultsH3 = document.createElement('h3');
    restoreDefaultsH3.innerHTML = `Restore Defaults`;
    restoreDefaultsTextContainer.appendChild(restoreDefaultsH3);

    const restoreDefaultsDesc = document.createElement('p');
    restoreDefaultsDesc.textContent = 'Selecting this button will revert all changes to the default settings.';
    restoreDefaultsTextContainer.appendChild(restoreDefaultsDesc);
    restoreDefaultsCard.appendChild(restoreDefaultsTextContainer);

    const restoreDefaultsBtn = document.createElement('button');
    restoreDefaultsBtn.innerHTML = `<span>Reset</span>`;
    restoreDefaultsBtn.id = 'stimuliRestoreDefaultsBtn';
    restoreDefaultsBtn.classList.add('button');
    restoreDefaultsCard.appendChild(restoreDefaultsBtn);

    cardsContainer.appendChild(restoreDefaultsCard);

    // -------------------------------
    // Event Listeners for Buttons
    // -------------------------------
    patternBtn.addEventListener('click', async () => {
        // Disable the button immediately to prevent multiple clicks
        patternBtn.disabled = true;
        setTimeout(() => { patternBtn.disabled = false; }, 1500);
        addButtonSelectionAnimation(patternBtn);

        setTimeout(async () => {
            await stopManager();

            try {
                await showPatternSelectionPopup();
            } catch (error) {
                logger.error('Error creating stimuli pattern selection modal:', error.message);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });

    lightColorBtn.addEventListener('click', async () => {
        // Disable the button immediately to prevent multiple clicks
        lightColorBtn.disabled = true;
        setTimeout(() => { lightColorBtn.disabled = false; }, 1500);
        addButtonSelectionAnimation(lightColorBtn);
        setTimeout(async () => {
            await stopManager();

            try {
                await showColorSelectionPopup('light');
            } catch (error) {
                logger.error('Error creating color selection modal:', error.message);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });

    darkColorBtn.addEventListener('click', async () => {
        // Disable the button immediately to prevent multiple clicks
        darkColorBtn.disabled = true;
        setTimeout(() => { darkColorBtn.disabled = false; }, 1500);
        addButtonSelectionAnimation(darkColorBtn);
        setTimeout(async () => {
            await stopManager();

            try {
                await showColorSelectionPopup('dark');
            } catch (error) {
                logger.error('Error creating color selection modal:', error.message);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });

    gazeLengthBtn.addEventListener('click', async () => {
        // Disable the button immediately to prevent multiple clicks
        gazeLengthBtn.disabled = true;
        setTimeout(() => { gazeLengthBtn.disabled = false; }, 1500);
        addButtonSelectionAnimation(gazeLengthBtn);
        setTimeout(async () => {
            await stopManager();

            try {
                await showGazeLengthSelectionPopup();
            } catch (error) {
                logger.error('Error creating gaze length selection modal:', error.message);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });

    restoreDefaultsBtn.addEventListener('click', async () => {
        // Disable the button immediately to prevent multiple clicks
        restoreDefaultsBtn.disabled = true;
        setTimeout(() => { restoreDefaultsBtn.disabled = false; }, 1500);
        addButtonSelectionAnimation(restoreDefaultsBtn);

        setTimeout(async () => {
            await stopManager();

            try {
                // Apply defaults from enums
                const defaultPattern = Settings.DEFAULT_STIMULI_PATTERN.DEFAULT;
                const defaultLightRgba = Settings.DEFAULT_STIMULI_LIGHT_COLOR.DEFAULT;
                const defaultDarkRgba = Settings.DEFAULT_STIMULI_DARK_COLOR.DEFAULT;
                const defaultGazeLen = Settings.DEFAULT_GAZE_LENGTH.DEFAULT;

                stimuliInUse.pattern = defaultPattern;
                stimuliInUse.lightColor = {
                    name: getColorNameFromRgba(defaultLightRgba, Stimuli.LIGHT_COLORS.COLOURS) || 'Default',
                    rgba: defaultLightRgba
                };
                stimuliInUse.darkColor = {
                    name: getColorNameFromRgba(defaultDarkRgba, Stimuli.DARK_COLORS.COLOURS) || 'Default',
                    rgba: defaultDarkRgba
                };
                stimuliInUse.gazeLengthInSecs = defaultGazeLen;

                // Update UI buttons
                const patternBtn = document.getElementById('stimuliPatternBtn');
                const lightColorBtn = document.getElementById('stimuliLightColorBtn');
                const darkColorBtn = document.getElementById('stimuliDarkColorBtn');
                const gazeLengthBtnLocal = document.getElementById('gazeLengthBtn');

                if (patternBtn) patternBtn.innerHTML = `<span>${stimuliInUse.pattern || 'Unknown'}</span>`;
                if (lightColorBtn) lightColorBtn.innerHTML = `<span>${stimuliInUse.lightColor.name || stimuliInUse.lightColor.rgba}</span>`;
                if (darkColorBtn) darkColorBtn.innerHTML = `<span>${stimuliInUse.darkColor.name || stimuliInUse.darkColor.rgba}</span>`;
                if (gazeLengthBtnLocal) gazeLengthBtnLocal.innerHTML = `<span>${stimuliInUse.gazeLengthInSecs}</span>`;

                // Persist defaults to DB (using existing IPC channels where available)
                ipcRenderer.send('stimuliSettings-update', {
                    pattern: stimuliInUse.pattern,
                    lightColor: stimuliInUse.lightColor.rgba,
                    darkColor: stimuliInUse.darkColor.rgba
                });
                ipcRenderer.send('gazeLength-update', stimuliInUse.gazeLengthInSecs);

                // Wait for cache update before restarting scenario
                await new Promise((resolve) => {
                    const handler = (_event, _settings) => {
                        ipcRenderer.removeListener('stimuliSettings-update', handler);
                        resolve();
                    };
                    ipcRenderer.on('stimuliSettings-update', handler);
                });

                await updateScenarioId(105, undefined, ViewNames.SETTINGS);
            } catch (error) {
                logger.error('Error restoring default stimuli settings:', error.message);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });
}

async function showHeadsetSelectionPopup() {
    try {
        // Get a list of available headsets from the main process
        const availableHeadsets = await ipcRenderer.invoke('headsets-get');
        console.log(availableHeadsets);
        const buttonsList = [];
        const headsetCards = [];

        availableHeadsets.forEach((headset, index) => {
            const idSuffix = ['first', 'second', 'third', 'fourth'][index];

            const headsetCard = document.createElement('div');
            headsetCard.classList.add('headsetCard');

            const headsetImage = document.createElement('img');
            headsetImage.classList.add('headsetImage');
            headsetImage.alt = `${headset.name} headset`;
            if (headset.image) {
                headsetImage.src = headset.image;
            } else {
                headsetImage.classList.add('headsetImage--placeholder');
            }
            headsetCard.appendChild(headsetImage);

            const headsetDesc = document.createElement('div');
            headsetDesc.classList.add('headsetDesc');
            const electrodeCount = headset.usedElectrodes.length;
            headsetDesc.innerHTML = `<span>${electrodeCount} Electrodes</span>`;
            const listOfElectrodes = headset.usedElectrodes;
            headsetDesc.innerHTML += `<span>${listOfElectrodes.join(', ')}</span>`;
            headsetDesc.innerHTML += `<span>Manufacturer — ${headset.company}</span>`;
            headsetCard.appendChild(headsetDesc);

            // Create buttons
            const selectHeadsetBtn = document.createElement('button');
            selectHeadsetBtn.setAttribute('id', `${idSuffix}SettingOptionBtn`);
            selectHeadsetBtn.classList.add('button', 'popup__btn');
            selectHeadsetBtn.textContent = `${headset.name}`;
            selectHeadsetBtn.onclick = () => {
                addButtonSelectionAnimation(selectHeadsetBtn);
                setTimeout(async () => {
                    popupElements.close();

                    // Update the UI
                    headsetInUse = `${headset.name} - ${headset.company}`;
                    const headsetBtn = document.getElementById('headsetBtn');
                    headsetBtn.innerHTML = `<span>${headsetInUse || 'Unknown'}</span>`;

                    // Update the default headset in the db
                    ipcRenderer.send('defaultHeadset-update', `${headset.name} - ${headset.company}`);

                    const headsetConnectionTypes = await ipcRenderer.invoke('headsetConnectionTypes-get', headset.name, headset.company);
                    if (!headsetConnectionTypes.includes(connectionTypeInUse)) {
                        // Update the UI
                        connectionTypeInUse = headsetConnectionTypes[0] || '';
                        const connectionTypeBtn = document.getElementById('connectionTypeBtn');
                        connectionTypeBtn.innerHTML = `<span>${connectionTypeInUse || 'Unknown'}</span>`;

                        // Update the default connection type in the db
                        ipcRenderer.send('defaultConnectionType-update', connectionTypeInUse);
                    }

                    await updateCredentialsButtonVisibility();

                    const scenarioId = await getScenarioIdForHeadset();
                    await updateScenarioId(scenarioId, buttons, ViewNames.SETTINGS);
                }, CssConstants.SELECTION_ANIMATION_DURATION);
            };
            headsetCard.appendChild(selectHeadsetBtn);

            buttonsList.push(selectHeadsetBtn);
            headsetCards.push(headsetCard);
        });

        const popupElements = createPopup({
            name: 'headsetSelection',
            message: 'Choose Headset',
            classes: ['popup--headsetSelection'],
            buttons: headsetCards
        });

        await updateScenarioId(103, buttonsList, ViewNames.SETTINGS);
    } catch (error) {
        logger.error('Error opening headset selection popup:', error.message);
    }
}

async function showConnectionTypeSelectionPopup() {
    try {
        // Get a list of available connection types for the current headset from the main process
        const headsetName = headsetInUse.split(' - ')[0] || '';
        const companyName = headsetInUse.split(' - ')[1] || '';
        const availableConnectionTypes = await ipcRenderer.invoke('headsetConnectionTypes-get', headsetName, companyName);

        // get connection type descriptions
        const connectionTypeData = await Promise.all(availableConnectionTypes.map(type => {
            return ipcRenderer.invoke('connectionTypeData-get', type);
        }));

        const buttonsList = [];
        const connectionTypeCards = [];

        connectionTypeData.forEach((connectionType, index) => {
            const idSuffix = ['first', 'second', 'third', 'fourth'][index];

            const connectionTypeCard = document.createElement('div');
            connectionTypeCard.classList.add('connectionTypeCard');

            const connectionTypeDesc = document.createElement('div');
            connectionTypeDesc.classList.add('connectionTypeDesc');
            connectionTypeDesc.innerHTML = `<span>${connectionType.description}</span>`;
            connectionTypeCard.appendChild(connectionTypeDesc);

            const selectConnectionTypeBtn = document.createElement('button');
            selectConnectionTypeBtn.setAttribute('id', `${idSuffix}SettingOptionBtn`);
            selectConnectionTypeBtn.classList.add('button', 'popup__btn', 'popup__btn--connectionType');
            selectConnectionTypeBtn.innerHTML = `<span>${connectionType.name}</span>`;
            selectConnectionTypeBtn.onclick = async () => {
                addButtonSelectionAnimation(selectConnectionTypeBtn);
                setTimeout(async () => {
                    popupElements.close();

                    // Update the UI
                    connectionTypeInUse = connectionType.name;
                    const connectionTypeBtn = document.getElementById('connectionTypeBtn');
                    connectionTypeBtn.innerHTML = `<span>${connectionTypeInUse || 'Unknown'}</span>`;

                    // Update the default connection type in the db
                    ipcRenderer.send('defaultConnectionType-update', connectionTypeInUse);
                    await updateCredentialsButtonVisibility();
                    const scenarioId = await getScenarioIdForHeadset();
                    await updateScenarioId(scenarioId, buttons, ViewNames.SETTINGS);

                    connectionTypeCards.push(connectionTypeCard);
                }, CssConstants.SELECTION_ANIMATION_DURATION);
            }
            connectionTypeCard.appendChild(selectConnectionTypeBtn);

            buttonsList.push(selectConnectionTypeBtn);
            connectionTypeCards.push(connectionTypeCard);
        });

        const popupElements = createPopup({
            name: 'connectionTypeSelection',
            message: 'Choose Connection Type',
            classes: ['popup--connectionTypeSelection'],
            buttons: connectionTypeCards
        });

        await updateScenarioId(103, buttonsList, ViewNames.SETTINGS);
    } catch (error) {
        logger.error('Error creating connection type selection modal:', error.message);
    }
}

async function showKeyboardLayoutSelectionPopup() {
    try {
        // Get a list of available headsets from the main process
        const availableKeyboardLayouts = await ipcRenderer.invoke('keyboardLayouts-get');
        console.log(availableKeyboardLayouts);
        const buttonsList = [];
        const keyboardLayoutCards = [];

        availableKeyboardLayouts.forEach((keyboardLayout, index) => {
            const idSuffix = ['first', 'second', 'third', 'fourth'][index];

            const keyboardLayoutCard = document.createElement('div');
            keyboardLayoutCard.classList.add('keyboardLayoutCard');

            const keyboardLayoutImage = document.createElement('img');
            keyboardLayoutImage.classList.add('keyboardLayoutImage');
            keyboardLayoutImage.alt = `${keyboardLayout.name} keyboard layout`;
            if (keyboardLayout.image) {
                keyboardLayoutImage.src = keyboardLayout.image;
            } else {
                keyboardLayoutImage.classList.add('keyboardLayoutImage--placeholder');
            }
            keyboardLayoutCard.appendChild(keyboardLayoutImage);

            const keyboardLayoutDesc = document.createElement('div');
            keyboardLayoutDesc.classList.add('keyboardLayoutDesc');
            keyboardLayoutDesc.innerHTML = `<span>${keyboardLayout.description}</span>`;
            keyboardLayoutCard.appendChild(keyboardLayoutDesc);

            // Create buttons
            const selectKeyboardLayoutBtn = document.createElement('button');
            selectKeyboardLayoutBtn.setAttribute('id', `${idSuffix}SettingOptionBtn`);
            selectKeyboardLayoutBtn.classList.add('button', 'popup__btn', 'popup__btn--keyboardLayout');
            selectKeyboardLayoutBtn.innerHTML = `<span>${keyboardLayout.name}</span>`;
            selectKeyboardLayoutBtn.onclick = () => {
                addButtonSelectionAnimation(selectKeyboardLayoutBtn);
                setTimeout(async () => {
                    popupElements.close();

                    // Update the UI
                    keyboardLayoutInUse = keyboardLayout.name;
                    const keyboardLayoutBtn = document.getElementById('keyboardLayoutBtn');
                    keyboardLayoutBtn.innerHTML = `<span>${keyboardLayoutInUse || 'Unknown'}</span>`;

                    // Update the default keyboard layout in the db
                    ipcRenderer.send('keyboardLayout-update', keyboardLayoutInUse);

                    await updateScenarioId(104, buttonsList, ViewNames.SETTINGS);
                }, CssConstants.SELECTION_ANIMATION_DURATION);
            };
            keyboardLayoutCard.appendChild(selectKeyboardLayoutBtn);

            buttonsList.push(selectKeyboardLayoutBtn);
            keyboardLayoutCards.push(keyboardLayoutCard);
        });

        const popupElements = createPopup({
            name: 'keyboardLayoutSelection',
            message: 'Choose Keyboard Layout',
            classes: ['popup--keyboardLayoutSelection'],
            buttons: keyboardLayoutCards
        });

        await updateScenarioId(103, buttonsList, ViewNames.SETTINGS);
    } catch (error) {
        logger.error('Error opening keyboard layout selection popup:', error.message);
    }
}

async function showPatternSelectionPopup() {
    try {
        const buttonsList = [];
        const patternCards = [];
        Object.values(Stimuli.PATTERNS_TYPES.PATTERNS).forEach((patternType, index) => {
            const idSuffix = ['first', 'second', 'third', 'fourth'][index];

            const patternCard = document.createElement('div');
            patternCard.classList.add('patternCard');

            let patternPreview;
            const patternValue = patternType.VALUE.toLowerCase();
            const assetMap = {
                line: 'line_stimuli.svg',
                solid: 'solid_stimuli.png',
                chequered: 'chequered_stimuli.png',
                dot: 'dot_stimuli.svg'
            };

            const maybeAsset = assetMap[patternValue];
            if (maybeAsset) {
                const img = document.createElement('img');
                img.classList.add('patternPreviewImage');
                img.src = `../../../resources/${maybeAsset}`;
                img.alt = `${patternType.NAME} preview`;
                // Fallback to CSS preview if image is missing
                img.onerror = () => {
                    const fallback = document.createElement('div');
                    fallback.classList.add('patternPreview', `patternPreview--${patternValue}`);
                    img.replaceWith(fallback);
                };
                patternPreview = img;
            } else {
                patternPreview = document.createElement('div');
                patternPreview.classList.add('patternPreview', `patternPreview--${patternValue}`);
            }
            patternCard.appendChild(patternPreview);

            const selectPatternBtn = document.createElement('button');
            selectPatternBtn.setAttribute('id', `${idSuffix}SettingOptionBtn`);
            selectPatternBtn.classList.add('button', 'popup__btn', 'popup__btn--pattern');
            selectPatternBtn.innerHTML = `<span>${patternType.NAME}</span>`;

            patternCard.appendChild(selectPatternBtn);
            buttonsList.push(selectPatternBtn);
            patternCards.push(patternCard);

            selectPatternBtn.onclick = () => {
                addButtonSelectionAnimation(selectPatternBtn);
                setTimeout(async () => {
                    stimuliInUse.pattern = patternType.VALUE;

                    // Updating the UI
                    const patternBtn = document.getElementById('stimuliPatternBtn');
                    patternBtn.innerHTML = `<span>${stimuliInUse.pattern || 'Unknown'}</span>`;

                    // Updating the default stimuli pattern in the db
                    ipcRenderer.send('stimuliPattern-update', stimuliInUse.pattern);

                    // Wait for the renderer cache to be updated via 'stimuliSettings-update' before changing scenario
                    await new Promise((resolve) => {
                        const handler = (_event, _settings) => {
                            ipcRenderer.removeListener('stimuliSettings-update', handler);
                            resolve();
                        };
                        ipcRenderer.on('stimuliSettings-update', handler);
                    });

                    popupElements.close();
                    await updateScenarioId(105, buttonsList, ViewNames.SETTINGS);
                }, CssConstants.SELECTION_ANIMATION_DURATION);
            };
        });

        const popupElements = createPopup({
            name: 'patternSelection',
            message: 'Choose Stimuli Pattern',
            classes: ['popup--patternSelection'],
            buttons: patternCards
        });
        await updateScenarioId(106, buttonsList, ViewNames.SETTINGS);
    } catch (error) {
        logger.error('Error opening pattern selection popup:', error.message);
    }
}

async function showColorSelectionPopup(type) {
    try {
        const buttonsList = [];
        const colorCards = [];

        Object.values(type === 'light' ? Stimuli.LIGHT_COLORS.COLOURS : Stimuli.DARK_COLORS.COLOURS).forEach((colorType, index) => {
            const idSuffix = ['first', 'second', 'third', 'fourth'][index];

            const colorCard = document.createElement('div');
            colorCard.classList.add('colorCard');

            const colorPreview = document.createElement('div');
            colorPreview.classList.add('colorPreview');
            colorPreview.style.backgroundColor = `rgba(${colorType.RGBA})`;
            colorCard.appendChild(colorPreview);

            const selectColorBtn = document.createElement('button');
            selectColorBtn.setAttribute('id', `${idSuffix}SettingOptionBtn`);
            selectColorBtn.classList.add('button', 'popup__btn', 'popup__btn--color');
            selectColorBtn.innerHTML = `<span>${colorType.NAME}</span>`;
            colorCard.appendChild(selectColorBtn);

            buttonsList.push(selectColorBtn);
            colorCards.push(colorCard);

            selectColorBtn.onclick = () => {
                addButtonSelectionAnimation(selectColorBtn);
                setTimeout(async () => {
                    if (type === 'light') {
                        stimuliInUse.lightColor = {
                            name: colorType.NAME,
                            rgba: colorType.RGBA
                        };
                    } else {
                        stimuliInUse.darkColor = {
                            name: colorType.NAME,
                            rgba: colorType.RGBA
                        };
                    }

                    // Updating the UI
                    const colorBtn = document.getElementById(type === 'light' ? 'stimuliLightColorBtn' : 'stimuliDarkColorBtn');
                    colorBtn.innerHTML = `<span>${type === 'light' ? stimuliInUse.lightColor.name : stimuliInUse.darkColor.name || 'Unknown'}</span>`;

                    // Updating the default stimuli light color in the db
                    ipcRenderer.send(type === 'light' ? 'stimuliLightColor-update' : 'stimuliDarkColor-update', type === 'light' ? stimuliInUse.lightColor.rgba : stimuliInUse.darkColor.rgba);

                    // Wait for the renderer cache to be updated via 'stimuliSettings-update' before changing scenario
                    await new Promise((resolve) => {
                        const handler = (_event, _settings) => {
                            ipcRenderer.removeListener('stimuliSettings-update', handler);
                            resolve();
                        };
                        ipcRenderer.on('stimuliSettings-update', handler);
                    });

                    popupElements.close();
                    await updateScenarioId(105, buttonsList, ViewNames.SETTINGS);
                }, CssConstants.SELECTION_ANIMATION_DURATION);
            };
        });

        const popupElements = createPopup({
            name: 'colorSelection',
            message: `Choose Stimuli ${type === 'light' ? 'Light' : 'Dark'} Color`,
            classes: ['popup--colorSelection'],
            buttons: colorCards
        });
        await updateScenarioId(106, buttonsList, ViewNames.SETTINGS);
    } catch (error) {
        logger.error('Error opening light color selection popup:', error.message);
    }
}

async function showGazeLengthSelectionPopup() {
    try {
        const buttonsList = [];
        const gazeLengthCards = [];
        const gazeLengths = [2, 3, 4]; // in seconds

        gazeLengths.forEach((gazeLength, index) => {
            const idSuffix = ['first', 'second', 'third'][index];

            const gazeLengthCard = document.createElement('div');
            gazeLengthCard.classList.add('gazeLengthCard');

            const selectGazeLengthBtn = document.createElement('button');
            selectGazeLengthBtn.setAttribute('id', `${idSuffix}SettingOptionBtn`);
            selectGazeLengthBtn.classList.add('button', 'popup__btn', 'popup__btn--gazeLength');
            selectGazeLengthBtn.innerHTML = `<span>${gazeLength} Seconds</span>`;
            gazeLengthCard.appendChild(selectGazeLengthBtn);

            buttonsList.push(selectGazeLengthBtn);
            gazeLengthCards.push(gazeLengthCard);

            selectGazeLengthBtn.onclick = () => {
                addButtonSelectionAnimation(selectGazeLengthBtn);
                setTimeout(async () => {
                    stimuliInUse.gazeLengthInSecs = gazeLength;

                    // Updating the UI
                    const gazeLengthBtn = document.getElementById('gazeLengthBtn');
                    gazeLengthBtn.innerHTML = `<span>${stimuliInUse.gazeLengthInSecs || 'Unknown'}</span>`;

                    // Updating the default gaze length in the db
                    ipcRenderer.send('gazeLength-update', stimuliInUse.gazeLengthInSecs);

                    popupElements.close();
                    await updateScenarioId(105, buttonsList, ViewNames.SETTINGS);
                }, CssConstants.SELECTION_ANIMATION_DURATION);
            };
        });

        const popupElements = createPopup({
            name: 'gazeLengthSelection',
            message: 'Choose Gaze Length',
            classes: ['popup--gazeLengthSelection'],
            buttons: gazeLengthCards
        });
        await updateScenarioId(106, buttonsList, ViewNames.SETTINGS);
    } catch (error) {
        logger.error('Error opening gaze length selection popup:', error.message);
    }
}

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            // Disable the button immediately to prevent multiple clicks
            button.disabled = true;
            setTimeout(() => { button.disabled = false; }, 1500);

            addButtonSelectionAnimation(button)
            const buttonId = button.getAttribute('id');

            setTimeout(async () => {
                await stopManager();

                switch (buttonId) {
                    case "generalSettingsBtn":
                        showGeneralSettings();
                        break;
                    case "headsetSettingsBtn":
                        showHeadsetSettings();
                        break;
                    case "stimuliSettingsBtn":
                        showStimuliSettings();
                        break;
                    case "calibrationBtn":
                        // tbi
                        break;
                    case "closeSettingsBtn":
                        if (closeSettingsButton?.dataset.mode === 'back') { // Back to main settings
                            showSettingsSelection();
                        } else { // Close settings overlay
                            await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.SETTINGS);
                        }
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        });
    });
}