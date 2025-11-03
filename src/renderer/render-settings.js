const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants, Settings } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const logger = require('../main/modules/logger');
const { createPopup } = require('../utils/utilityFunctions');

let buttons = [];
let settingsContentContainer = null;
let homeUrl = '';
let keyboardLayoutInUse = '';
let headsetInUse = '';
let connectionTypeInUse = '';
let closeSettingsButton = null;

ipcRenderer.on('settings-loaded', async (event, overlayData) => {
    try {
        const { scenarioId } = overlayData;

        buttons = document.querySelectorAll('button');
        settingsContentContainer = document.querySelector('.settingsContent');
        closeSettingsButton = document.getElementById('closeSettingsBtn');
        homeUrl = overlayData.settingsObject.homeUrl || '';
        keyboardLayoutInUse = overlayData.settingsObject.keyboardLayout || '';
        headsetInUse = overlayData.settingsObject.headsetInUse || '';
        connectionTypeInUse = overlayData.settingsObject.connectionTypeInUse || '';

        setCloseButtonMode('close');
        await updateScenarioId(scenarioId, buttons, ViewNames.SETTINGS);
        attachEventListeners();
    } catch (error) {
        logger.error('Error in settings-loaded handler:', error);
    }
});

ipcRenderer.on('selectedButton-click', (event, buttonId) => {
    try {
        document.getElementById(buttonId).click();
    } catch (error) {
        logger.error('Error in selectedButton-click handler:', error);
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
        logger.error('Error in homeUrl-update handler:', error);
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
        logger.error('Error in keyboardLayout-update handler:', error);
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
    
    await selectScenarioIdForHeadset();
}

function showStimuliSettings() {
    updateVisibility('stimuliSettings');
    populateStimuliSettings();
    setCloseButtonMode('back');
}

async function showSettingsSelection() {
    updateVisibility('settingsSelection');
    setCloseButtonMode('close');

    buttons = document.querySelectorAll('button');
    await updateScenarioId(100, buttons, ViewNames.SETTINGS);
}

async function selectScenarioIdForHeadset() {
    // Extracting company and headset name from headsetInUse to be used in the database query
    const companyName = headsetInUse.split(' - ')[1] || '';
    const headsetName = headsetInUse.split(' - ')[0] || '';
    const multipleConnectionTypesExist = (await ipcRenderer.invoke('headsetConnectionTypes-get', headsetName, companyName)).length > 1;

    buttons = document.querySelectorAll('button');
    if (multipleConnectionTypesExist) {
        await updateScenarioId(101, buttons, ViewNames.SETTINGS);
    } else {
        await updateScenarioId(102, buttons, ViewNames.SETTINGS);
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

    cardsContainer.appendChild(homeUrlCard);
    cardsContainer.appendChild(keyboardLayoutCard);

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
            logger.error('Error creating keyboard overlay:', error);
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
                logger.error('Error creating keyboard layout selection modal:', error);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });
}

function populateHeadsetSettings() {
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
                logger.error('Error creating headset selection modal:', error);
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
                logger.error('Error creating connection type selection modal:', error);
            }
        }, CssConstants.SELECTION_ANIMATION_DURATION);
    });
}

function populateStimuliSettings() {
    const container = document.getElementById('stimuliSettings');
    container.innerHTML = ''; // Clear existing content    
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

                    await selectScenarioIdForHeadset();
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
            selectConnectionTypeBtn.textContent = `${connectionType.name}`;
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
                    await selectScenarioIdForHeadset();

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
        logger.error('Error creating connection type selection modal:', error);
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
            selectKeyboardLayoutBtn.textContent = `${keyboardLayout.name}`;
            selectKeyboardLayoutBtn.onclick = () => {
                addButtonSelectionAnimation(selectKeyboardLayoutBtn);
                setTimeout(async () => {
                    popupElements.close();

                    // Update the UI
                    keyboardLayoutInUse = keyboardLayout.name;
                    const keyboardLayoutBtn = document.getElementById('keyboardLayoutBtn');
                    keyboardLayoutBtn.innerHTML = `<span>${keyboardLayoutInUse || 'Unknown'}</span>`;

                    // Update the default keyboard layout in the db
                    ipcRenderer.send('defaultKeyboardLayout-update', keyboardLayoutInUse);

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