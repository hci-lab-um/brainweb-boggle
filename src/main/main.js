const { app, BaseWindow, WebContentsView, ipcMain } = require('electron')
const path = require('path')

let splashWindow;
let mainWindow;
let mainWindowContent;
let tabView;

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
                console.error('Error sending scenarioId to renderer:', err.message);
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
        mainWindowContent.setBounds({ x: 0, y: 0, width: mainWindow.getContentBounds().width, height: mainWindow.getContentBounds().height })

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