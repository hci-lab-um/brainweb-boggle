const { app, BaseWindow, WebContentsView, ipcMain } = require('electron')
const { ViewNames } = require('../utils/constants/enums')
const path = require('path')
const { registerIpcHandlers } = require('./ipc/ipcHandlers');
const db = require('./modules/database');
const { captureSnapshot, slideInView } = require('../utils/utilityFunctions');

let splashWindow;
let mainWindow;
let mainWindowContent;
let tabView;
let viewsList = [];             // This contains all the instantces of WebContentsView that are created. IMP: It excludes the tabs 
let scenarioIdDict = {};        // This is a dictionary that contains the scenarioId for each view
let webpageBounds;
let defaultUrl = "https://www.google.com"
let bookmarksList = [];         // This will hold the bookmarks fetched from the database
let tabsList = [];              // This will hold the list of tabs created in the main window
let tabsFromDatabase = [];      // This will hold the tabs fetched from the database
let isMainWindowLoaded = false; // This is a flag to track if main window is fully loaded

app.whenReady().then(async () => {
    try {
        await db.connect();
        await db.createTables();
        await initialiseVariables();
    } catch (err) {
        console.error('Error initialising database:', err.message);
    }

    try {
        createSplashWindow()
        setTimeout(() => {
            createMainWindow();
        }, 4000);
    } catch (err) {
        console.error('Error during app initialisation:', err);
    }
})

app.on('window-all-closed', async () => {
    try {
        if (isMainWindowLoaded) {
            // Prevent deleting and inserting tabs if the main window is not loaded 
            await deleteAndInsertAllTabs();
        }

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
        console.error("Error initialising variables: ", err);
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
        console.error('Error creating splash window:', err.message);
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
                                    updateWebpageBounds,
                                    createTabView,
                                    deleteAndInsertAllTabs,
                                    updateNavigationButtons
                                });
                                isMainWindowLoaded = true; // Set flag to true when fully loaded
                            })
                        });
                    } catch (err) {
                        console.error('Error processing webpage bounds:', err.message);
                    }
                }).catch(err => {
                    console.error('Error executing JavaScript in main window:', err.message);
                });
            } catch (err) {
                console.error('Error sending scenarioId to render-mainwindow:', err.message);
            }
        });

        mainWindow.on('resized', () => {
            try {
                resizeMainWindow();
            } catch (err) {
                console.error('Error resizing main window:', err.message);
            }
        });

        mainWindow.on('maximize', () => {
            try {
                resizeMainWindow();
            } catch (err) {
                console.error('Error maximizing main window:', err.message);
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
                console.error('Error showing main window:', err.message);
            }
        });
    }
    catch (err) {
        console.error('Error creating main window:', err)
    }
}

async function createInitialTabs() {
    if (tabsFromDatabase.length === 0) {
        await createTabView(defaultUrl);
    } else {
        // Sorting the tabs so that the active tab is always last so that the loading icon is displayed correctly.
        const sortedTabs = [...tabsFromDatabase].sort((a, b) => (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0));
        for (const tab of sortedTabs) {
            await createTabView(tab.url, false, tab);
        }

        // The active tab is removed from the main window content view and added back to ensure it is displayed on top.
        let activeTab = tabsList.find(tab => tab.isActive === true);
        mainWindow.contentView.removeChildView(activeTab.webContentsView);
        mainWindow.contentView.addChildView(activeTab.webContentsView);
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
        } else {
            //Set new tab as active (if any)
            tabsList.forEach(tab => {
                tab.isActive = false
            });

            // Getting the maximum tabId from the tabsList and incrementing it by 1 to assign a new tabId
            const maxTabId = tabsList.reduce((maxId, tab) => Math.max(maxId, tab.tabId), 0);
            tabsList.push({ tabId: maxTabId + 1, webContentsView: thisTabView, isActive: true });
        }

        // ------------------------------------------
        // Setting the event handlers for the tabView
        // ------------------------------------------        
        thisTabView.webContents.on('did-stop-loading', () => {
            try {
                let activeTab = tabsList.find(tab => tab.isActive === true);
                // Active tab was chosen because when any tab is created, it is set as active.
                // The tabs loaded from the database will already have a snapshot.
                // If we navigate to somewhere new, this tab will be active and therefore have a snapshot.
                captureSnapshot(activeTab);

                // When loading the tabs from the database, each tab will start and stop loading,
                // but the first tab might not be the active one, and so there might not be an 
                // activeTab. We check for its presence and update the omnibox text only if it exists.
                if (activeTab && thisTabView === activeTab.webContentsView) {
                    let title = activeTab.webContentsView.webContents.getTitle();

                    // Fallback to URL if there is no title
                    if (!title || title.trim() === '') {
                        title = activeTab.webContentsView.webContents.getURL();
                    }

                    // Only run if the title has changed since last time
                    if (activeTab.lastNavigationTitle !== title) {
                        activeTab.lastNavigationTitle = title; // Update with last loaded title
                        mainWindowContent.webContents.send('omniboxText-update', title);

                        // This is the handler for when the tab finishes loading. We update the scenario for the main window according to tab navigation history.
                        let stopManager = true; // This is a flag to stop the scenario manager when the tab finishes loading before starting a new manager.
                        updateNavigationButtons(thisTabView, stopManager);
                    }
                }
            } catch (err) {
                console.error('Error during tabview stop loading:', err.message);
            }
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
                console.error('Error during window open handler:', err.message);
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
                console.warn('View already removed or invalid:', err.message);
            }
        });

        // ---------------
        // Loading the URL
        // ---------------
        if (!tabDataFromDB) {
            await thisTabView.webContents.loadURL(url);
        } else if (tabDataFromDB.isErrorPage) {
            await thisTabView.webContents.loadURL(tabDataFromDB.originalURL);
        } else {
            await thisTabView.webContents.loadURL(tabDataFromDB.url);
        }

        thisTabView.webContents.openDevTools();

    } catch (err) {
        console.error('Error creating tab view:', err.message);
    }
}

function updateNavigationButtons(thisTabView, stopManager) {
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
                console.error('Error updating webpage bounds:', err.message);
            }
        }).catch(err => {
            log.error(err);
        });
    } catch (err) {
        console.error('Error resizing main window:', err.message);
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
                url: !tab.isErrorPage ? (tab.webContentsView.webContents.getURL() ? tab.webContentsView.webContents.getURL() : tab.url) : null,
                title: tab.webContentsView.webContents.getTitle() ? tab.webContentsView.webContents.getTitle() : tab.title,
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