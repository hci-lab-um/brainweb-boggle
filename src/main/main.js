const { app, BaseWindow, WebContentsView, ipcMain, globalShortcut, ipcRenderer } = require('electron')
const { ViewNames, SwitchShortcut } = require('../utils/constants/enums')
const path = require('path')
const fs = require('fs');
const { registerIpcHandlers } = require('./ipc/ipcHandlers');
const db = require('./modules/database');
const { captureSnapshot, slideInView, toBoolean } = require('../utils/utilityFunctions');
const { defaultState } = require('../utils/statusBar');
const logger = require('./modules/logger');
const { startEegWebSocket, connectWebSocket, disconnectWebSocket, stopEegInfrastructure, eegEvents } = require('./modules/eeg-pipeline');

let splashWindow;
let mainWindow;
let mainWindowContent;
let tabView;
let viewsList = [];                         // This contains all the instantces of WebContentsView that are created. IMP: It excludes the tabs 
let scenarioIdDict = {};                    // This is a dictionary that contains the scenarioId for each view
let webpageBounds;
let defaultUrl = "https://www.google.com"
let bookmarksList = [];                     // This will hold the bookmarks fetched from the database
let tabsList = [];                          // This will hold the list of tabs created in the main window
let tabsFromDatabase = [];                  // This will hold the tabs fetched from the database
let isMainWindowLoaded = false;             // This is a flag to track if main window is fully loaded
let lastAdaptiveToggleTs = 0;               // This is a timestamp of the last adaptive toggle event
const ADAPTIVE_TOGGLE_COOLDOWN_MS = 500;    // This is the cooldown period to prevent rapid toggling
let adaptiveSwitchInUse;                    // This flag indicates if the adaptive switch feature is enabled
let statusBarState = { ...defaultState };   // This holds the current state of the status bar
let isHeadsetConnected = false;             // This flag indicates if the EEG headset is properly connected

app.whenReady().then(async () => {
    try {
        await startEegWebSocket();
        connectWebSocket();
    } catch (err) {
        logger.error('Error starting LSL WebSocket:', err.message);
    }

    eegEvents.on('headset-connected', () => {
        isHeadsetConnected = true;
        broadcastStatusBarState({ headsetConnected: isHeadsetConnected }); // Send to main window renderer
    });

    eegEvents.on('headset-disconnected', () => {
        isHeadsetConnected = false;
        // Reset quality on disconnect
        broadcastStatusBarState({ headsetConnected: isHeadsetConnected, signalQuality: { percent: 0, color: 'grey' } }); // Send to main window renderer
    });

    // Listen for quality updates from eeg pipeline
    eegEvents.on('quality-update', ({ percent }) => {
        const color = deriveQualityColor(percent, isHeadsetConnected);
        broadcastStatusBarState({ signalQuality: { percent, color } });
    });

    try {
        await db.connect();
        await db.createTables();
        // await db.deleteHeadsetsTable();          // For development purposes only
        // await db.deleteKeyboardLayoutsTable();   // For development purposes only
        // await db.deleteSettingsTable();          // For development purposes only
        await initialiseVariables();

        adaptiveSwitchInUse = await db.getAdaptiveSwitchConnected();
        const defaultHeadset = await db.getDefaultHeadset();

        updateStatusBarState({
            headset: defaultHeadset,
            adaptiveSwitch: {
                isEnabled: toBoolean(adaptiveSwitchInUse)
            }
        });
    } catch (err) {
        logger.error('Error initialising database:', err.message);
    }

    try {
        createSplashWindow()
        setTimeout(() => {
            createMainWindow();
        }, 4000);
    } catch (err) {
        logger.error('Error during app initialisation:', err);
    }

    // This is 'Space' key by default, can be changed to any key combination from enums.js
    globalShortcut.register(SwitchShortcut.TOGGLE_BUTTON_GROUPINGS, () => {
        try {
            // Checking if adaptive switch is enabled
            if (toBoolean(adaptiveSwitchInUse)) {

                // Implementing a cooldown to prevent rapid toggling
                const now = Date.now();
                if (now - lastAdaptiveToggleTs < ADAPTIVE_TOGGLE_COOLDOWN_MS) return;
                lastAdaptiveToggleTs = now;

                // Sending the space event to the topmost overlay if present, otherwise to main window content
                const targetView = viewsList.length > 0
                    ? viewsList[viewsList.length - 1]
                    : mainWindowContent;

                const topViewName = targetView.name;
                const currentScenarioId = (scenarioIdDict[topViewName] || []).slice(-1)[0] ?? -1;

                if (targetView) {
                    targetView.webContentsView.webContents.send('adaptiveSwitch-toggle', currentScenarioId, targetView.name);
                }
            }
            else {
                console.log('ADAPTIVE SWITCH IS NOT ENABLED');
            }
        } catch (err) {
            logger.error('Error broadcasting adaptiveSwitch-toggle:', err.message);
        }
    });
})

