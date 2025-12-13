const { ipcRenderer } = require('electron');
const logger = require('../main/modules/logger');
const { ViewNames } = require('../utils/constants/enums');

let previousCredentials;
let actionButtons = [];
let saveLoader;
let isSaving = false;
let hasAttemptedConnection = false;

ipcRenderer.on('credentials-loaded', (event, overlayData) => {
    try {
        previousCredentials = overlayData?.previousCredentials || {};

        // Pre-fill inputs if previous credentials exist
        if (previousCredentials.clientId) {
            const idInput = document.getElementById('cred-client-id');
            if (idInput) idInput.value = previousCredentials.clientId;
        }
        if (previousCredentials.clientSecret) {
            const secretInput = document.getElementById('cred-client-secret');
            if (secretInput) secretInput.value = previousCredentials.clientSecret;
        }

        // If loaded from settings, we need to remove the 'Change Default' button since we're already in settings
        if (overlayData.loadedFrom === ViewNames.SETTINGS) {
            const changeBtn = document.getElementById('cred-change-defaults-btn');
            if (changeBtn) changeBtn.style.display = 'none';
        }

        const info = overlayData?.credentialsInfo || {};
        setupUI(info);
        attachEventListeners(info);
    } catch (err) {
        logger.error('Error initialising credentials overlay:', err.message);
    }
});

ipcRenderer.on('credentials-valid', async (event, credentialsInfo) => {
    try {
        // Close overlay on valid credentials and save in the db
        ipcRenderer.send('credentials-persistInDb', credentialsInfo);
        if (previousCredentials) {
            await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.CREDENTIALS);
        }
        else {
            ipcRenderer.send('overlay-close', ViewNames.CREDENTIALS);
        }
    } catch (err) {
        logger.error('Error closing credentials overlay on valid credentials:', err.message);
    }
});

ipcRenderer.on('credentials-invalid', async (event) => {
    try {
        toggleSavingState(false);
        // Show error message on invalid credentials
        const idError = document.getElementById('cred-client-id-error');
        const secretError = document.getElementById('cred-client-secret-error');
        setError(idError, 'Invalid credentials. Please try again.');
        setError(secretError, 'Invalid credentials. Please try again.');
    } catch (err) {
        logger.error('Error handling invalid credentials in overlay:', err.message);
    }
});

function setupUI({ headsetName, companyName, connectionType }) {
    const title = document.getElementById('cred-title');
    const desc = document.getElementById('cred-desc');
    const idInput = document.getElementById('cred-client-id');
    const secretInput = document.getElementById('cred-client-secret');
    const idError = ensureErrorNode('cred-client-id-error');
    const secretError = ensureErrorNode('cred-client-secret-error');

    if (title) title.textContent = 'Credentials Required';
    if (desc) desc.textContent = `${headsetName} by ${companyName} using ${connectionType} requires credentials. Enter them below or change the default headset and connection type from the settings.`;
    if (idInput) {
        idInput.addEventListener('input', () => clearError(idError));
    }
    if (secretInput) {
        secretInput.addEventListener('input', () => clearError(secretError));
    }

    actionButtons = Array.from(document.querySelectorAll('button'));
    saveLoader = document.getElementById('cred-save-loader');
    toggleSavingState(false);
}

function attachEventListeners({ headsetName, companyName, connectionType }) {
    const saveBtn = document.getElementById('cred-save-btn');
    const changeBtn = document.getElementById('cred-change-defaults-btn');
    const closeBtn = document.getElementById('cred-close-btn');
    const idInput = document.getElementById('cred-client-id');
    const secretInput = document.getElementById('cred-client-secret');
    const idError = document.getElementById('cred-client-id-error');
    const secretError = document.getElementById('cred-client-secret-error');

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (isSaving) return;

            let savingTriggered = false;
            try {
                const clientId = idInput?.value.trim() || '';
                const clientSecret = secretInput?.value.trim() || '';

                let hasError = false;
                if (!clientId) {
                    setError(idError, 'Client ID is required');
                    idInput.classList.add('input--error');
                    hasError = true;
                } else {
                    clearError(idError);
                    idInput.classList.remove('input--error');
                }
                if (!clientSecret) {
                    setError(secretError, 'Client Secret is required');
                    secretInput.classList.add('input--error');
                    hasError = true;
                } else {
                    clearError(secretError);
                    secretInput.classList.remove('input--error');
                }

                if (hasError) return;

                const prevExists = Boolean(previousCredentials && (previousCredentials.clientId || previousCredentials.clientSecret));
                let shouldStopInfrastructure = hasAttemptedConnection;

                if (prevExists) {
                    const prev = previousCredentials;
                    if (prev.clientId === clientId && prev.clientSecret === clientSecret) {
                        await ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.CREDENTIALS);
                        return;
                    }
                    shouldStopInfrastructure = true;
                }

                toggleSavingState(true);
                savingTriggered = true;

                if (shouldStopInfrastructure) {
                    await ipcRenderer.invoke('eegInfrastructure-stop', ViewNames.CREDENTIALS);
                }

                hasAttemptedConnection = true;
                const didSave = await ipcRenderer.invoke('credentials-save', { headsetName, companyName, connectionType, clientId, clientSecret });
                if (!didSave) {
                    throw new Error('credentials-save returned false');
                }
            } catch (err) {
                if (savingTriggered) {
                    toggleSavingState(false);
                    setError(idError, 'Unable to save credentials. Please try again.');
                    setError(secretError, 'Unable to save credentials. Please try again.');
                    idInput?.classList.add('input--error');
                    secretInput?.classList.add('input--error');
                }
                logger.error('Error saving credentials:', err.message);
            }
        });
    }

    if (changeBtn) {
        changeBtn.addEventListener('click', () => {
            if (isSaving) return;
            // Placeholder for future implementation
            ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.CREDENTIALS);
            ipcRenderer.send('overlay-create', ViewNames.SETTINGS, -1, 'headsetSettingsBtn');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (isSaving) return;
            ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.CREDENTIALS);
        });
    }
}

// Used for ensuring error nodes exist
function ensureErrorNode(id) {
    let node = document.getElementById(id);
    if (!node) {
        const map = {
            'cred-client-id-error': 'cred-client-id',
            'cred-client-secret-error': 'cred-client-secret'
        };
        const input = document.getElementById(map[id]);
        if (input && input.parentElement) {
            node = document.createElement('div');
            node.id = id;
            node.classList.add('input-error');
            input.insertAdjacentElement('afterend', node);
        }
    }
    return node;
}

function setError(node, message) {
    if (node) node.textContent = message;
}

function clearError(node) {
    if (node) node.textContent = '';
}

function toggleSavingState(active) {
    isSaving = Boolean(active);
    if (actionButtons.length) {
        actionButtons.forEach((button) => {
            if (!button) return;
            if (isSaving) button.setAttribute('disabled', 'disabled');
            else button.removeAttribute('disabled');
        });
    }
    if (saveLoader) {
        saveLoader.classList.toggle('save-loader--visible', isSaving);
        saveLoader.setAttribute('aria-hidden', isSaving ? 'false' : 'true');
    }
}
