const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const logger = require('../main/modules/logger');

let buttons = [];
let settingsContentContainer = null;
let homeUrl = '';
let headsetInUse = '';
let connectionTypeInUse = '';
let closeSettingsButton = null;

ipcRenderer.on('settings-loaded', async (event, overlayData) => {
    try {
        const { scenarioId } = overlayData;

        buttons = document.querySelectorAll('button');
        settingsContentContainer = document.querySelector('.settingsContent');
        closeSettingsButton = document.getElementById('closeSettingsBtn');
        homeUrl = overlayData.homeUrl || '';
        headsetInUse = overlayData.headsetInUse || '';
        connectionTypeInUse = overlayData.connectionTypeInUse || '';

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

function showGeneralSettings() {
    updateVisibility('generalSettings');
    populateGeneralSettings();
    setCloseButtonMode('back');
}

function showStimuliSettings() {
    updateVisibility('stimuliSettings');
    populateStimuliSettings();
    setCloseButtonMode('back');
}

function showSettingsSelection() {
    updateVisibility('settingsSelection');
    setCloseButtonMode('close');
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
                    container.style.display = 'grid';
                    break;
                case 'generalSettings':
                    titleElement.textContent = 'General Settings';
                    container.style.display = 'block';
                    break;
                case 'stimuliSettings':
                    titleElement.textContent = 'Stimuli Settings';
                    container.style.display = 'block';
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

    const homeUrlCard = document.createElement('div');
    homeUrlCard.classList.add('settingCard');
    const homeUrlH3 = document.createElement('h3');
    homeUrlH3.textContent = 'Home URL';
    homeUrlCard.appendChild(homeUrlH3);
    const homeUrlBtn = document.createElement('button');
    homeUrlBtn.id = 'homeUrlBtn';
    homeUrlBtn.classList.add('button');
    homeUrlBtn.rel = 'noreferrer noopener';
    homeUrlCard.appendChild(homeUrlBtn);
    container.appendChild(homeUrlCard);

    const headsetCard = document.createElement('div');
    headsetCard.classList.add('settingCard');
    const headsetCardH3 = document.createElement('h3');
    headsetCardH3.textContent = 'Headset';
    headsetCard.appendChild(headsetCardH3);
    const headsetValue = document.createElement('span');
    headsetValue.id = 'generalSettingsHeadset';
    headsetCard.appendChild(headsetValue);
    container.appendChild(headsetCard);

    const connectionTypeCard = document.createElement('div');
    connectionTypeCard.classList.add('settingCard');
    const connectionTypeCardH3 = document.createElement('h3');
    connectionTypeCardH3.textContent = 'Connection Type';
    connectionTypeCard.appendChild(connectionTypeCardH3);
    const connectionTypeValue = document.createElement('span');
    connectionTypeValue.id = 'generalSettingsConnectionType';
    connectionTypeCard.appendChild(connectionTypeValue);
    container.appendChild(connectionTypeCard);

    if (homeUrlBtn) {
        homeUrlBtn.textContent = homeUrl ? homeUrl : 'Not configured';
    }

    if (headsetValue) {
        headsetValue.textContent = headsetInUse || 'Unknown';
    }
    if (connectionTypeValue) {
        connectionTypeValue.textContent = connectionTypeInUse || 'Unknown';
    }


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

function attachEventListeners() {
    buttons.forEach((button, index) => {
        button.addEventListener('click', async () => {
            // Disable the button immediately to prevent multiple clicks
            button.disabled = true;
            setTimeout(() => { button.disabled = false; }, 1500);

            addButtonSelectionAnimation(button)
            const buttonId = button.getAttribute('id');

            setTimeout(async () => {
                switch (buttonId) {
                    case "generalSettingsBtn":
                        showGeneralSettings();
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
                            await stopManager();
                            await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.SETTINGS);
                        }
                        break;
                }
            }, CssConstants.SELECTION_ANIMATION_DURATION);
        });
    });
}