app.on('will-quit', async () => {
   try {
        globalShortcut.unregisterAll(); // Unregister all shortcuts
        stopEegInfrastructure();        // Gracefully stop EEG infrastructure   
    } catch (err) {
        logger.error('Error during will-quit cleanup:', err.message);
    }
});

app.on('window-all-closed', async () => {
    try {
        if (isMainWindowLoaded) {
            // Prevent deleting and inserting tabs if the main window is not loaded 
            await deleteAndInsertAllTabs();
        }

        // Disconnect the LSL WebSocket
        disconnectWebSocket();
        
        await db.close();

        // App closes when all windows are closed, however this is not default behaviour on macOS (applications and their menu bar to stay active)
        if (process.platform !== 'darwin') {
            app.quit()
        }
    } catch (err) {
        logger.error('Error during app closure:', err.message);
    }
});

async function initialiseVariables() {
    try {
        bookmarksList = await db.getBookmarks();
        tabsFromDatabase = await db.getTabs();
    } catch (err) {
        logger.error("Error initialising variables: ", err);
    }
}

function updateStatusBarState(partial = {}) {
    // Merging the partial updates into the current status bar state
    if (partial && typeof partial === 'object') {
        // Handling updates to headset
        if (typeof partial.headset === 'string') {
            statusBarState.headset = partial.headset;
        }

        // Handling updates to headsetConnected
        if (typeof partial.headsetConnected === 'boolean') {
            statusBarState.headsetConnected = partial.headsetConnected;
        }

        // Handling updates to browserState
        if (typeof partial.browserState === 'string') {
            statusBarState.browserState = partial.browserState;
        }

        // Handling updates to adaptiveSwitch
        if (partial.adaptiveSwitch && typeof partial.adaptiveSwitch === 'object') {
            const incoming = partial.adaptiveSwitch;
            const current = statusBarState.adaptiveSwitch;

            statusBarState.adaptiveSwitch = {
                isEnabled: typeof incoming.isEnabled === 'boolean' ? incoming.isEnabled : current.isEnabled,
                groupIndex: typeof incoming.groupIndex === 'number' ? incoming.groupIndex : current.groupIndex,
                totalGroups: typeof incoming.totalGroups === 'number' ? incoming.totalGroups : current.totalGroups
            };
        }

        // Handling updates to signalQuality
        if (partial.signalQuality && typeof partial.signalQuality === 'object') {
            const current = statusBarState.signalQuality;
            const incoming = partial.signalQuality;
            statusBarState.signalQuality = {
                percent: typeof incoming.percent === 'number' ? incoming.percent : current.percent,
                color: typeof incoming.color === 'string' ? incoming.color : current.color
            };
        }
    }

    return { ...statusBarState };
}

function broadcastStatusBarState(partial = {}) {
    const changes = updateStatusBarState(partial);

    if (mainWindowContent?.webContents && !mainWindowContent.webContents.isDestroyed()) {
        try {
            mainWindowContent.webContents.send('statusBar-applyStateChange', changes);
        } catch (err) {
            logger.error('Error updating status bar state:', err.message);
        }
    }
}

