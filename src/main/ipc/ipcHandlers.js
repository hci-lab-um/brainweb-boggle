const { app, WebContentsView, BaseWindow, ipcMain, screen, View } = require('electron')
const path = require('path');
const { ViewNames } = require('../../utils/constants/enums');
const { mouse, Point, keyboard, Key } = require('@nut-tree-fork/nut-js');
const { captureSnapshot } = require('../../utils/utilityFunctions');

const defaultUrl = 'https://www.google.com';

function registerIpcHandlers(context) {
    let { mainWindow, mainWindowContent, tabView, webpageBounds, viewsList, scenarioIdDict, bookmarksList, tabsList, db, updateWebpageBounds, createTabView } = context;

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

        // Extracts the serialisable properties from tabsList
        const serialisableTabsList = await Promise.all(tabsList.map(async tab => ({
            tabId: tab.tabId,
            isActive: tab.isActive,
            snapshot: tab.snapshot ? tab.snapshot : await captureSnapshot(tab),
            title: await tab.webContentsView.webContents.getTitle() ? await tab.webContentsView.webContents.getTitle() : tab.title,
            url: await tab.webContentsView.webContents.getURL() ? await tab.webContentsView.webContents.getURL() : tab.url,
        })));

        let activeTab = tabsList.find(tab => tab.isActive);
        let overlayData = {
            overlayName: overlayName,
            scenarioId: scenarioId,
            buttonId: buttonId,
            isUpperCase: isUpperCase,
            webpageBounds: webpageBounds,
            elementProperties: elementProperties,
            zoomFactor: await activeTab.webContentsView.webContents.getZoomFactor(),
            bookmarksList: bookmarksList,
            tabsList: serialisableTabsList,
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
            let activeTab = tabsList.find(tab => tab.isActive);
            if (activeTab) {
                activeTab.webContentsView.webContents.loadURL(url);
                mainWindowContent.webContents.send('omniboxText-update', url)
            } else {
                console.error('activeTab is not initialized.');
            }
        } catch (err) {
            console.error('Error loading URL in activeTab:', err.message);
        }
    });

    ipcMain.on('webpage-refresh', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.reload();
        } catch (err) {
            console.error('Error refreshing webpage:', err.message);
        }
    });

    ipcMain.on('webpage-zoomIn', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.setZoomLevel(activeTab.webContentsView.webContents.getZoomLevel() + 1);
        } catch (err) {
            console.error('Error zooming in webpage:', err.message);
        }
    });

    ipcMain.on('webpage-zoomOut', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.setZoomLevel(activeTab.webContentsView.webContents.getZoomLevel() - 1);
        } catch (err) {
            console.error('Error zooming out webpage:', err.message);
        }
    });

    ipcMain.on('webpage-zoomReset', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.setZoomLevel(0);
        } catch (err) {
            console.error('Error resetting webpage zoom:', err.message);
        }
    });

    ipcMain.handle('interactiveElements-get', (event) => {
        return new Promise((resolve, reject) => {
            try {
                activeTab.webContentsView.webContents.send('interactiveElements-get');
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
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.send('interactiveElements-addHighlight', elements);
        } catch (err) {
            console.error('Error adding highlight to interactive elements:', err.message);
        }
    });

    ipcMain.on('interactiveElements-removeHighlight', (event, elements) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.send('interactiveElements-removeHighlight', elements);
        } catch (err) {
            console.error('Error removing highlight from interactive elements:', err.message);
        }
    });

    ipcMain.handle('bookmark-add', async (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);

            let url = activeTab.webContentsView.webContents.getURL();
            let title = activeTab.webContentsView.webContents.getTitle();
            let snapshot = await captureSnapshot(activeTab);

            // Check if bookmark already exists
            if (bookmarksList.some(b => b.url === url)) {
                return false; // Already exists
            }

            var bookmark = { url: url, title: title, snapshot: snapshot };
            bookmarksList.push(bookmark);
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
            bookmarksList = [];
        } catch (err) {
            console.error('Error deleting all bookmarks:', err.message);
        }
    });

    ipcMain.on('bookmark-deleteByUrl', async (event, url) => {
        try {
            await db.deleteBookmarkByUrl(url);
            bookmarksList = bookmarksList.filter(bookmark => bookmark.url !== url);

            // Reloading the bookmarks to show the updated bookmarks list
            let topMostView = viewsList[viewsList.length - 1];
            let isReload = true;
            topMostView.webContentsView.webContents.send('bookmarks-loaded', { bookmarksList }, isReload);
        } catch (err) {
            console.error('Error deleting bookmark by URL:', err.message);
        }
    });

    ipcMain.handle('tabs-getData', async () => {
        try {            
            // Return data for all tabs, not just the active one
            return await Promise.all(tabsList.map(async tab => ({
                tabId: tab.tabId,
                isActive: tab.isActive,
                url: await tab.webContentsView.webContents.getURL(),
                title: await tab.webContentsView.webContents.getTitle(),
                snapshot: await captureSnapshot(tab)
            })));
        }
        catch (err) {
            console.error('Error getting tabs data:', err.message);
        }
    });

    ipcMain.handle('tab-add', async () => {
        try {
            createTabView(defaultUrl, true);
            return true;
        } catch (err) {
            console.error('Error adding tab:', err.message);
            return false;
        }
    });

    ipcMain.on('tab-visit', (event, tabId) => {
        // This is used to display the select tab when the user clicks on a tab
        try {
            let tabToActivate = tabsList.find(tab => tab.tabId === tabId);
            if (tabToActivate) {
                tabsList.forEach(tab => tab.isActive = false); // Deactivate all tabs
                tabToActivate.isActive = true; // Activate the selected tab

                if (tabToActivate.isErrorPage) {
                    tabToActivate.webContentsView.webContents.loadURL(tabToActivate.originalURL);
                } else {
                    tabToActivate.webContentsView.webContents.loadURL(tabToActivate.url);
                }

                // Moving the selected tab to the front by removing and re-adding the tabView to the main window child views
                mainWindow.contentView.removeChildView(tabToActivate.webContentsView);
                mainWindow.contentView.addChildView(tabToActivate.webContentsView);
            } else {
                console.error(`Tab with ID ${tabId} not found.`);
            }
        } catch (err) {
            console.error('Error activating tab:', err.message);
        }

    });

    // ipcMain.on('tabs-deleteAll', async (event) => {
    //     try {
    //         await db.deleteAllTabs();
    //         tabs = [];
    //     } catch (err) {
    //         console.error('Error deleting all tabs:', err.message);
    //     }
    // });


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

        let activeTab = tabsList.find(tab => tab.isActive);
        const zoomFactor = await activeTab.webContentsView.webContents.getZoomFactor();

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