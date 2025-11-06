const { app, WebContentsView, BaseWindow, ipcMain, screen, View } = require('electron')
const path = require('path');
const { ViewNames } = require('../../utils/constants/enums');
const { mouse, Point, keyboard, Key } = require('@nut-tree-fork/nut-js');
const { captureSnapshot } = require('../../utils/utilityFunctions');
const logger = require('../modules/logger');
const { processDataWithFbcca } = require('../modules/eeg-pipeline');
const { fbccaConfiguration } = require('../../ssvep/fbcca-js/fbcca_config');
const { browserConfig } = require('../../../configs/browserConfig');

let bciIntervalId = null;           // This will hold the ID of the BCI interval
let shouldCreateTabView = false;    // This will be used to determine if a new tab should be created when closing the MORE overlay
mouse.config.autoDelayMs = 0;       // Disables auto delay for faster clicking
keyboard.config.autoDelayMs = 50;   // Disables auto delay for faster typing

async function registerIpcHandlers(context) {
    //////////////// THESE VARIABLES ARE BEING PASSED BY VALUE (NOT BY REFERENCE) ////////////////
    let {
        mainWindow,
        mainWindowContent,
        webpageBounds,
        viewsList,
        scenarioIdDict,
        bookmarksList,
        tabsList,
        db,
        setAdaptiveSwitchInUse,
        updateWebpageBounds,
        createTabView,
        deleteAndInsertAllTabs,
        updateNavigationButtons
    } = context;

    // Helper function to serialise tabsList
    async function getSerialisableTabsList(tabsList) {
        return Promise.all(tabsList.map(async tab => {

            // Tabs that were saved in the database but not yet loaded will have webContentsView set to null.
            // and therefore, won't update the snapshot, title, and URL to the latest values - because there is no latest value.
            if (tab.webContentsView) {
                updateWebpageBounds(mainWindowContent.webContents).then(webpageBounds => {
                    webpageBounds = webpageBounds;
                    tab.webContentsView.setBounds(webpageBounds);
                });
                tab.title = (await tab.webContentsView.webContents.getTitle()) || tab.title;
                tab.url = (await tab.webContentsView.webContents.getURL()) || tab.url;
                tab.snapshot = await captureSnapshot(tab) || tab.snapshot; // Mutates the snapshot in tabsList
            }

            return {
                tabId: tab.tabId,
                isActive: tab.isActive,
                snapshot: tab.snapshot,
                title: tab.title,
                url: tab.url,
                isErrorPage: tab.isErrorPage,
                originalURL: tab.originalURL
            };
        }));
    }

    
    ipcMain.on('bciInterval-restart', (event, scenarioId, stimuliFrequencies=[], activeButtonIds=[]) => { 
        // PARAMETERS: stimuliFrequencies & activeButtonIds are not required when using the scenarioConfig file. They are required ONLY when using an adaptive switch.
        
        // Clear the previous interval if it exists
        if (bciIntervalId) {
            clearInterval(bciIntervalId);
        }

        // Set new interval to process data every 4 seconds
        bciIntervalId = setInterval(() => {
            // Process the latest data with the fbcca algorithm. 
            // viewsList will be used to determine which view to process the data for
            processDataWithFbcca(scenarioId, viewsList, stimuliFrequencies, activeButtonIds);
        }, fbccaConfiguration.gazeLengthInSecs * 1000);
    });

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
        const serialisableTabsList = await getSerialisableTabsList(tabsList);
        const activeTab = tabsList.find(tab => tab.isActive);

        if (elementProperties && elementProperties.id === 'omnibox') {
            if (activeTab.isErrorPage) {
                elementProperties.value = activeTab.originalURL; // If the tab is an error page, we use the original URL
            } else {
                elementProperties.value = await activeTab.webContentsView.webContents.getURL();
            }
        }

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
            optionsList: elementProperties ? elementProperties.options : null,
            settingsObject: {
                homeUrl: await db.getDefaultURL(),
                keyboardLayout: await db.getDefaultKeyboardLayout(),
                headsetInUse: await db.getDefaultHeadset(),
                connectionTypeInUse: await db.getDefaultConnectionType(),
                adaptiveSwitchInUse: await db.getAdaptiveSwitchConnected(),
            }
        }

        overlayContent.webContents.loadURL(path.join(__dirname, `../../pages/html/${overlayName}.html`)).then(async () => {
            try {
                overlayContent.webContents.send(`${overlayName}-loaded`, overlayData);
            } catch (err) {
                logger.error(`Error sending scenarioId to the render-${overlayName}:`, err.message);
            }
        }).catch(err => {
            logger.error(`Error loading ${overlayName} overlay:`, err.message);
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
    ipcMain.handle('overlay-closeAndGetPreviousScenario', async (event, overlayName) => {
        // topMostView may also be the mainWindow hence why it is called VIEW not OVERLAY  
        try {
            let poppedView = viewsList[viewsList.length - 1]; // Gets the last view in the list
            console.log('viewsList:', viewsList);
            if (poppedView?.name !== ViewNames.MAIN_WINDOW) {
                poppedView = viewsList.pop();
                mainWindow.contentView.removeChildView(poppedView.webContentsView);

                // Deleting the dictionary entry for the closed overlay
                delete scenarioIdDict[overlayName];

                // This was done because the contentView does not have a function that returns the top most child view.
                // Hence we are using our viewsList.
                let topMostView = viewsList[viewsList.length - 1];
                let lastScenarioId = scenarioIdDict[topMostView.name].pop();

                if (shouldCreateTabView && topMostView.name === ViewNames.MAIN_WINDOW) {
                    shouldCreateTabView = false; // Resetting the flag after creating the tab view
                    let activeTab = tabsList.find(tab => tab.isActive);
                    await createTabView(activeTab.url, false, activeTab);
                } else {
                    // Send scenarioId-update and wait for renderer acknowledgment before returning true
                    await new Promise((resolve, reject) => {
                        const ackChannel = 'scenarioId-update-complete';
                        const ackHandler = (event, ackScenarioId) => {
                            if (ackScenarioId === lastScenarioId) {
                                ipcMain.removeListener(ackChannel, ackHandler);
                                resolve();
                            }
                        };
                        ipcMain.on(ackChannel, ackHandler);
                        topMostView.webContentsView.webContents.send('scenarioId-update', lastScenarioId);
                    });
                }

                topMostView.webContentsView.webContents.focus();
                return true; // Indicate completion
            } else {
                logger.error('No view to pop or the popped view is the main window.');
                return false; // Indicate failure
            }
        } catch (err) {
            logger.error('Error closing overlay:', err.message);
            throw err;
        }
    });

    ipcMain.handle('app-getVersion', async () => {
        try {
            return app.getVersion();
        } catch (err) {
            logger.error('Error retrieving app version:', err.message);
            throw err;
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
    ipcMain.on('overlay-close', async (event, overlayName) => {
        try {
            let poppedView = viewsList[viewsList.length - 1]; // Gets the last view in the list
            if (poppedView?.name !== ViewNames.MAIN_WINDOW) {
                poppedView = viewsList.pop();
                mainWindow.contentView.removeChildView(poppedView.webContentsView);

                // Deleting the dictionary entry for the closed overlay
                delete scenarioIdDict[overlayName];

                let topMostView = viewsList[viewsList.length - 1];
                topMostView.webContentsView.webContents.focus();

                if (shouldCreateTabView && topMostView.name === ViewNames.MAIN_WINDOW) {
                    shouldCreateTabView = false; // Resetting the flag after creating the tab view
                    let activeTab = tabsList.find(tab => tab.isActive);
                    await createTabView(activeTab.url, false, activeTab);
                }
            } else {
                logger.error('No view to pop or the popped view is the main window.');
                return false; // Indicate failure
            }
        } catch (err) {
            logger.error('Error closing overlay:', err.message);
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
            logger.error('Error updating scenarioIdDict:', err.message);
        }
    });

    ipcMain.on('readMode-stop', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive === true);
            if (activeTab) {
                updateNavigationButtons(activeTab.webContentsView);
            }
        } catch (err) {
            logger.error('Error stopping read mode:', err.message);
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
            logger.error('Error populating textarea:', err.message);
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
            logger.error('Error moving cursor in textarea:', err.message);
        }
    });

    ipcMain.on('textarea-clearAll', (event) => {
        try {
            // Clearing the keyboard entry from the scenarioIdDict
            delete scenarioIdDict[ViewNames.KEYBOARD];

            // Finding the overlay with name keyboard
            let keyboardOverlay = viewsList.find(view => view.name === ViewNames.KEYBOARD);
            keyboardOverlay.webContentsView.webContents.send('textarea-clearAll');
        } catch (err) {
            logger.error('Error clearing all the textarea:', err.message);
        }
    });

    ipcMain.on('url-load', (event, url) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            if (activeTab) {
                activeTab.lastNavigationTitle = '';
                activeTab.webContentsView.webContents.loadURL(url);
                let title = activeTab.webContentsView.webContents.getTitle()
                if (!title) title = url; // Fallback to URL if title is not available
                mainWindowContent.webContents.send('omniboxText-update', title)
            } else {
                logger.error('activeTab is not initialized.');
            }
        } catch (err) {
            logger.error('Error loading URL in activeTab:', err.message);
        }
    });

    ipcMain.on('homeUrl-update', (event, newUrl) => {
        try {
            // Updates the default URL in the database
            db.updateDefaultURL(newUrl);

            // Updates the homeUrl button inner text in settings overlay if it is open
            let settingsOverlay = viewsList.find(view => view.name === ViewNames.SETTINGS);
            if (settingsOverlay) {
                settingsOverlay.webContentsView.webContents.send('homeUrl-update', newUrl);
            }
        } catch (err) {
            logger.error('Error updating home URL:', err.message);
        }
    });

    ipcMain.on('keyboardLayout-update', (event, layout) => {
        try {
            // Updates the default keyboard layout in the database
            db.updateDefaultKeyboardLayout(layout);

            // Updates the keyboardLayout button inner text in settings overlay if it is open
            let settingsOverlay = viewsList.find(view => view.name === ViewNames.SETTINGS);
            if (settingsOverlay) {
                settingsOverlay.webContentsView.webContents.send('keyboardLayout-update', layout);
            }
        } catch (err) {
            logger.error('Error updating keyboard layout:', err.message);
        }
    });

    ipcMain.on('adaptiveSwitch-update', async (event, isEnabled) => {
        try {
            // Updates the adaptive switch status in the database
            await db.updateAdaptiveSwitchStatus(isEnabled);
            
            // Updates the variable in main.js immediately
            if (typeof setAdaptiveSwitchInUse === 'function') {
                setAdaptiveSwitchInUse(isEnabled);
            }

            // Updates the adaptive switch button inner text in settings overlay if it is open
            let settingsOverlay = viewsList.find(view => view.name === ViewNames.SETTINGS);
            if (settingsOverlay) {
                settingsOverlay.webContentsView.webContents.send('adaptiveSwitch-update', isEnabled);
            }
        } catch (err) {
            logger.error('Error updating adaptive switch status:', err.message);
        }
    });

    ipcMain.on('keyboard-upperCaseToggle', (event, isUpperCase) => {
        try {
            let keyboardOverlay = viewsList.find(view => view.name === ViewNames.KEYBOARD);
            if (keyboardOverlay) {
                keyboardOverlay.webContentsView.webContents.send('keyboard-upperCaseToggle', isUpperCase);
            }
        } catch (err) {
            logger.error('Error updating keyboard upper case preference:', err.message);
        }
    });

    ipcMain.on('defaultHeadset-update', async (event, newHeadset) => {
        try {
            // Updates the default headset in the database
            db.updateDefaultHeadset(newHeadset);
        } catch (err) {
            logger.error('Error updating default headset:', err.message);
        }
    });

    ipcMain.on('defaultConnectionType-update', async (event, newConnectionType) => {
        try {
            db.updateDefaultConnectionType(newConnectionType);
        } catch (err) {
            logger.error('Error updating default connection type:', err.message);
        }
    });

    ipcMain.handle('headsetConnectionTypes-get', async (event, headsetName, companyName) => {
        try {
            return await db.getHeadsetConnectionTypes(headsetName, companyName);
        } catch (err) {
            logger.error('Error checking multiple connection types existence:', err.message);
        }
    });

    ipcMain.handle('connectionTypeData-get', async (event, connectionType) => {
        try {
            return await db.getConnectionTypeData(connectionType);
        } catch (err) {
            logger.error('Error retrieving connection type data:', err.message);
        }
    });

    ipcMain.handle('headsets-get', async () => {
        try {
            return await db.getHeadsets();
        } catch (err) {
            logger.error('Error retrieving available headsets:', err.message);
            return [];
        }
    });

    ipcMain.handle('keyboardLayouts-get', async () => {
        try {
            return await db.getKeyboardLayouts();
        } catch (err) {
            logger.error('Error retrieving available headsets:', err.message);
            return [];
        }
    });

    ipcMain.handle('bestUserFrequencies-get', async () => {
        try {
            return await db.getBestUserFrequencies();
        } catch (err) {
            logger.error('Error retrieving best user frequencies:', err.message);
            return [];
        }
    });

    ipcMain.handle('adaptiveSwitchConnected-get', async () => {
        try {
            return await db.getAdaptiveSwitchConnected();
        } catch (err) {
            logger.error('Error retrieving adaptive switch connected status:', err.message);
            return false;
        }
    });

    function countIframeMatches(term) {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        let iframeMatchCount = 0;

        for (const iframe of iframes) {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                const text = doc.body?.innerText || '';
                const matches = text.toLowerCase().match(new RegExp(term.toLowerCase(), 'g')) || [];
                iframeMatchCount += matches.length;
            } catch (e) {
                // Cross-origin iframe — skip
            }
        }

        return iframeMatchCount;
    }

    // Search does not include content inside embedded sections like iframes.
    ipcMain.on('text-findInPage', async (event, searchText) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);

            let iframeCount = await activeTab.webContentsView.webContents.executeJavaScript(`(${countIframeMatches.toString()})(${JSON.stringify(searchText)})`);

            // Remove any existing listeners to prevent duplicates
            activeTab.webContentsView.webContents.removeAllListeners('found-in-page');

            activeTab.webContentsView.webContents.once('found-in-page', (event, result) => {
                // result.activeMatchOrdinal = current match index (1-based)
                // result.matches = total matches

                console.log('iframeCount:', iframeCount);
                console.log('result before:', result.matches);

                const correctedMatches = result.matches - iframeCount;
                result.matches = correctedMatches < 0 ? 0 : correctedMatches; // Ensuring matches is not negative
                console.log('result after:', result.matches);

                let seekOverlay = viewsList.find(view => view.name === ViewNames.SEEK);
                if (seekOverlay) {
                    seekOverlay.webContentsView.webContents.send('text-findInPage-response', searchText, result);
                }

                if (result.matches === 0) {
                    activeTab.webContentsView.webContents.stopFindInPage('clearSelection');
                }
            });

            activeTab.webContentsView.webContents.findInPage(searchText);

            // Reset the search position to the top of the page so that the next search starts from the top
            activeTab.webContentsView.webContents.executeJavaScript(`(${resetSearchPositionToTop.toString()})`)
        } catch (err) {
            logger.error('Error finding text in page:', err.message);
        }
    });

    ipcMain.on('word-findNext', (event, { searchText, forward }) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            if (forward) activeTab.webContentsView.webContents.findInPage(searchText, { findNext: true });
            else activeTab.webContentsView.webContents.findInPage(searchText, { findNext: true, forward: false });
        } catch (err) {
            logger.error('Error in word-findNext handler:', err.message);
        }
    });

    ipcMain.on('find-stop', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.stopFindInPage('clearSelection');
        } catch (err) {
            logger.error('Error stopping find in page:', err.message);
        }
    });

    ipcMain.on('webpage-refresh', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.reload();
        } catch (err) {
            logger.error('Error refreshing webpage:', err.message);
        }
    });

    ipcMain.on('webpage-zoomIn', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.setZoomLevel(activeTab.webContentsView.webContents.getZoomLevel() + 1);
        } catch (err) {
            logger.error('Error zooming in webpage:', err.message);
        }
    });

    ipcMain.on('webpage-zoomOut', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.setZoomLevel(activeTab.webContentsView.webContents.getZoomLevel() - 1);
        } catch (err) {
            logger.error('Error zooming out webpage:', err.message);
        }
    });

    ipcMain.on('webpage-zoomReset', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.setZoomLevel(0);
        } catch (err) {
            logger.error('Error resetting webpage zoom:', err.message);
        }
    });

    ipcMain.on('webpage-goBack', (event) => {
        try {
            var tab = tabsList.find(tab => tab.isActive === true);
            tab.webContentsView.webContents.send('navigate-back');
        } catch (err) {
            logger.error('Error in webpage-goBack handler:', err.message);
        }
    });

    ipcMain.on('webpage-goForward', (event) => {
        try {
            var tab = tabsList.find(tab => tab.isActive === true);
            tab.webContentsView.webContents.send('navigate-forward');
        } catch (err) {
            logger.error('Error in webpage-goForward handler:', err.message);
        }
    });

    ipcMain.handle('interactiveElements-get', (event) => {
        return new Promise((resolve, reject) => {
            try {
                let activeTab = tabsList.find(tab => tab.isActive);
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
            logger.error('Error adding highlight to interactive elements:', err.message);
        }
    });

    ipcMain.on('interactiveElements-removeHighlight', (event) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.send('interactiveElements-removeHighlight');
        } catch (err) {
            logger.error('Error removing highlight from interactive elements:', err.message);
        }
    });

    ipcMain.on('videoAudioElement-handle', (event, action, elementBoggleId) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.send('videoAudioElement-handle', action, elementBoggleId);
        } catch (err) {
            logger.error('Error handling video audio action:', err.message);
        }
    });

    ipcMain.on('rangeElement-setValue', (event, value, elementBoggleId) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.send('rangeElement-setValue', value, elementBoggleId);
        } catch (err) {
            logger.error('Error handling range element action:', err.message);
        }
    });

    ipcMain.on('selectElement-setValue', (event, value, parentElementBoggleId) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.send('selectElement-setValue', value, parentElementBoggleId);
        } catch (err) {
            logger.error('Error handling select element action:', err.message);
        }
    });

    ipcMain.on('elementsInDom-removeBoggleId', (event, elements) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.send('elementsInDom-removeBoggleId', elements);
        } catch (err) {
            logger.error('Error removing Boggle IDs from interactive elements:', err.message);
        }
    });

    ipcMain.handle('scrollableElements-get', (event) => {
        return new Promise((resolve, reject) => {
            try {
                let activeTab = tabsList.find(tab => tab.isActive);
                activeTab.webContentsView.webContents.send('scrollableElements-get');
                ipcMain.once('scrollableElements-response', (event, elements) => {
                    if (elements) {
                        resolve(elements);
                    } else {
                        reject(new Error('No scrollable elements found'));
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    });

    ipcMain.on('scrollableElement-scroll', (event, scrollObject) => {
        try {
            let activeTab = tabsList.find(tab => tab.isActive);
            activeTab.webContentsView.webContents.send('scrollableElement-scroll', scrollObject);
        } catch (err) {
            logger.error('Error scrolling scrollable element:', err.message);
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
            logger.error('Error adding bookmark:', err.message);
            return false;
        }
    });

    ipcMain.on('bookmarks-deleteAll', async (event) => {
        try {
            await db.deleteAllBookmarks();
            bookmarksList.length = 0;
        } catch (err) {
            logger.error('Error deleting all bookmarks:', err.message);
        }
    });

    ipcMain.on('bookmark-deleteByUrl', async (event, url) => {
        try {
            await db.deleteBookmarkByUrl(url);

            // Updating the bookmarksList by removing the bookmark with the given URL
            const idx = bookmarksList.findIndex(bookmark => bookmark.url === url);
            if (idx !== -1) bookmarksList.splice(idx, 1);

            // Reloading the bookmarks to show the updated bookmarks list
            let topMostView = viewsList[viewsList.length - 1];
            let isReload = true;
            topMostView.webContentsView.webContents.send('bookmarks-loaded', { bookmarksList }, isReload);
        } catch (err) {
            logger.error('Error deleting bookmark by URL:', err.message);
        }
    });

    ipcMain.handle('tab-add', async (event, url) => {
        const targetUrl = url || await db.getDefaultURL();
        try {
            console.log('Creating tab with URL:', targetUrl);
            await createTabView(targetUrl, true);
            return true;
        } catch (err) {
            logger.error('Error adding tab:', err.message);
            return false;
        }
    });

    ipcMain.on('tab-visit', async (event, tabId) => {
        // This is used to display the select tab when the user clicks on a tab
        try {
            let tabToVisit = tabsList.find(tab => tab.tabId === tabId);
            if (tabToVisit) {

                // If the selected tab was not yet created (because it was not the last active tab before closing), we create it.
                let createNewTab = !tabToVisit.webContentsView;
                if (createNewTab) {
                    await createTabView(tabToVisit.url, false, tabToVisit);
                    tabToVisit.webContentsView = tabsList.find(tab => tab.tabId === tabId).webContentsView;
                } else {
                    // Only if the tab is an error page, we reload the original URL to refresh the content.
                    // Otherwise, we just update the omnibox with the current URL of the tab.
                    if (tabToVisit.isErrorPage) {
                        // Reloading the URL of the tab to refresh the content and update the omnibox at the same time
                        tabToVisit.webContentsView.webContents.loadURL(tabToVisit.originalURL);

                        // Updating the omnibox with the original URL of the tab - this does not clash with the updating of the URL found
                        // in the did-stop-loading event of the webContentsView because we are reloading and hence the URL will be the same.
                        mainWindowContent.webContents.send('omniboxText-update', tabToVisit.originalURL, true);
                    } else {
                        let title = tabToVisit.webContentsView.webContents.getTitle();
                        if (!title) title = tabToVisit.webContentsView.webContents.getURL(); // Fallback to original URL if title is not available
                        mainWindowContent.webContents.send('omniboxText-update', title);
                    }
                }

                // Deactivates all tabs and activates the selected tab
                tabsList.forEach(tab => tab.isActive = false);
                tabToVisit.isActive = true;

                // When a new tab is created, it is added to the top of the main window child views immediately.
                if (!createNewTab) {
                    // Moving the selected tab to the front by removing and re-adding the tabView to the main window child views
                    mainWindow.contentView.removeChildView(tabToVisit.webContentsView);
                    mainWindow.contentView.addChildView(tabToVisit.webContentsView);

                    tabToVisit.webContentsView.webContents.send('body-animate-fadeInUp');

                    updateNavigationButtons(tabToVisit.webContentsView);
                }
            } else {
                logger.error(`Tab with ID ${tabId} not found.`);
            }
        } catch (err) {
            logger.error('Error activating tab:', err.message);
        }

    });

    // This tab deletion does not update the database because the database is updated when the app is closed ONLY.
    ipcMain.on('tabs-deleteAll', async (event) => {
        try {
            tabsList.length = 0;
        } catch (err) {
            logger.error('Error deleting all tabs:', err.message);
        }
    });

    // This tab deletion does not update the database because the database is updated when the app is closed ONLY.
    ipcMain.on('tab-deleteById', async (event, tabId) => {
        try {
            // Updating the tabsList by removing the tab with the given tabId
            const idx = tabsList.findIndex(tab => tab.tabId === tabId);
            let tabToDelete = tabsList[idx];

            if (tabToDelete) {
                if (idx !== -1) tabsList.splice(idx, 1);

                // Removing the tabView from the main window child views
                await mainWindow.contentView.removeChildView(tabToDelete.webContentsView);

                // If the tab to delete is the active tab, we need to activate the previous tab instead
                if (tabToDelete.isActive && tabsList.length > 0) {
                    newActiveTab = tabsList[tabsList.length - 1];
                    newActiveTab.isActive = true;

                    // Updating the omnibox with the URL of the previous tab if it has been created
                    if (newActiveTab.webContentsView) {
                        let title = newActiveTab.webContentsView.webContents.getTitle();
                        if (!title) title = newActiveTab.webContentsView.webContents.getURL(); // Fallback to original URL if title is not available
                        mainWindowContent.webContents.send('omniboxText-update', title, newActiveTab.isErrorPage);
                        updateNavigationButtons(newActiveTab.webContentsView);
                    } else {
                        shouldCreateTabView = true; // If the new active tab was not yet created, we will create it upon closing the MORE overlays
                    }
                }

                const topMostView = viewsList[viewsList.length - 1];
                const isReload = true;
                const serialisableTabsList = await getSerialisableTabsList(tabsList);
                topMostView.webContentsView.webContents.send('tabs-loaded', { tabsList: serialisableTabsList }, isReload);
            }
        } catch (err) {
            logger.error('Error deleting tab by ID:', err.message);
        }
    });

    ipcMain.on('mouse-click-nutjs', async (event, coordinates) => {
        try {
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
        } catch (err) {
            logger.error('Error clicking mouse with Nut.js:', err.message);
        }
    });

    ipcMain.handle('keyboard-arrow-nutjs', async (event, direction) => {
        try {
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
                return true; // Indicate success
            }
        } catch (err) {
            logger.error('Error handling keyboard arrow with Nut.js:', err.message);
            return false; // Indicate failure
        }
    });

    ipcMain.on('keyboard-type-nutjs', async (event, value, isDate, elementTypeAttribute) => {
        try {
            if (isDate) {
                // Calculate the amount of left arrow presses needed to move the cursor to the start of the date input
                let numOfLeftArrows;
                if (elementTypeAttribute === 'month' || elementTypeAttribute === 'week' || elementTypeAttribute === 'time') {
                    numOfLeftArrows = 2;
                } else if (elementTypeAttribute === 'datetime-local') {
                    numOfLeftArrows = 5;
                } else if (elementTypeAttribute === 'date') {
                    numOfLeftArrows = 3;
                }

                for (let i = 1; i <= numOfLeftArrows; i++) {
                    await keyboard.pressKey(Key.Delete);
                    await keyboard.releaseKey(Key.Delete);
                    await keyboard.pressKey(Key.Left);
                    await keyboard.releaseKey(Key.Left);
                }
            }
            else {
                // Erases everything: Ctrl+A then Backspace
                await keyboard.pressKey(Key.LeftControl, Key.A);
                await keyboard.releaseKey(Key.A, Key.LeftControl);
                await keyboard.pressKey(Key.Backspace);
                await keyboard.releaseKey(Key.Backspace);
            }

            // Types the new value, handling right arrow (→) as Key.Right
            if (value && isDate) {
                for (let char of value) {
                    if (char === '→') {
                        await keyboard.pressKey(Key.Right);
                        await keyboard.releaseKey(Key.Right);
                    } else {
                        await keyboard.type(char);
                    }
                }
            } else if (value) {
                await keyboard.type(value);
            }
        } catch (err) {
            logger.error('Error typing with Nut.js:', err.message);
        }
    });

    ipcMain.handle('keyboardOverlay-type-nutjs', async (event, value) => {
        try {
            if (value === 'backspace') {
                // Presses backspace
                await keyboard.pressKey(Key.Backspace);
                await keyboard.releaseKey(Key.Backspace);
            } else if (value === 'space') {
                // Presses space
                await keyboard.pressKey(Key.Space);
                await keyboard.releaseKey(Key.Space);
            } else {
                await keyboard.type(value);
            }

            return true; // Indicating success
        } catch (err) {
            logger.error('Error typing numeric keyboard with Nut.js:', err.message);
            return false; // Indicating failure
        }
    });

    ipcMain.on('app-exit', async (event) => {
        try {
            await deleteAndInsertAllTabs()
            app.quit();
        } catch (err) {
            logger.error('Error exiting app:', err.message);
        }
    });
}

module.exports = { registerIpcHandlers };