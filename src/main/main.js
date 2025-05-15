const { app, BaseWindow, WebContentsView, ipcMain } = require('electron')
const { ViewNames } = require('../utils/constants/enums')
const path = require('path')

let splashWindow;
let mainWindow;
let mainWindowContent;
let tabView;
let viewsList = [];             // This contains all the views that are created. IMP: it excludes the tabs 
let scenarioIdDict = {};        // This is a dictionary that contains the scenarioId for each view

app.whenReady().then(() => {
    try {
        createSplashWindow()
        setTimeout(() => {
            createMainWindow()
        }, 4000);
    } catch (err) {
        console.error('Error during app initialisation:', err)
    }
})

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
                nodeIntegration: true,  // confirm if this should be true or false
                contextIsolation: true,
                preload: path.join(__dirname, '../renderer/render-mainwindow.js')
            },
            show: false
        });

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
                mainWindowContent.webContents.send('mainWindow-loaded', 0);

                updateWebpageBounds(mainWindowContent.webContents).then(webpageBounds => {
                    try {
                        createTabView(webpageBounds);
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

async function createTabView(webpageBounds) {
    try {
        tabView = new WebContentsView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../preload/render-tabview.js')
            }
        });

        await mainWindow.contentView.addChildView(tabView);
        tabView.setBounds(webpageBounds);
        tabView.webContents.loadURL("https://www.google.com"); // default URL to be inserted in to browserConfig.js
        tabView.webContents.openDevTools();

    } catch (err) {
        console.error('Error creating tab view:', err.message);
    }
}

function resizeMainWindow() {
    try {
        if (viewsList.length > 0) {
            viewsList.forEach(view => {
                view.webContentsView.setBounds({ x: 0, y: 0, width: mainWindow.getContentBounds().width, height: mainWindow.getContentBounds().height });
            });
        }

        updateWebpageBounds(mainWindowContent.webContents)
            .then(webpageBounds => {
                try {
                    tabView.setBounds(webpageBounds);

                } catch (err) {
                    console.error('Error updating webpage bounds:', err.message);
                }
            })
            .catch(err => {
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
                let webpageBounds = {
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

ipcMain.on('overlay-create', (event, overlayName, scenarioId, buttonId = null) => {
    let mainWindowContentBounds = mainWindow.getContentBounds();

    let overlayContent = new WebContentsView({
        webPreferences: {
            nodeIntegrationInWorker: true,
            contextIsolation: true,
            preload: path.join(__dirname, `../renderer/render-${overlayName}.js`),
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

    overlayContent.webContents.loadURL(path.join(__dirname, `../pages/html/${overlayName}.html`)).then(async () => {
        try {
            overlayContent.webContents.send(`${overlayName}-loaded`, scenarioId, buttonId);
        } catch (err) {
            console.error(`Error sending scenarioId to the render-${overlayName}:`, err.message);
        }
    }).catch(err => {
        console.error(`Error loading ${overlayName} overlay:`, err.message);
    });


    //     isKeyboardOverlay = overlayAreaToShow === 'keyboard';

    //     let overlaysData = {
    //         overlayAreaToShow: overlayAreaToShow,
    //         tabList: [],
    //         bookmarks: [],
    //         canGoBack: true,
    //         canGoForward: true,
    //         isReadModeActive: isReadModeActive,
    //         useNavAreas: useNavAreas,
    //         useRobotJS: useRobotJS,
    //         dwellTime: dwellTime,
    //         quickDwellRange: quickDwellRange,
    //         settings: [],
    //         appVersion: app.getVersion(),
    //     };
    // })
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

        // This was done because the contentView does not have a function that returns the top most child view
        let topMostView = viewsList[viewsList.length - 1];
        let lastScenarioId = scenarioIdDict[topMostView.name].pop();
        topMostView.webContentsView.webContents.send('scenarioId-update', lastScenarioId);
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