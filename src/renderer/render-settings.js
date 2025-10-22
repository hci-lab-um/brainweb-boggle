const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const logger = require('../main/modules/logger');

let buttons = [];
let settingsContentContainer = null;
let generalSettingsInfoContainer = null;
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

function showGeneralSettings(containerIdToShow) {
    updateVisibility(containerIdToShow);
    populateGeneralSettings();
    setCloseButtonMode('back');
}

function showSettingsSelection() {
    updateVisibility('settingsSelection');
    setCloseButtonMode('close');
}


function updateVisibility(containerIdToShow) {
    // Makes the required container visible and all other containers hidden
    const containers = settingsContentContainer.children;
    for (const container of containers) {
        if (container.id !== containerIdToShow) {
            container.style.display = 'none';
        } else if (container.id === 'settingsSelection') {
            container.style.display = 'grid';
        } else {
            container.style.display = 'block';
        }
    }
}

function populateGeneralSettings() {
    const container = document.getElementById('generalSettings');
    container.innerHTML = ''; // Clear existing content

    const heading = document.createElement('h2');
    heading.textContent = 'General Settings';
    container.appendChild(heading);

    const homeParagraph = document.createElement('p');
    homeParagraph.textContent = 'Home URL: ';
    const homeLink = document.createElement('button');
    homeLink.id = 'generalSettingsHomeLink';
    homeLink.rel = 'noreferrer noopener';
    homeParagraph.appendChild(homeLink);
    container.appendChild(homeParagraph);

    const headsetParagraph = document.createElement('p');
    headsetParagraph.textContent = 'Headset: ';
    const headsetValue = document.createElement('span');
    headsetValue.id = 'generalSettingsHeadset';
    headsetParagraph.appendChild(headsetValue);
    container.appendChild(headsetParagraph);

    const connectionTypeParagraph = document.createElement('p');
    connectionTypeParagraph.textContent = 'Connection Type: ';
    const connectionTypeValue = document.createElement('span');
    connectionTypeValue.id = 'generalSettingsConnectionType';
    connectionTypeParagraph.appendChild(connectionTypeValue);
    container.appendChild(connectionTypeParagraph);

    if (homeLink) {
        homeLink.textContent = homeUrl ? homeUrl : 'Not configured';
    }

    if (headsetValue) {
        headsetValue.textContent = headsetInUse || 'Unknown';
    }
    if (connectionTypeValue) {
        connectionTypeValue.textContent = connectionTypeInUse || 'Unknown';
    }
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
                        showGeneralSettings('generalSettings');
                        break;
                    case "stimuliSettingsBtn":
                        // tbi
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