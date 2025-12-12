const { ipcRenderer } = require('electron');
const logger = require('../main/modules/logger');
const { ViewNames } = require('../utils/constants/enums');

let buttons = [];

ipcRenderer.on('credentials-loaded', (event, overlayData) => {
    try {
        const info = overlayData?.credentialsInfo || {};
        setupUI(info);
        attachEvents(info);
    } catch (err) {
        logger.error('Error initialising credentials overlay:', err.message);
    }
});

function setupUI({ headsetName, companyName, connectionType, defaultHeadsetLabel }) {
    const title = document.getElementById('cred-title');
    const desc = document.getElementById('cred-desc');
    const idInput = document.getElementById('cred-client-id');
    const secretInput = document.getElementById('cred-client-secret');

    if (title) title.textContent = 'Credentials Required';
    if (desc) desc.textContent = `${defaultHeadsetLabel} using '${connectionType}' requires credentials. Enter them below or change defaults.`;
    if (idInput) idInput.value = '';
    if (secretInput) secretInput.value = '';

    buttons = Array.from(document.querySelectorAll('button'));
}

function attachEvents({ headsetName, companyName, connectionType }) {
    const saveBtn = document.getElementById('cred-save-btn');
    const changeBtn = document.getElementById('cred-change-defaults-btn');
    const closeBtn = document.getElementById('cred-close-btn');

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            try {
                const clientId = document.getElementById('cred-client-id').value.trim();
                const clientSecret = document.getElementById('cred-client-secret').value.trim();
                await ipcRenderer.invoke('credentials-save', { headsetName, companyName, connectionType, clientId, clientSecret });
                ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.CREDENTIALS);
            } catch (err) {
                logger.error('Error saving credentials:', err.message);
            }
        });
    }

    if (changeBtn) {
        changeBtn.addEventListener('click', () => {
            // Placeholder for future implementation
            ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.CREDENTIALS);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.CREDENTIALS);
        });
    }
}
