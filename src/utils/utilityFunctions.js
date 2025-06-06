// Utility function to create a Material Icon element
function createMaterialIcon(size, icon_name) {
    return `<i class="material-icons--${size}">${icon_name}</i>`;
}

// Utility function to capture a snapshot of the active tab - used for the bookmark and tabs feature
async function captureSnapshot(activeTab) {
    try {
        if (activeTab && activeTab.webContentsView && activeTab.webContentsView.webContents) {
            const snapshot = await activeTab.webContentsView.webContents.capturePage();
            activeTab.snapshot = snapshot.toDataURL();
            return activeTab.snapshot;
        } else {
            console.error('Active tab or webContents not available for capture');
        }
    } catch (err) {
        console.error('Error capturing snapshot:', err.message);
        return null;
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
    overlay.classList.add('overlay', 'fadeIn');

    // Create popup
    const popup = document.createElement('div');
    popup.classList.add('popup', 'border', 'fadeInUp', ...classes);

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
        if (name === 'itemAction') buttonsContainer.classList.add('popup__btnsContainer--itemAction');
        buttons.forEach(btn => buttonsContainer.appendChild(btn));
        popup.appendChild(buttonsContainer);
    }

    // Append to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    // Helper to close with fadeOutDown
    const close = () => {
        // Only close once
        popup.classList.remove('fadeInUp');
        popup.classList.add('fadeOutDown');

        overlay.classList.remove('fadeIn');
        overlay.classList.add('fadeOut');
        
        // Removes the overlay and popup after the animation ends
        const removePopup = () => {
            overlay.remove();
            popup.remove();
            if (onClose) onClose();
        };
        popup.addEventListener('animationend', removePopup, { once: true });
    };

    // Handle timeout/auto-close
    if (timeout) {
        setTimeout(() => {
            close();
        }, timeout);
    }

    // Returns elements for further use, and exposes close method to be used when a button is clicked inside the popup
    return { overlay, popup, close };
}

function createNavigationButton(direction, onClick) {
    const button = document.createElement('button');
    button.classList.add('button', 'button__triangle', `button__triangle--${direction}`);

    if (!document.getElementById('firstArrowKeyBtn')) {
        button.setAttribute('id', 'firstArrowKeyBtn');
    } else if (!document.getElementById('secondArrowKeyBtn')) {
        button.setAttribute('id', 'secondArrowKeyBtn');
    }

    button.addEventListener('click', onClick);
    return button;
}

function updatePaginationIndicators(items, pageSize, currentPage, containerSelector) {
    const paginationContainer = document.querySelector(containerSelector);
    if (!paginationContainer) return;

    const totalPages = Math.ceil(items.length / pageSize);
    paginationContainer.innerHTML = '';

    if (items.length > pageSize) {
        for (let i = 0; i < totalPages; i++) {
            const indicator = document.createElement('div');
            indicator.classList.add('pagination__indicator');
            if (i === currentPage) indicator.classList.add('pagination__indicator--active');
            paginationContainer.appendChild(indicator);
        }
    }
}

function paginate(items, pageSize, currentPage) {
    const start = currentPage * pageSize;
    const end = Math.min(start + pageSize, items.length);
    return items.slice(start, end);
}

function slideInView(view, webpageBounds, duration = 300) {
    try {
        const fps = 120; // High frame rate for smoothness
        const interval = 1000 / fps;
        const steps = Math.ceil(duration / interval);

        const initialX = view.getBounds().x;
        const finalX = webpageBounds.x;

        const deltaX = (finalX - initialX) / steps;

        let currentX = initialX;
        let step = 0;

        const intervalId = setInterval(() => {
            try {
                step++;
                currentX += deltaX;

                view.setBounds({
                    x: currentX,
                    y: webpageBounds.y,
                    width: webpageBounds.width,
                    height: webpageBounds.height
                });

                if (step >= steps) {
                    clearInterval(intervalId);
                    view.setBounds(webpageBounds); // Ensure final bounds are set
                }
            } catch (err) {
                console.error('Error during slide in view:', err.message);
            }
        }, interval);
    } catch (err) {
        console.error('Error sliding in view:', err.message);
    }
}

module.exports = {
    createMaterialIcon,
    captureSnapshot,
    createPopup,
    createNavigationButton,
    updatePaginationIndicators,
    paginate,
    slideInView,
};
