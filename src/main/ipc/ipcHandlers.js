const { app, WebContentsView, BaseWindow, ipcMain, screen } = require('electron')
const path = require('path');
const { ViewNames } = require('../../utils/constants/enums');
const { mouse, Point, keyboard, Key } = require('@nut-tree-fork/nut-js');
const { captureSnapshot } = require('../../utils/utilityFunctions');

function registerIpcHandlers(context) {
    let { mainWindow, mainWindowContent, tabView, webpageBounds, viewsList, scenarioIdDict, bookmarks, db, updateWebpageBounds } = context;

    ipcMain.on('overlay-create', async (event, overlayName, scenarioId, buttonId = null, isUpperCase = false, elementProperties) => {
        let mainWindowContentBounds = mainWindow.getContentBounds();

        let overlayContent = new WebContentsView({
            webPreferences: {
                nodeIntegrationInWorker: true,
                contextIsolation: true,
                preload: path.join(__dirname, `../../renderer/render-${overlayName}.js`),
                transparent: true,
            },
        })

        viewsList.push({
            webContentsView: overlayContent,
            name: overlayName, // IMP: overlayName must be the same as the .html and the renderer file
        });

        mainWindow.contentView.addChildView(overlayContent)
        overlayContent.setBounds({ x: 0, y: 0, width: mainWindowContentBounds.width, height: mainWindowContentBounds.height })
        overlayContent.webContents.focus();
        overlayContent.webContents.openDevTools();

        let overlayData = {
            overlayName: overlayName,
            scenarioId: scenarioId,
            buttonId: buttonId,
            isUpperCase: isUpperCase,
            webpageBounds: webpageBounds,
            elementProperties: elementProperties,
            zoomFactor: await tabView.webContents.getZoomFactor(),
            bookmarks: bookmarks,
        }

        overlayContent.webContents.loadURL(path.join(__dirname, `../../pages/html/${overlayName}.html`)).then(async () => {
            try {
                overlayContent.webContents.send(`${overlayName}-loaded`, overlayData);
            } catch (err) {
                console.error(`Error sending scenarioId to the render-${overlayName}:`, err.message);
            }
        }).catch(err => {
            console.error(`Error loading ${overlayName} overlay:`, err.message);
        });
    });

    /**
     * This IPC event is used when an overlay is closed and we need to get the scenario of the view that was behind it.
     * For example, when I open the keyboard with an empty text area, I am initially on scenario 80. If I press the space
     * bar, the scenario changes to 83. If I then press on the arrow keys, a new overlay displaying each arrow key opens up.
     * If I press the cancel button (with id 'cancelBtn'), I would need to get the scenarioId that was last used in the
     * keybord overlay (i.e. 83) and send it to the keyboard so that the same buttons that were flickering before the arrow
     * keys overlay was opened, start flickering again.
     */
    ipcMain.on('overlay-closeAndGetPreviousScenario', (event, overlayName) => {
        // topMostView may also be the mainWindow hence why it is called VIEW not OVERLAY  
        try {
            mainWindow.contentView.removeChildView(viewsList.pop().webContentsView);

            // Deleting the dictionary entry for the closed overlay
            delete scenarioIdDict[overlayName];

            // This was done because the contentView does not have a function that returns the top most child view.
            // Hence we are using our viewsList.
            let topMostView = viewsList[viewsList.length - 1];
            let lastScenarioId = scenarioIdDict[topMostView.name].pop();
            topMostView.webContentsView.webContents.send('scenarioId-update', lastScenarioId);
            topMostView.webContentsView.webContents.focus();
        } catch (err) {
            console.error('Error closing overlay:', err.message);
        }
    });

    /**
     * This IPC event is used when an overlay is closed but we DO NOT need to get the scenario of the view that was behind it.
     * For example, when I open the keyboard with an empty text area, I am initially on scenario 80. If I press the space
     * bar, the scenario changes to 83. If I then press on the arrow keys, a new overlay displaying each arrow key opens up.
     * If I DO NOT press the cancel button (with id 'cancelBtn'), and select an arrow key instead, then I would NOT need to 
     * get the previous scenarioId (i.e. 83). This is because when a key is pressed, the scenario in keyboard changes (most
     * of the time). Therefore, the exact scenario that is needed is calculated through a function 'getScenarioNumber()' that
     * is found in the render-keybaord.js file.
     */
    ipcMain.on('overlay-close', (event) => {
        try {
            mainWindow.contentView.removeChildView(viewsList.pop().webContentsView);

            // Deleting the dictionary entry for the closed overlay (i.e. the keyboard keys overlay)
            delete scenarioIdDict[ViewNames.KEYBOARD_KEYS];

            let topMostView = viewsList[viewsList.length - 1];
            topMostView.webContentsView.webContents.focus();
        } catch (err) {
            console.error('Error closing overlay:', err.message);
        }
    });

    ipcMain.on('scenarioIdDict-update', (event, scenarioId, viewName) => {
        try {
            if (!scenarioIdDict[viewName]) {
                scenarioIdDict[viewName] = [];
            }
            scenarioIdDict[viewName].push(scenarioId);
            console.log(`Scenario ID updated for ${viewName}:`, scenarioId);
        } catch (err) {
            console.error('Error updating scenarioIdDict:', err.message);
        }
    });

    ipcMain.on('textarea-populate', (event, text) => {
        try {
            // Clearing the keyboard entry from the scenarioIdDict
            delete scenarioIdDict[ViewNames.KEYBOARD];

            // Finding the overlay with name keyboard
            let keyboardOverlay = viewsList.find(view => view.name === ViewNames.KEYBOARD);
            keyboardOverlay.webContentsView.webContents.send('textarea-populate', text);
        } catch (err) {
            console.error('Error populating textarea:', err.message);
        }
    });

    ipcMain.on('textarea-moveCursor', (event, iconName) => {
        try {
            // Clearing the keyboard entry from the scenarioIdDict
            delete scenarioIdDict[ViewNames.KEYBOARD];

            // Finding the overlay with name keyboard
            let keyboardOverlay = viewsList.find(view => view.name === ViewNames.KEYBOARD);
            keyboardOverlay.webContentsView.webContents.send('textarea-moveCursor', iconName);
        } catch (err) {
            console.error('Error moving cursor in textarea:', err.message);
        }
    });

    ipcMain.on('url-load', (event, url) => {
        try {
            if (tabView && tabView.webContents) {
                tabView.webContents.loadURL(url);
                mainWindowContent.webContents.send('omniboxText-update', url)
            } else {
                console.error('tabView is not initialized.');
            }
        } catch (err) {
            console.error('Error loading URL in tabView:', err.message);
        }
    });

    ipcMain.on('webpage-refresh', (event) => {
        try {
            // Eventually use a tabViewsList instead of a single tabView, to find the active tabView
            tabView.webContents.reload();
        } catch (err) {
            console.error('Error refreshing webpage:', err.message);
        }
    });

    ipcMain.on('webpage-zoomIn', (event) => {
        try {
            // Eventually use a tabViewsList instead of a single tabView, to find the active tabView
            tabView.webContents.setZoomLevel(tabView.webContents.getZoomLevel() + 1);
        } catch (err) {
            console.error('Error zooming in webpage:', err.message);
        }
    });

    ipcMain.on('webpage-zoomOut', (event) => {
        try {
            // Eventually use a tabViewsList instead of a single tabView, to find the active tabView
            tabView.webContents.setZoomLevel(tabView.webContents.getZoomLevel() - 1);
        } catch (err) {
            console.error('Error zooming out webpage:', err.message);
        }
    });

    ipcMain.on('webpage-zoomReset', (event) => {
        try {
            // Eventually use a tabViewsList instead of a single tabView, to find the active tabView
            tabView.webContents.setZoomLevel(0);
        } catch (err) {
            console.error('Error resetting webpage zoom:', err.message);
        }
    });

    ipcMain.handle('interactiveElements-get', (event) => {
        return new Promise((resolve, reject) => {
            try {
                tabView.webContents.send('interactiveElements-get');
                ipcMain.once('interactiveElements-response', (event, elements) => {
                    if (elements) {
                        resolve(elements);
                    } else {
                        reject(new Error('No interactive elements found'));
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    });

    ipcMain.on('interactiveElements-addHighlight', (event, elements) => {
        try {
            tabView.webContents.send('interactiveElements-addHighlight', elements);
        } catch (err) {
            console.error('Error adding highlight to interactive elements:', err.message);
        }
    });

    ipcMain.on('interactiveElements-removeHighlight', (event, elements) => {
        try {
            tabView.webContents.send('interactiveElements-removeHighlight', elements);
        } catch (err) {
            console.error('Error removing highlight from interactive elements:', err.message);
        }
    });

    ipcMain.handle('bookmark-add', async (event) => {
        try {
            try {
                await captureSnapshot(tabView);
            } catch (err) {
                console.error(err);
            }

            let url = tabView.webContents.getURL();
            let title = tabView.webContents.getTitle();
            let snapshot = tabView.snapshot;

            // Check if bookmark already exists
            if (bookmarks.some(b => b.url === url)) {
                return false; // Already exists
            }

            var bookmark = { url: url, title: title, snapshot: snapshot };
            bookmarks.push(bookmark);
            await db.addBookmark(bookmark);
            return true;
        } catch (err) {
            console.error('Error adding bookmark:', err.message);
            return false;
        }
    });

    ipcMain.on('bookmarks-deleteAll', async (event) => {
        try {
            await db.deleteAllBookmarks();
            bookmarks = [];
        } catch (err) {
            console.error('Error deleting all bookmarks:', err.message);
        }
    });

    ipcMain.on('bookmark-deleteByUrl', async (event, url) => {
        try {
            await db.deleteBookmarkByUrl(url);
            bookmarks = bookmarks.filter(bookmark => bookmark.url !== url);

            // Reloading the bookmarks to show the updated bookmarks list
            let topMostView = viewsList[viewsList.length - 1];
            let isReload = true;
            topMostView.webContentsView.webContents.send('bookmarks-loaded', {bookmarks: bookmarks}, isReload);
        } catch (err) {
            console.error('Error deleting bookmark by URL:', err.message);
        }
    });

    ipcMain.on('mouse-click-nutjs', async (event, coordinates) => {
        // Always update webpageBounds before clicking
        webpageBounds = await updateWebpageBounds(mainWindowContent.webContents);

        const win = BaseWindow.getFocusedWindow();
        const bounds = win.getBounds();
        const contentBounds = win.getContentBounds();
        const display = screen.getDisplayMatching(bounds);
        const scaleFactor = display.scaleFactor;

        // Correct for frame offset
        const frameOffsetX = contentBounds.x - bounds.x;
        const frameOffsetY = contentBounds.y - bounds.y;

        // Get global screen coordinates of window
        const windowScreenX = bounds.x + frameOffsetX;
        const windowScreenY = bounds.y + frameOffsetY;

        const webpageX = windowScreenX + webpageBounds.x;
        const webpageY = windowScreenY + webpageBounds.y;

        const zoomFactor = await tabView.webContents.getZoomFactor();

        // Get the element's position within the tab (taking the zoom level into consideration)
        const elementX = webpageX + (coordinates.x * zoomFactor);
        const elementY = webpageY + (coordinates.y * zoomFactor);

        // Convert to physical pixels if needed
        const finalX = elementX * scaleFactor;
        const finalY = elementY * scaleFactor;

        const targetPoint = new Point(finalX, finalY)
        mouse.move(targetPoint).then(() => mouse.leftClick());
    });

    ipcMain.on('keyboard-arrow-nutjs', async (event, direction) => {
        const keyMap = {
            up: Key.Up,
            down: Key.Down,
            left: Key.Left,
            right: Key.Right,
            home: Key.Home,
            end: Key.End,
        };
        const key = keyMap[direction];
        if (key) {
            await keyboard.pressKey(key);
            await keyboard.releaseKey(key);
        }
    });

    ipcMain.on('keyboard-type-nutjs', async (event, value) => {
        // Erases everything: Ctrl+A then Backspace
        await keyboard.pressKey(Key.LeftControl, Key.A);
        await keyboard.releaseKey(Key.A, Key.LeftControl);
        await keyboard.pressKey(Key.Backspace);
        await keyboard.releaseKey(Key.Backspace);

        // Types the new value
        if (value) {
            await keyboard.type(value);
        }
    });

    ipcMain.on('app-exit', (event) => {
        try {
            app.quit();
        } catch (err) {
            console.error('Error exiting app:', err.message);
        }
    });
}

module.exports = { registerIpcHandlers };