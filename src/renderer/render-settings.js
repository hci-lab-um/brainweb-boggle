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
                        showGeneralSettingsDetails();
                        break;
                    case "stimuliSettingsBtn":
                        resetSettingsContent();
                        break;
                    case "calibrationBtn":
                        resetSettingsContent();
                        break;
                    case "closeSettingsBtn":
                        if (closeSettingsButton?.dataset.mode === 'back') { // Back to main settings
                            resetSettingsContent();
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

function showGeneralSettingsDetails() {
    hideSettingsContent();

    if (!generalSettingsInfoContainer) {
        generalSettingsInfoContainer = buildGeneralSettingsInfoContainer();
        settingsContentContainer?.parentElement?.appendChild(generalSettingsInfoContainer);
    }

    updateGeneralSettingsInfo();
    generalSettingsInfoContainer.style.display = 'block';
    setCloseButtonMode('back');
}

function resetSettingsContent() {
    if (generalSettingsInfoContainer) {
        generalSettingsInfoContainer.style.display = 'none';
    }

    if (settingsContentContainer) {
        settingsContentContainer.style.display = '';
    }

    setCloseButtonMode('close');
}

// Hides the settings content container (contains the 3 buttons - generalSettingsBtn, stimuliSettingsBtn and calibrationBtn)
function hideSettingsContent() {
    if (settingsContentContainer) {
        settingsContentContainer.style.display = 'none';
    }
}

function buildGeneralSettingsInfoContainer() {
    const container = document.createElement('div');
    container.id = 'generalSettingsDetails';
    container.classList.add('settingsDetails');

    const heading = document.createElement('h2');
    heading.textContent = 'General Settings';
    container.appendChild(heading);

    const homeParagraph = document.createElement('p');
    homeParagraph.textContent = 'Home URL: ';
    const homeLink = document.createElement('a');
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

    return container;
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

function updateGeneralSettingsInfo() {
    if (!generalSettingsInfoContainer) return;

    const homeLink = generalSettingsInfoContainer.querySelector('#generalSettingsHomeLink');
    const headsetValue = generalSettingsInfoContainer.querySelector('#generalSettingsHeadset');
    const connectionTypeValue = generalSettingsInfoContainer.querySelector('#generalSettingsConnectionType');

    if (homeLink) {
        if (homeUrl) {
            homeLink.textContent = homeUrl;
            homeLink.href = homeUrl;
            homeLink.target = '_blank';
        } else {
            homeLink.textContent = 'Not configured';
            homeLink.removeAttribute('href');
            homeLink.removeAttribute('target');
        }
    }

    if (headsetValue) {
        headsetValue.textContent = headsetInUse || 'Unknown';
    }
    if (connectionTypeValue) {
        connectionTypeValue.textContent = connectionTypeInUse || 'Unknown';
    }
}