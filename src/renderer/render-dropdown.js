// NOTE: This file relies extensively on shared logic from 'tabsAndBookmarksRendererHelper.js'.
// Many core functions for rendering and event handling are handles inside that helper file.
// If you need to update or debug the dropdown overlay, check 'tabsAndBookmarksRendererHelper.js' for shared implementations.

const { ipcRenderer } = require('electron')
const { ViewNames } = require('../utils/constants/enums');
const { initialise } = require('../utils/tabsAndBookmarksRendererHelper');

ipcRenderer.on('dropdown-loaded', async (event, overlayData, isReload = false) => {
    initialise(overlayData, isReload, ViewNames.DROPDOWN);
});

ipcRenderer.on('selectedButton-click', (event, buttonId) => {
    try {
        document.getElementById(buttonId).click();
    } catch (error) {
        logger.error('Error in selectedButton-click handler:', error);
    }
});