function createSplashWindow() {
    try {
        splashWindow = new BaseWindow({
            width: 500,
            height: 503,
            transparent: true,
            frame: false,
        });
        const splashWindowContent = new WebContentsView({ webPreferences: { transparent: true } });
        splashWindow.contentView.addChildView(splashWindowContent);
        splashWindowContent.setBounds({ x: 0, y: 0, width: splashWindow.getBounds().width, height: splashWindow.getBounds().height });
        splashWindowContent.webContents.loadURL(path.join(__dirname, '../pages/html/splash.html'));
    } catch (err) {
        logger.error('Error creating splash window:', err.message);
    }
}

function createMainWindow() {
    try {
        mainWindow = new BaseWindow({
            frame: true,
            title: 'Boggle'
        })

        mainWindowContent = new WebContentsView({
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: true,
                preload: path.join(__dirname, '../renderer/render-mainwindow.js')
            },
            show: false
        });

        // Pushing the main window view into the viewsList to keep track of the topmost view. 
        viewsList.push({
            webContentsView: mainWindowContent,
            name: ViewNames.MAIN_WINDOW,
        });

        mainWindow.removeMenu()
        mainWindow.contentView.addChildView(mainWindowContent);
        mainWindow.maximize();
        mainWindowContent.setBounds({
            x: 0,
            y: 0,
            width: mainWindow.getContentBounds().width,
            height: mainWindow.getContentBounds().height
        });

        mainWindowContent.webContents.loadURL(path.join(__dirname, '../pages/html/index.html')).then(() => {
            try {
                updateWebpageBounds(mainWindowContent.webContents).then(async webpageBounds => {
                    try {
                        createInitialTabs().then(() => {
                            // 0 => the initial scenarioId when loading the mainWindow
                            mainWindowContent.webContents.send('mainWindow-loaded', 0);

                            // Hard-coding the initial scenario to prevent the scenarioIdDict from being undefined
                            scenarioIdDict = { [ViewNames.MAIN_WINDOW]: [0] };

                            ipcMain.on('mainWindow-loaded-complete', (event) => {
                                // Register IPC handlers after the main window is created to be able to send messages to the renderer process
                                registerIpcHandlers({
                                    mainWindow,
                                    mainWindowContent,
                                    webpageBounds,
                                    viewsList,
                                    scenarioIdDict,
                                    bookmarksList,
                                    tabsList,
                                    db,
                                    // Setter lets IPC handlers update the live value of the adaptiveSwitchInUse variable in main.js
                                    setAdaptiveSwitchInUse: (val) => { adaptiveSwitchInUse = val; },
                                    updateWebpageBounds,
                                    createTabView,
                                    deleteAndInsertAllTabs,
                                    updateNavigationButtons,
                                    broadcastStatusBarState
                                });
                                isMainWindowLoaded = true; // Set flag to true when fully loaded

                                // Performing an initial resize to set the correct bounds for the webpage due to status bar presence
                                setTimeout(() => {
                                    try {
                                        resizeMainWindow();
                                    } catch (resizeErr) {
                                        logger.error('Error performing initial resize:', resizeErr.message);
                                    }
                                }, 0);
                            })
                        });
                    } catch (err) {
                        logger.error('Error processing webpage bounds:', err.message);
                    }
                }).catch(err => {
                    logger.error('Error executing JavaScript in main window:', err.message);
                });
            } catch (err) {
                logger.error('Error sending scenarioId to render-mainwindow:', err.message);
            }
        });

        mainWindow.on('resized', () => {
            try {
                resizeMainWindow();
            } catch (err) {
                logger.error('Error resizing main window:', err.message);
            }
        });

        mainWindow.on('moved', () => {
            try {
                resizeMainWindow();
            } catch (err) {
                logger.error('Error moving main window:', err.message);
            }
        });

        mainWindow.on('maximize', () => {
            try {
                resizeMainWindow();
            } catch (err) {
                logger.error('Error maximizing main window:', err.message);
            }
        });

        mainWindow.once('ready-to-show', () => {
            try {
                mainWindow.show();
                if (splashWindow) {
                    splashWindow.close();
                }
                mainWindowContent.webContents.openDevTools();

            } catch (err) {
                logger.error('Error showing main window:', err.message);
            }
        });
    }
    catch (err) {
        logger.error('Error creating main window:', err)
    }
}

