const { ipcRenderer } = require('electron');
const logger = require('../main/modules/logger');
const { ViewNames } = require('../utils/constants/enums');

let previousCredentials;

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
        ipcRenderer.send('overlay-close', ViewNames.CREDENTIALS);
    } catch (err) {
        logger.error('Error closing credentials overlay on valid credentials:', err.message);
    }
});

ipcRenderer.on('credentials-invalid', async (event) => {
    try {
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

    buttons = Array.from(document.querySelectorAll('button'));
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

                // If there were previous credentials, then the websocket is already connected with those credentials
                if (previousCredentials) {
                    const prev = previousCredentials;
                    // If credentials are unchanged, just close the overlay
                    if (prev.clientId === clientId && prev.clientSecret === clientSecret) {
                        ipcRenderer.send('overlay-closeAndGetPreviousScenario', ViewNames.CREDENTIALS);
                        return;
                    // If credentials have changed, stop the EEG infrastructure before saving new credentials
                    } else {
                        await ipcRenderer.invoke('eegInfrastructure-stop', ViewNames.CREDENTIALS);
                    }
                }

                // Persist only after successful validation
                await ipcRenderer.invoke('credentials-save', { headsetName, companyName, connectionType, clientId, clientSecret });
            } catch (err) {
                logger.error('Error saving credentials:', err.message);
            }
        });
    }

    if (changeBtn) {
        changeBtn.addEventListener('click', () => {
            // Placeholder for future implementation
            ipcRenderer.invoke('overlay-closeAndGetPreviousScenario', ViewNames.CREDENTIALS);
            ipcRenderer.send('overlay-create', ViewNames.SETTINGS, -1, 'headsetSettingsBtn');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
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
