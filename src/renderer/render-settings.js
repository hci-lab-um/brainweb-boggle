const { ipcRenderer } = require('electron')
const { ViewNames, CssConstants } = require('../utils/constants/enums');
const { updateScenarioId, stopManager } = require('../utils/scenarioManager');
const { addButtonSelectionAnimation } = require('../utils/selectionAnimation');
const logger = require('../main/modules/logger');

let buttons = [];
let settingsSelection = null;
let settingsContentContainer = null;
let generalSettingsInfoContainer = null;
let homeUrl = '';
let headsetInUse = '';

ipcRenderer.on('settings-loaded', async (event, overlayData) => {
    try {
        const { scenarioId } = overlayData;

        buttons = document.querySelectorAll('button');
        settingsSelection = document.getElementById('settingsSelection');
        settingsContentContainer = document.querySelector('.settingsContent');
        homeUrl = overlayData.homeUrl || '';
        headsetInUse = overlayData.headsetInUse || '';

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
                        await stopManager();
                        await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.SETTINGS);
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
}

function resetSettingsContent() {
    if (generalSettingsInfoContainer) {
        generalSettingsInfoContainer.style.display = 'none';
    }

    if (settingsContentContainer) {
        settingsContentContainer.style.display = '';
    }
}

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

    return container;
}

function updateGeneralSettingsInfo() {
    if (!generalSettingsInfoContainer) return;

    const homeLink = generalSettingsInfoContainer.querySelector('#generalSettingsHomeLink');
    const headsetValue = generalSettingsInfoContainer.querySelector('#generalSettingsHeadset');

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
        headsetValue.textContent = formatHeadsetLabel(headsetInUse);
    }
}

function formatHeadsetLabel(headset) {
    if (!headset) {
        return 'Unknown';
    }

    if (headset.toLowerCase() === 'lsl') {
        return 'LSL';
    }

    return headset.charAt(0).toUpperCase() + headset.slice(1);
}