async function createInitialTabs() {
    if (tabsFromDatabase.length === 0) {
        await createTabView(defaultUrl);
    } else {
        // Sorting the tabs so that the active tab is always last so that the loading icon is displayed correctly.
        for (const tab of tabsFromDatabase) {
            let isTheActiveTab = tab.isActive === 1 || tab.isActive === true;

            // Here we only create the tabView for the active tab. The rest have an object created without it but are still
            // added to the tabsList so that they can be created later.
            if (isTheActiveTab) {
                await createTabView(tab.url, false, tab);
            } else {
                tabObject = {
                    tabId: tab.id,
                    webContentsView: null, // This will be set only when the tab is actually created
                    url: tab.url,
                    title: tab.title,
                    isActive: tab.isActive === 1 ? true : false,
                    snapshot: tab.snapshot,
                    isErrorPage: tab.isErrorPage,
                    originalURL: tab.originalURL
                };

                tabsList.push(tabObject);
            }
        }
    }
}

async function createTabView(url, isNewTab = false, tabDataFromDB = null) {
    try {
        let tabObject;

        // We create a local variable to be sure that we are referencing the correct tabView instance inside the destroyed event handler.
        const thisTabView = new WebContentsView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload/render-tabview.js')
            }
        });

        tabView = thisTabView

        await mainWindow.contentView.addChildView(tabView);

        // ---------------------------------
        // Setting the bounds of the tabView
        // ---------------------------------
        if (isNewTab) {
            // A slide-in animation is shown when a new tab is created. This is done by
            // setting the tab to the right of the visible area and then sliding it in.
            thisTabView.setBounds({
                x: webpageBounds.x + webpageBounds.width,
                y: webpageBounds.y,
                width: webpageBounds.width,
                height: webpageBounds.height
            });
            slideInView(thisTabView, webpageBounds);
        } else {
            if (tabDataFromDB && !tabDataFromDB.isActive) {
                thisTabView.setBounds({ x: 0, y: 0, width: 0, height: 0 }); // Hide the tabView if it is not active
            } else {
                //Set its location as per the webpage bounds
                thisTabView.setBounds(webpageBounds);
            }
        }

        // -----------------------
        // Populating the tabsList
        // -----------------------
        if (tabDataFromDB) {
            // If an object for this tab already exists (because it was loaded from the database but was not the last
            // active tab and hence we did not create a webContentsView for it), we update it with the new webContentsView.
            // Otherwise, we create a new tab object and push it to the tabsList.

            // Small note: tabDataFromDB.id is usually used to get the id, but in this case, the object is not actually
            // from the database, but rather from the tabsList array in the IPC handlers.
            if (tabsList.some(tab => tab.tabId === tabDataFromDB.tabId)) {
                // Updating the previously active tab to not active to prevent it from being active when the new tab is created.
                let previousActiveTab = tabsList.find(tab => tab.isActive === true);
                if (previousActiveTab) previousActiveTab.isActive = false;

                const existingTab = tabsList.find(tab => tab.tabId === tabDataFromDB.tabId);
                existingTab.webContentsView = thisTabView;
                existingTab.isActive = true;
                thisTabView.setBounds(webpageBounds);
            } else {
                tabObject = {
                    tabId: tabDataFromDB.id,
                    webContentsView: thisTabView,
                    url: tabDataFromDB.url,
                    title: tabDataFromDB.title,
                    isActive: tabDataFromDB.isActive === 1 ? true : false,
                    snapshot: tabDataFromDB.snapshot,
                    isErrorPage: tabDataFromDB.isErrorPage,
                    originalURL: tabDataFromDB.originalURL
                };

                tabsList.push(tabObject);
            }
        } else {
            //Set new tab as active (if any)
            tabsList.forEach(tab => {
                tab.isActive = false
            });

            // Getting the maximum tabId from the tabsList and incrementing it by 1 to assign a new tabId
            const maxTabId = tabsList.reduce((maxId, tab) => Math.max(maxId, tab.tabId), 0);
            tabsList.push({
                tabId: maxTabId + 1,
                webContentsView: thisTabView,
                isActive: true,
                isErrorPage: false,
            });
        }

        // ------------------------------------------
        // Setting the event handlers for the tabView
        // ------------------------------------------        
        thisTabView.webContents.on('did-start-loading', () => {
            try {
                broadcastStatusBarState({ browserState: 'loading' });
            } catch (err) {
                logger.error('Error updating status bar for loading state:', err.message);
            }
        });

        thisTabView.webContents.on('did-stop-loading', () => {
            try {
                let activeTab = tabsList.find(tab => tab.isActive === true);

                // When loading the tabs from the database, each tab will start and stop loading,
                // but the first tab might not be the active one, and so there might not be an 
                // activeTab. We check for its presence and update the omnibox text only if it exists.
                if (activeTab && thisTabView === activeTab.webContentsView) {
                    // Resetting the navigationEventHandled flag since this event is triggered after navigation events.
                    // This is important to ensure that the navigation buttons are updated correctly.
                    navigationEventHandled = false;

                    // Active tab was chosen because when any tab is created, it is set as active.
                    // The tabs loaded from the database will already have a snapshot.
                    // If we navigate to somewhere new, this tab will be active and therefore have a snapshot.
                    captureSnapshot(activeTab);

                    let title = activeTab.webContentsView.webContents.getTitle();

                    // Fallback to URL if there is no title
                    if (!title || title.trim() === '') {
                        title = activeTab.webContentsView.webContents.getURL();
                    }

                    // Only run if the title has changed since last time
                    if (activeTab.lastNavigationTitle !== title) {
                        activeTab.lastNavigationTitle = title; // Update with last loaded title
                        mainWindowContent.webContents.send('omniboxText-update', title, activeTab.isErrorPage);
                    }
                }

                if (activeTab?.isErrorPage) {
                    broadcastStatusBarState({ browserState: 'error' });
                } else {
                    broadcastStatusBarState({ browserState: 'ready' });
                }
            } catch (err) {
                logger.error('Error during tabview stop loading:', err.message);
            }
        });

        // Debounce logic to ensure only one navigation event handler runs
        let navigationEventHandled = false;
        function handleNavigationEvent() {
            if (navigationEventHandled) return;
            navigationEventHandled = true;
            try {
                let activeTab = tabsList.find(tab => tab.isActive === true);
                if (activeTab && thisTabView === activeTab.webContentsView) {
                    let stopManager = true;
                    updateNavigationButtons(thisTabView, stopManager);
                }
            } catch (err) {
                logger.error('Error during tabview navigation event:', err.message);
            }
        }

        thisTabView.webContents.on('did-navigate-in-page', () => {
            handleNavigationEvent()
        });

        thisTabView.webContents.on('did-navigate', () => {
            handleNavigationEvent()
        });

        // This is the handler for when a new tab is opened from the tabview such as when the user 
        // clicks on a link that opens in a new tab.
        thisTabView.webContents.setWindowOpenHandler(({ url }) => {
            // It is important to return an object with the action property, to prevent Electron from 
            // managing the popup. Instead, we handle the popup ourselves by creating a new tabview.
            try {
                createTabView(url, true);
                return { action: 'deny' };
            } catch (err) {
                logger.error('Error during window open handler:', err.message);
                return { action: 'deny' };
            }
        });

        // Certain tabs close on their own, so we need to listen for the destroyed event and 
        // remove it from the list of tabs and mainWindow contentView accordingly. Failing to 
        // do so will result in undefined behaviour and crashes.
        thisTabView.webContents.once('destroyed', () => {
            try {
                mainWindow.contentView.removeChildView(thisTabView);
                // Mutating tabsList in place instead of reassigning
                const idx = tabsList.findIndex(tab => tab.webContentsView === thisTabView);
                if (idx !== -1) tabsList.splice(idx, 1); /////// IMP: This MUTATES the tabsList in place, thus updating the variable inside IpcHandlers  ///////
            } catch (err) {
                logger.warn('View already removed or invalid:', err.message);
            }
        });

        thisTabView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
            try {
                if (isMainFrame) {
                    handleLoadError(errorCode, validatedURL);
                }
            } catch (err) {
                logger.error('Error during tabview fail load:', err.message);
            }
        });

        thisTabView.webContents.on('did-fail-provisional-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
            try {
                if (isMainFrame) {
                    handleLoadError(errorCode, validatedURL);
                }
            } catch (err) {
                logger.error('Error during tabview fail provisional load:', err.message);
            }
        });

        thisTabView.webContents.session.webRequest.onResponseStarted(async (details) => {
            try {
                const activeTab = tabsList.find(tab => tab.isActive === true);
                const responseWebContentsId = details.webContentsId;
                const activeTabWebContentsId = activeTab.webContentsView.webContents.id;

                let goingToLoadErrorPage = details.url.endsWith('error.html')

                // The following if statement filters out the devtools URLs
                if (details.resourceType === 'mainFrame' && !details.url.startsWith('devtools:')) {

                    // If the response is for the active tab
                    if (responseWebContentsId === activeTabWebContentsId) {
                        if (details.statusCode < 400 && !goingToLoadErrorPage) {
                            // Successful page load
                            successfulLoad = true;
                            activeTab.isErrorPage = false;
                            activeTab.originalURL = details.url; // Update the original URL
                            goingToLoadErrorPage = false;
                        } else {
                            // Error detected
                            successfulLoad = false;

                            // When an error occurs, the next page to be loaded is the error page itself which results in a false positive
                            // To prevent this, we set a flag to indicate that the next page to be loaded is an error page
                            if (details.statusCode < 400) {
                                goingToLoadErrorPage = false;
                            } else {
                                // Check if the response body contains a custom error page
                                await thisTabView.webContents.executeJavaScript(`document.documentElement.innerHTML.trim()`)
                                    .then(responseBody => {
                                        try {
                                            // Check if the response body contains meaningful content
                                            const isEmptyBody = responseBody === "<head></head><body></body>" || !responseBody.trim();

                                            if (!isEmptyBody) {
                                                console.log("Server's custom error page detected");
                                                handleLoadError(details.statusCode, details.url, responseBody);
                                            } else {
                                                console.log("Browser's default error page detected");
                                                handleLoadError(details.statusCode, details.url);
                                            }
                                        } catch (err) {
                                            logger.error('Error processing response body:', err.message);
                                        }
                                    }).catch(error => {
                                        logger.error("Error reading response body:", error);
                                        handleLoadError(details.statusCode, details.url);
                                    });
                            }
                        }
                    }
                }
            } catch (err) {
                logger.error('Error during response started:', err.message);
            }
        });

        // ---------------
        // Loading the URL
        // ---------------
        try {
            if (!tabDataFromDB) {
                await thisTabView.webContents.loadURL(url);
            } else if (tabDataFromDB.isErrorPage) {
                await thisTabView.webContents.loadURL(tabDataFromDB.originalURL);
            } else {
                await thisTabView.webContents.loadURL(tabDataFromDB.url);
            }
        } catch (err) {
            logger.error('Error loading URL:', err.message);
        }

        // thisTabView.webContents.openDevTools();
    } catch (err) {
        logger.error('Error creating tab view:', err.message);
    }
}

