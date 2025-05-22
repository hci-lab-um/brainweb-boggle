const { app, BaseWindow, WebContentsView, ipcMain } = require('electron')
const { ViewNames } = require('../utils/constants/enums')
const path = require('path')
const { registerIpcHandlers } = require('./ipc/ipcHandlers');
const { QuadtreeBuilder, InteractiveElement, HTMLSerializableElement, QtPageDocument, QtBuilderOptions, QtRange } = require('cactus-quadtree-builder');

let splashWindow;
let mainWindow;
let mainWindowContent;
let tabView;
let viewsList = [];        // This contains all the views that are created. IMP: It excludes the tabs 
let scenarioIdDict = {};   // This is a dictionary that contains the scenarioId for each view
let qtBuilder;
let webpageBounds;

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
                        createTabView();
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

        // Register IPC handlers after the main window is created to be able to send messages to the renderer process
        registerIpcHandlers({
            mainWindow,
            mainWindowContent,
            tabView,
            viewsList,
            scenarioIdDict
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

async function splitSelectScreen() {
    let qtOptions = new QtBuilderOptions(webpageBounds.width, webpageBounds.height, 'new', 36);
    qtBuilder = new QuadtreeBuilder(qtOptions);

    const currentUrl = tabView.webContents.getURL();
    const noOfElementsInTabView = await qtBuilder.getInteractiveElementsAsync(currentUrl).length

    if (noOfElementsInTabView <= 36) {
        // Ma jinqasamx just label the elements
    }
    else {
        let splitIntoSix = false;

        // Split the tabView screen into 4 quadrants
        const quadrants = getScreenRegions(4, webpageBounds)

        // You can now use these quadrant bounds for further processing, e.g., highlighting or labeling
        // Use a regular for loop instead of forEach to allow breaking out of the loop
        for (let idx = 0; idx < quadrants.length; idx++) {
            const quad = quadrants[idx];
            qtOptions = new QtBuilderOptions(quad.width, quad.height, 'new', 36);
            qtBuilder = new QuadtreeBuilder(qtOptions);

            const noOfElementsInQuadrant = await qtBuilder.getInteractiveElementsAsync(currentUrl).length;
            if (noOfElementsInQuadrant > 36) {
                splitIntoSix = true;
                break; // Exit the loop early
            }
        }

        if (splitIntoSix) {
            let splitRegionIntoFour = false;
            const sixRegions = getScreenRegions(6, webpageBounds)

            // WAIT for user to select Region and then CHECK if that region has got more than 36 elements
            // If so split the Region into 4
        }
        else {
            // split into 4 - use quadrants
        }
    }

}

function getScreenRegions(numRegions, bounds) {
    // Find the grid size (rows x cols) as close to square as possible
    let rows = Math.floor(Math.sqrt(numRegions));
    let cols = Math.ceil(numRegions / rows);

    // Adjust if not enough regions
    while (rows * cols < numRegions) {
        rows++;
    }

    const regionWidth = Math.floor(bounds.width / cols);
    const regionHeight = Math.floor(bounds.height / rows);
    const regions = [];

    let count = 0;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (count >= numRegions) break;
            regions.push({
                x: col * regionWidth,
                y: row * regionHeight,
                width: regionWidth,
                height: regionHeight
            });
            count++;
        }
    }
    return regions;
}

ipcMain.on('webpage-split', async (event) => {
    await splitSelectScreen()
});
