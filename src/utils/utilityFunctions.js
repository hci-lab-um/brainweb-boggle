// Utility function to create a Material Icon element
function createMaterialIcon(size, icon_name) {
    return `<i class="material-icons--${size}">${icon_name}</i>`;
}

// Utility function to capture a snapshot of the active tab - used for the bookmark and tabs feature
async function captureSnapshot(tabView) {
    try {
        return new Promise((resolve, reject) => {
            if (tabView && tabView.webContents) {
                tabView.webContents.capturePage().then(snapshot => {
                    tabView.snapshot = snapshot.toDataURL();
                    resolve();
                }).catch(err => {
                    console.error('Error capturing snapshot:', err.message);
                    reject(err);
                });
            } else {
                reject(new Error('Active tab or webContents not available for capture'));
            }
        });
    } catch (err) {
        console.error('Error capturing snapshot:', err.message);
    }
}

// Utility function to create a popup with overlay
function createPopup({
    name = '',
    message = '',
    icon = '',
    classes = [],
    customContent = null,
    buttons = [],
    timeout = null,
    onClose = null
}) {
    // Creates black background overlay
    const overlay = document.createElement('div');
    overlay.classList.add('overlay');

    // Create popup
    const popup = document.createElement('div');
    popup.classList.add('popup', ...classes);

    // Add message if provided
    if (message) {
        const popupMessage = document.createElement('span');
        popupMessage.classList.add('popup__message');
        popupMessage.textContent = message;
        popup.appendChild(popupMessage);
    }

    // Add icon if provided
    if (icon) {
        popup.innerHTML += icon;
    }

    // Add custom content if provided
    if (customContent) {
        popup.appendChild(customContent);
    }

    // Add buttons if provided
    if (buttons.length > 0) {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('popup__btnsContainer');
        if (name === 'bookmarkAction') buttonsContainer.classList.add('popup__btnsContainer--bookmarkAction');
        buttons.forEach(btn => buttonsContainer.appendChild(btn));
        popup.appendChild(buttonsContainer);
    }

    // Append to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    // Handle timeout/auto-close
    if (timeout) {
        setTimeout(() => {
            overlay.remove();
            popup.remove();
            if (onClose) onClose();
        }, timeout);
    }

    // Return elements for further use
    return { overlay, popup };
}

module.exports = {
    createMaterialIcon,
    captureSnapshot,
    createPopup
};