function handleLoadError(errorCode, attemptedURL, responseBody = null) {
    try {
        let activeTab = tabsList.find(tab => tab.isActive === true);
        activeTab.originalURL = attemptedURL;
        activeTab.isErrorPage = true;

        broadcastStatusBarState({ browserState: 'error' });

        if (!responseBody) {
            const errorHtmlPath = path.join(__dirname, '../pages/html/error.html');
            const errorCssPath = path.join(__dirname, '../pages/css/error.css');
            const logoPath = path.join(__dirname, '../../resources/boggle_logo.png');

            let errorHtml = '';
            let errorCss = '';
            let logoDataUrl = '';

            try {
                errorHtml = fs.readFileSync(errorHtmlPath, 'utf8');
            } catch (readErr) {
                logger.error('Failed to read error.html:', readErr.message);
                errorHtml = '<h1 id="error-title">Error</h1><p id="error-message">An unexpected error occurred.</p>';
            }

            try {
                errorCss = fs.readFileSync(errorCssPath, 'utf8');
            } catch (cssErr) {
                logger.error('Failed to read error.css:', cssErr.message);
                errorCss = '';
            }

            try {
                const logoBase64 = fs.readFileSync(logoPath, 'base64');
                logoDataUrl = `data:image/png;base64,${logoBase64}`;
            } catch (logoErr) {
                logger.error('Failed to read boggle_logo.png:', logoErr.message);
                logoDataUrl = '';
            }

            const safeHtml = errorHtml.replace(/`/g, '\\`');
            const safeCss = errorCss.replace(/`/g, '\\`');

            activeTab.webContentsView.webContents.executeJavaScript(`
                document.documentElement.innerHTML = '<style>' + ${JSON.stringify(safeCss)} + '</style>' + ${JSON.stringify(safeHtml)};

                var errorTitle = document.getElementById('error-title');
                var errorMessage = document.getElementById('error-message');
                var logoImage = document.querySelector('.error-box_logo');
                if (logoImage) {
                    logoImage.src = '${logoDataUrl}';
                }

                switch (${errorCode}) {
                    case 402:
                        errorTitle.textContent = '402 Payment Required';
                        errorMessage.textContent = 'Payment is required to access this resource.';
                        break;
                    case 403:
                        errorTitle.textContent = '403 Forbidden';
                        errorMessage.textContent = 'You do not have permission to access this resource.';
                        break;
                    case 404:
                        errorTitle.textContent = '404 Not Found';
                        errorMessage.textContent = 'The requested resource could not be found.';
                        break;
                    case 408:
                        errorTitle.textContent = '408 Request Timeout';
                        errorMessage.textContent = 'The server timed out waiting for the request.';
                        break;
                    case 425:
                        errorTitle.textContent = '425 Page Not Working';
                        errorMessage.textContent = 'If the problem continues, contact the site owner.';
                        break;
                    case 500:
                        errorTitle.textContent = '500 Internal Server Error';
                        errorMessage.textContent = 'The server encountered an internal error.';
                        break;
                    case 501:
                        errorTitle.textContent = '501 Not Implemented';
                        errorMessage.textContent = 'The server does not support the functionality required to fulfill the request.';
                        break;
                    case 502:
                        errorTitle.textContent = '502 Bad Gateway';
                        errorMessage.textContent = 'The server received an invalid response from the upstream server.';
                        break;
                    case 503:
                        errorTitle.textContent = '503 Service Unavailable';
                        errorMessage.textContent = 'The server is currently unable to handle the request due to temporary overloading or maintenance.';
                        break;
                    case 504:
                        errorTitle.textContent = '504 Gateway Timeout';
                        errorMessage.textContent = 'The server did not receive a timely response from the upstream server.';
                        break;
                    case -6:
                        errorTitle.textContent = 'File Not Found';
                        errorMessage.textContent = 'It may have been moved, edited or deleted.';
                        break;
                    case -105:
                        errorTitle.textContent = 'Address Not Found';
                        errorMessage.textContent = 'DNS Error. The website address could not be found.';
                        break;
                    case -106:
                        errorTitle.textContent = 'Network Error';
                        errorMessage.textContent = 'There was a problem connecting to the network.';
                        break;
                    default:
                        errorTitle.textContent = 'Error';
                        errorMessage.textContent = 'An unexpected error occurred.';
                        break;
                }

                var reloadButton = document.querySelector('button[aria-label="Reload the page"]');
                if (reloadButton) {
                    reloadButton.addEventListener('click', () => {
                        window.location.href = '${attemptedURL}';
                    });
                }
            `);

            updateNavigationButtons(activeTab.webContentsView, false);
        }
    } catch (err) {
        logger.error('Error handling load error:', err.message);
    }
}

function updateNavigationButtons(thisTabView, stopManager = false) {
    let activeTab = tabsList.find(tab => tab.isActive === true);

    if (activeTab && thisTabView === activeTab.webContentsView) {
        var canGoBack = activeTab.webContentsView.webContents.navigationHistory.canGoBack();
        var canGoForward = activeTab.webContentsView.webContents.navigationHistory.canGoForward();

        if (canGoBack && canGoForward) {
            mainWindowContent.webContents.send('scenarioId-update', 3, stopManager);
        } else if (canGoBack) {
            mainWindowContent.webContents.send('scenarioId-update', 1, stopManager);
        } else if (canGoForward) {
            mainWindowContent.webContents.send('scenarioId-update', 2, stopManager);
        } else if (!canGoBack && !canGoForward) {
            mainWindowContent.webContents.send('scenarioId-update', 0, stopManager);
        }
    }
}

function resizeMainWindow() {
    try {
        if (viewsList.length > 0) {
            viewsList.forEach(view => {
                view.webContentsView.setBounds({ x: 0, y: 0, width: mainWindow.getContentBounds().width, height: mainWindow.getContentBounds().height });
            });
        }

        updateWebpageBounds(mainWindowContent.webContents).then(webpageBounds => {
            try {
                // Update bounds for every tab in tabsList
                tabsList.forEach(tab => {
                    if (tab.webContentsView && typeof tab.webContentsView.setBounds === 'function') {
                        tab.webContentsView.setBounds(webpageBounds);
                    }
                });
                // Also update tabView if it exists
                if (tabView && typeof tabView.setBounds === 'function') {
                    tabView.setBounds(webpageBounds);
                }
            } catch (err) {
                logger.error('Error updating webpage bounds:', err.message);
            }
        }).catch(err => {
            log.error(err);
        });
    } catch (err) {
        logger.error('Error resizing main window:', err.message);
    }
}

function updateWebpageBounds(webContents) {
    return new Promise((resolve, reject) => {
        webContents.send('webpageBounds-get');

        ipcMain.once('webpageBounds-response', (event, bounds) => {
            if (bounds) {
                webpageBounds = {
                    x: Math.floor(bounds.x),
                    y: Math.floor(bounds.y),
                    width: Math.floor(bounds.width),
                    height: Math.floor(bounds.height)
                };
                resolve(webpageBounds);
            } else {
                reject(new Error('Failed to get webpage bounds'));
            }
        });

        // Timeout in case the renderer process doesn't respond
        setTimeout(() => {
            reject(new Error('Renderer process did not respond in time'));
        }, 5000);
    });
}

async function deleteAndInsertAllTabs() {
    try {
        // Empty the table in the database before quitting
        await db.deleteAllTabs();

        // Update the database with the open tabs
        for (const tab of tabsList) {
            const tabData = {
                url: !tab.isErrorPage ? (tab.webContentsView?.webContents.getURL() ? tab.webContentsView?.webContents.getURL() : tab.url) : null,
                title: tab.webContentsView?.webContents.getTitle() ? tab.webContentsView?.webContents.getTitle() : tab.title,
                isActive: tab.isActive,
                snapshot: tab.snapshot,
                originalURL: tab.originalURL,
                isErrorPage: tab.isErrorPage
            };

            await db.addTab(tabData);
        }
    } catch (err) {
        logger.error('Error updating database with open tabs:', err.message);
    }
}

function deriveQualityColor(percent, connected) {
    if (!connected) return 'grey';
    if (typeof percent !== 'number') return 'grey';
    if (percent < 40) return 'red';
    if (percent < 70) return 'yellow';
    return 'green';
}