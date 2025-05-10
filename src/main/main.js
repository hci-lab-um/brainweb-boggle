const { app, BaseWindow, WebContentsView, ipcMain } = require('electron')
const path = require('path')

let splashWindow;
let mainWindow;
let mainWindowContent;

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
                mainWindowContent.webContents.send('ipc-mainwindow-loaded', 0);
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

function resizeMainWindow() {
    try {
        mainWindowContent.setBounds({ x: 0, y: 0, width: mainWindow.getContentBounds().width, height: mainWindow.getContentBounds().height })
    } catch (err) {
        console.error('Error resizing main window:', err.message);
    }
}