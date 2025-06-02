function createMaterialIcon(size, icon_name) {
    return `<i class="material-icons--${size}">${icon_name}</i>`;
}

async function captureSnapshot(tabView) {
    try {
        return new Promise((resolve, reject) => {
            if (tabView && tabView.webContents) {
                tabView.webContents.capturePage().then(snapshot => {
                    tabView.snapshot = snapshot.toDataURL();
                    resolve();
                }).catch(err => {
                    console.error('Error capturing snapshot:', err.message);
                    reject(err);
                });
            } else {
                reject(new Error('Active tab or webContents not available for capture'));
            }
        });
    } catch (err) {
        console.error('Error capturing snapshot:', err.message);
    }
}

module.exports = {
    createMaterialIcon,
    captureSnapshot
};
