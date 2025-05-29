const { app, BaseWindow, WebContentsView, ipcMain } = require('electron')
const { ViewNames } = require('../utils/constants/enums')
const path = require('path')
const { registerIpcHandlers } = require('./ipc/ipcHandlers');

let splashWindow;
let mainWindow;
let mainWindowContent;
let tabView;
let viewsList = [];        // This contains all the instantces of WebContentsView that are created. IMP: It excludes the tabs 
let scenarioIdDict = {};   // This is a dictionary that contains the scenarioId for each view
let webpageBounds;

app.whenReady().then(() => {
    try {
        createSplashWindow()
        setTimeout(() => {
            createMainWindow();
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
                // 0 => the initial scenarioId when loading the mainWindow
                mainWindowContent.webContents.send('mainWindow-loaded', 0);

                // Hard-coding the initial scenario to prevent the scenarioIdDict from being undefined
                scenarioIdDict = { [ViewNames.MAIN_WINDOW]: [0] };
                
                ipcMain.on('mainWindow-loaded-complete', (event) => {
                    updateWebpageBounds(mainWindowContent.webContents).then(webpageBounds => {
                        try {
                            createTabView().then(() => {
                                // Register IPC handlers after the main window is created to be able to send messages to the renderer process
                                registerIpcHandlers({
                                    mainWindow,
                                    mainWindowContent,
                                    tabView,
                                    webpageBounds,
                                    viewsList,
                                    scenarioIdDict
                                });
                            });
                        } catch (err) {
                            console.error('Error processing webpage bounds:', err.message);
                        }
                    }).catch(err => {
                        console.error('Error executing JavaScript in main window:', err.message);
                    });
                })
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

async function createTabView() {
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

        updateWebpageBounds(mainWindowContent.webContents).then(webpageBounds => {
            try {
                tabView.setBounds(webpageBounds);

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
