const { ipcRenderer } = require('electron');
const logger = require('../main/modules/logger');
const { SwitchShortcut } = require('./constants/enums');

const defaultState = Object.freeze({
    headset: '',
    browserState: 'ready',
    adaptiveSwitch: {
        isEnabled: false,
        groupIndex: -1,
        totalGroups: 0
    }
});

let state = { ...defaultState };        // This holds the current state of the status bar
let statusBarElement = null;            // This is the root element of the status bar
let statusBarContainer = null;          // This wraps the existing body content above the status bar
let valueNodes = {};                    // This caches the DOM nodes for status values
let listenersRegistered = false;        // This flag ensures listeners are only registered once

function pushStatusUpdate(partial) {
    ipcRenderer.send('statusBar-updatesFromRenderer', partial);
}

function initStatusBar(initialState = {}) {
    try {
        if (!statusBarElement) {
            const { body } = document;
            if (!body) return null;

            statusBarContainer = document.createElement('div');
            statusBarContainer.classList.add('status-bar__content');
            if (body.id === 'browser') {
                statusBarContainer.classList.add('status-bar__content--browser');
            }

            statusBarElement = document.createElement('footer');
            statusBarElement.classList.add('status-bar');

            // The HTML of the status bar is inserted
            statusBarElement.innerHTML = renderStatusBarHtml();

            const existingChildren = Array.from(body.childNodes);
            existingChildren.forEach((child) => {
                // Move every existing body child (except the status bar elements) into the wrapper so the bar stays fixed at the bottom
                if (child !== statusBarElement && child !== statusBarContainer) {
                    statusBarContainer.appendChild(child);
                }
            });

            body.appendChild(statusBarContainer);
            body.appendChild(statusBarElement);
            body.classList.add('has-status-bar');

            setupStatusValueNodes();
        }

        updateStatusBarState(initialState);
        updateDomElements();
    } catch (error) {
        logger.error('Error initialising status bar:', error);
    }
}

// Function to apply state changes from the renderer process
function applyStatusBarStateChange(partial = {}) {
    updateStatusBarState(partial);
    updateDomElements();
}

function setupStatusValueNodes() {
    valueNodes = {
        headset: statusBarElement.querySelector('[data-status-value="headset"]'),
        browser: statusBarElement.querySelector('[data-status-value="browser"]'),
        adaptive: statusBarElement.querySelector('[data-status-value="adaptive"]')
    };
}

function renderStatusBarHtml() {
    const shortcut = SwitchShortcut?.TOGGLE_BUTTON_GROUPINGS || '';

    return `
        <div class="status-bar__items">
            <div class="status-bar__item" role="status">
                <span class="material-icons--s">published_with_changes</span>
                <span class="status-bar__label">Browser</span>
                <span class="status-bar__value" data-status-value="browser">Ready</span>
            </div>
            <div class="status-bar__item" role="status">
                <span class="material-icons--s">sensors</span>
                <span class="status-bar__label">Headset</span>
                <span class="status-bar__value" data-status-value="headset">—</span>
            </div>            
            <div class="status-bar__item" role="status">
                <span class="material-icons--s">toggle_on</span>
                <span class="status-bar__label">Adaptive Switch</span>
                <span class="status-bar__value" data-status-value="adaptive">Disabled</span>
            </div>
        </div>
        <div class="status-bar__shortcut">
            <span class="material-icons--s">keyboard</span>
            <span class="status-bar__label">Shortcut</span>
            <span class="status-bar__value">${shortcut}</span>
        </div>
    `;
}

// Function that updates the internal state based on a partial update
function updateStatusBarState(partial = {}) {
    if (!partial || typeof partial !== 'object') return;

    if (typeof partial.headset === 'string') {
        state.headset = partial.headset;
    }

    if (typeof partial.browserState === 'string') {
        state.browserState = partial.browserState;
    }

    if (partial.adaptiveSwitch && typeof partial.adaptiveSwitch === 'object') {
        const current = state.adaptiveSwitch;
        const incoming = partial.adaptiveSwitch;
        state.adaptiveSwitch = {
            isEnabled: typeof incoming.isEnabled === 'boolean' ? incoming.isEnabled : current.isEnabled,
            groupIndex: typeof incoming.groupIndex === 'number' ? incoming.groupIndex : current.groupIndex,
            totalGroups: typeof incoming.totalGroups === 'number' ? incoming.totalGroups : current.totalGroups
        };
    }
}

// Function that updates the DOM elements based on the current state
function updateDomElements() {
    if (!statusBarElement) return;

    if (valueNodes.headset) {
        valueNodes.headset.textContent = state.headset || 'Not configured';
    }

    if (valueNodes.browser) {
        valueNodes.browser.textContent = formatBrowserState(state.browserState);
    }

    if (valueNodes.adaptive) {
        valueNodes.adaptive.textContent = formatAdaptiveState(state.adaptiveSwitch);
    }
}

function formatBrowserState(browserState) {
    switch (browserState) {
        case 'loading':
            return 'Loading…';
        case 'error':
            return 'Error';
        default:
            return 'Ready';
    }
}

function formatAdaptiveState(adaptive) {
    if (!adaptive.isEnabled) {
        return 'Disabled';
    }

    if (adaptive.groupIndex === 0) {
        return 'Read Mode';
    }

    if (adaptive.totalGroups <= 0 || adaptive.groupIndex === -1) {
        return 'All Groups';
    }

    return `Group ${adaptive.groupIndex} of ${adaptive.totalGroups}`;
}

module.exports = {
    initStatusBar,
    pushStatusUpdate,
    applyStatusBarStateChange,
    defaultState
};
