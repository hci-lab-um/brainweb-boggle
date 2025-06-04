// NOTE: This file relies extensively on shared logic from 'tabsAndBookmarksRendererHelper.js'.
// Many core functions for rendering and event handling are handles inside that helper file.
// If you need to update or debug bookmark or tab overlays, check 'tabsAndBookmarksRendererHelper.js' for shared implementations.

const { ipcRenderer } = require('electron')
const { ViewNames } = require('../utils/constants/enums');
const { initialise } = require('../utils/tabsAndBookmarksRendererHelper');

ipcRenderer.on('bookmarks-loaded', async (event, overlayData, isReload = false) => {
    initialise(overlayData, isReload, ViewNames.BOOKMARKS);
});