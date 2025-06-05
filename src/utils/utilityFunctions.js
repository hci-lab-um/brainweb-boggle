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

/**
 * Animates a view sliding in from the bottom, similar to macOS app open animation.
 * @param {object} view - The view to animate (must support getBounds/setBounds).
 * @param {object} webpageBounds - The final bounds for the view (x, y, width, height).
 * @param {number} duration - Animation duration in ms (default 300).
 */
function slideViewUpAndGrow(view, webpageBounds, duration = 300) {
    try {
        const fps = 120;
        const interval = 1000 / fps;
        const steps = Math.ceil(duration / interval);

        // Start with a width of 1px (almost zero)
        const initialWidth = 0.5;
        const finalWidth = webpageBounds.width;
        const deltaWidth = (finalWidth - initialWidth) / steps;

        const initialX = webpageBounds.x + (finalWidth - initialWidth) / 2;
        const finalX = webpageBounds.x;
        const deltaX = (finalX - initialX) / steps;

        const initialY = webpageBounds.y + finalWidth; // below the visible area
        const finalY = webpageBounds.y;
        const deltaY = (finalY - initialY) / steps;

        let currentY = initialY;
        let currentWidth = initialWidth;
        let currentX = initialX;
        let step = 0;

        // Optionally, animate scale for extra effect
        const initialScale = 0.85;
        const finalScale = 1;
        const deltaScale = (finalScale - initialScale) / steps;
        let currentScale = initialScale;

        const intervalId = setInterval(() => {
            try {
                step++;
                currentY += deltaY;
                currentWidth += deltaWidth;
                currentX += deltaX;
                currentScale += deltaScale;

                view.setBounds({
                    x: currentX,
                    y: currentY,
                    width: currentWidth,
                    height: webpageBounds.height
                });

                if (typeof view.setScale === 'function') {
                    view.setScale(currentScale);
                }

                if (step >= steps) {
                    clearInterval(intervalId);
                    view.setBounds(webpageBounds); // Ensure final bounds are set
                    if (typeof view.setScale === 'function') {
                        view.setScale(finalScale);
                    }
                }
            } catch (err) {
                console.error('Error during slide in from bottom:', err.message);
            }
        }, interval);
    } catch (err) {
        console.error('Error sliding in from bottom:', err.message);
    }
}

/**
 * Animates a view sliding down and shrinking (opposite of slideViewUpAndGrow).
 * The view shrinks its width to center and slides down out of view.
 * @param {object} view - The view to animate (must support getBounds/setBounds).
 * @param {object} webpageBounds - The initial bounds for the view (x, y, width, height).
 * @param {number} duration - Animation duration in ms (default 300).
 * @param {function} onComplete - Optional callback when animation finishes.
 */
function slideViewDownAndShrink(view, webpageBounds, duration = 600, onComplete) {
    try {
        // Lower fps for less CPU, but use ease for smoothness
        const fps = 90;
        const interval = 1000 / fps;
        const steps = Math.ceil(duration / interval);

        const initialWidth = webpageBounds.width;
        const finalWidth = 0.5;
        const initialX = webpageBounds.x;
        const finalX = webpageBounds.x + (initialWidth - finalWidth) / 2;
        const initialY = webpageBounds.y;
        const finalY = webpageBounds.y + initialWidth;

        let step = 0;

        // Easing function (easeInOutCubic)
        function ease(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        const initialScale = 1;
        const finalScale = 0.85;

        const intervalId = setInterval(() => {
            try {
                step++;
                const t = Math.min(step / steps, 1);
                const eased = ease(t);

                const currentWidth = initialWidth + (finalWidth - initialWidth) * eased;
                const currentX = initialX + (finalX - initialX) * eased;
                const currentY = initialY + (finalY - initialY) * eased;
                const currentScale = initialScale + (finalScale - initialScale) * eased;

                view.setBounds({
                    x: currentX,
                    y: currentY,
                    width: currentWidth,
                    height: webpageBounds.height
                });

                if (typeof view.setScale === 'function') {
                    view.setScale(currentScale);
                }

                if (step >= steps) {
                    clearInterval(intervalId);
                    view.setBounds(webpageBounds);
                    if (typeof view.setScale === 'function') {
                        view.setScale(1);
                    }
                    if (typeof onComplete === 'function') onComplete();
                }
            } catch (err) {
                console.error('Error during slide down and shrink:', err.message);
            }
        }, interval);
    } catch (err) {
        console.error('Error sliding down and shrinking:', err.message);
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
    slideViewUpAndGrow,
    slideViewDownAndShrink
};
