const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(app.getPath('userData'), 'boggle.db');
const logger = require('./logger');
const { Headsets, Settings } = require('../../utils/constants/enums');
let db;

function connect() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                logger.error(`Error connecting to the database: ${err.message}, dbPath: ${dbPath}`);
                reject(err);
            } else {
                logger.info('Connected to the SQLite database.');
                resolve(db);
            }
        });
    });
}

function close() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) {
                    logger.error('Error closing the database:', err.message);
                    reject(err);
                } else {
                    logger.info('Database connection closed.');
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

// =================================
// ======== CREATING TABLES ========
// =================================

function createBookmarksTable() {
    return new Promise((resolve, reject) => {
        const createBookmarksTable = `
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                snapshot BLOB NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        db.run(createBookmarksTable, (err) => {
            if (err) {
                logger.error('Error creating bookmarks table:', err.message);
                reject(err);
            } else {
                logger.info('Bookmarks table created successfully.');
                resolve();
            }
        });
    });
}

function createTabsTable() {
    return new Promise((resolve, reject) => {
        const createTabsTable = `
            CREATE TABLE IF NOT EXISTS tabs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT,
                title TEXT NOT NULL,
                isActive BOOLEAN NOT NULL,
                snapshot BLOB NOT NULL,
                originalURL TEXT,
                isErrorPage BOOLEAN,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        db.run(createTabsTable, (err) => {
            if (err) {
                logger.error('Error creating tabs table:', err.message);
                reject(err);
            } else {
                logger.info('Tabs table created successfully.');
                resolve();
            }
        });
    });
}

function createHeadsetTable() {
    return new Promise((resolve, reject) => {
        const createHeadsetTable = `
            CREATE TABLE IF NOT EXISTS headsets (
                headset_name TEXT NOT NULL,
                company_name TEXT NOT NULL,
                connection_type TEXT NOT NULL,
                UNIQUE(headset_name, company_name, connection_type)
            );
        `;
        db.run(createHeadsetTable, (err) => {
            if (err) {
                logger.error('Error creating headsets table:', err.message);
                reject(err);
            } else {
                logger.info('Headsets table created successfully.');
                resolve();
            }
        });
    });
}

function populateHeadsetTable() {
    return new Promise((resolve, reject) => {
        // Build one row per connection type from the Headsets enum
        const allRows = [];
        const values = [];

        Object.values(Headsets).forEach((headset) => {
            const connectionTypes = Object.values(headset.CONNECTION_TYPE || {});
            connectionTypes.forEach((connType) => {
                allRows.push('(?, ?, ?)');
                values.push(
                    headset.NAME,
                    headset.COMPANY,
                    connType
                );
            });
        });

        if (allRows.length === 0) {
            resolve();
            return;
        }

        const insertHeadsets = `INSERT OR IGNORE INTO headsets (headset_name, company_name, connection_type) VALUES ${allRows.join(', ')}`;

        db.run(insertHeadsets, values, (err) => {
            if (err) {
                logger.error('Error populating headsets table:', err.message);
                reject(err);
            } else {
                logger.info('Headsets table populated successfully.');
                resolve();
            }
        });
    });
}

function createSettingsTable() {
    return new Promise((resolve, reject) => {
        const createSettingsTable = `
            CREATE TABLE IF NOT EXISTS settings (
                setting_name TEXT PRIMARY KEY,
                setting_value TEXT NOT NULL 
            );
        `;
        db.run(createSettingsTable, (err) => {
            if (err) {
                logger.error('Error creating settings table:', err.message);
                reject(err);
            }
            else {
                logger.info('Settings table created successfully.');
                resolve();
            }
        });
    });
}

function populateSettingsTable() {
    return new Promise((resolve, reject) => {
        const insertSetting = `INSERT OR IGNORE INTO settings (setting_name, setting_value) VALUES (?, ?)`;

        const defaultSettings = {
            [Settings.DEFAULT_URL.NAME]: Settings.DEFAULT_URL.DEFAULT,
            [Settings.DEFAULT_HEADSET.NAME]: Settings.DEFAULT_HEADSET.DEFAULT,
            [Settings.DEFAULT_CONNECTION_TYPE.NAME]: Settings.DEFAULT_CONNECTION_TYPE.DEFAULT,
        };

        db.serialize(() => {
            Object.entries(defaultSettings).forEach(([name, value]) => {
                db.run(insertSetting, [name, value.toString()], (err) => {
                    if (err) {
                        logger.error('Error populating settings table:', err.message);
                        reject(err);
                    }
                });
            });
            logger.info('Settings table populated with default values.');
            resolve();
        });
    });
}

async function createTables() {
    return createBookmarksTable()
        .then(createTabsTable)
        .then(createHeadsetTable)
        .then(populateHeadsetTable)
        .then(createSettingsTable)
        .then(populateSettingsTable)
        .catch((err) => {
            logger.error('Error creating tables:', err.message);
            throw err;
        });
}

// =================================
// ============ ADDING =============
// =================================

function addBookmark({ url, title, snapshot }) {
    try {
        // Converting base64 image to buffer
        let base64Data = snapshot.replace(/^data:image\/\w+;base64,/, "");
        let binarySnapshot = Buffer.from(base64Data, "base64");

        return new Promise((resolve, reject) => {
            const insertBookmark = `
                INSERT INTO bookmarks (url, title, snapshot)
                VALUES (?, ?, ?)
            `;
            db.run(insertBookmark, [url, title, binarySnapshot], function (err) {
                if (err) {
                    logger.error('Error inserting bookmark:', err.message);
                    reject(err);
                } else {
                    logger.info(`A bookmark has been inserted with rowid ${this.lastID}`);
                    resolve(this.lastID);
                }
            });
        });
    } catch (err) {
        logger.error('Error adding bookmark:', err.message);
    }
}

function addTab({ url, title, isActive, snapshot, originalURL, isErrorPage }) {
    try {
        // Converting base64 image to buffer
        let base64Data = snapshot.replace(/^data:image\/\w+;base64,/, "");
        let binarySnapshot = Buffer.from(base64Data, "base64");

        return new Promise((resolve, reject) => {
            const insertTab = `
                INSERT INTO tabs (url, title, isActive, snapshot, originalURL, isErrorPage)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            db.run(insertTab, [url, title, isActive, binarySnapshot, originalURL, isErrorPage], function (err) {
                if (err) {
                    logger.error('Error inserting tab:', err.message);
                    reject(err);
                } else {
                    logger.info(`A tab has been inserted with rowid ${this.lastID}`);
                    resolve(this.lastID);
                }
            });
        });
    } catch (err) {
        logger.error('Error adding tab:', err.message);
    }
}

// =================================
// =========== REMOVING ============
// =================================

function deleteBookmarkByUrl(url) {
    return new Promise((resolve, reject) => {
        const deleteBookmark = `DELETE FROM bookmarks WHERE url = ?`;
        db.run(deleteBookmark, [url], function (err) {
            if (err) {
                logger.error('Error deleting bookmark:', err.message);
                reject(err);
            } else {
                logger.info(`Bookmark with URL: ${url} has been deleted`);
                resolve();
            }
        });
    });
}

// =================================
// ========== REMOVE ALL ===========
// =================================

function deleteAllBookmarks() {
    return new Promise((resolve, reject) => {
        const deleteAll = `DELETE FROM bookmarks`;
        db.run(deleteAll, function (err) {
            if (err) {
                logger.error('Error deleting all bookmarks:', err.message);
                reject(err);
            } else {
                logger.info('All bookmarks have been deleted');
                resolve();
            }
        });
    });
}

function deleteAllTabs() {
    return new Promise((resolve, reject) => {
        const deleteTabs = `DELETE FROM tabs`;
        db.run(deleteTabs, function (err) {
            if (err) {
                logger.error('Error deleting all tabs:', err.message);
                reject(err);
            } else {
                logger.info('All tabs have been deleted');
                resolve();
            }
        });
    });
}

function deleteHeadsetsTable() {
    return new Promise((resolve, reject) => {
        const deleteTable = `DROP TABLE IF EXISTS headsets`;
        db.run(deleteTable, function (err) {
            if (err) {
                logger.error('Error deleting headsets table:', err.message);
                reject(err);
            } else {
                logger.info('Headsets table has been deleted');
                resolve();
            }
        });
    });
}

function deleteSettingsTable() {
    return new Promise((resolve, reject) => {
        const deleteTable = `DROP TABLE IF EXISTS settings`;
        db.run(deleteTable, function (err) {
            if (err) {
                logger.error('Error deleting settings table:', err.message);
                reject(err);
            } else {
                logger.info('Settings table has been deleted');
                resolve();
            }
        });
    });
}

// =================================
// ============ GETTERS ============
// =================================

function getBookmarks() {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM bookmarks`;
        db.all(query, (err, rows) => {
            if (err) {
                logger.error('Error retrieving bookmarks:', err.message);
                reject(err);
            } else {
                // Convert each snapshot (BLOB) to a Base64 string
                rows.forEach(row => {
                    if (row.snapshot) {
                        row.snapshot = `data:image/png;base64,${row.snapshot.toString("base64")}`;
                    }
                });

                resolve(rows);
            }
        });
    }).catch(err => {
        logger.error('Error getting bookmarks:', err.message);
    });
}

function getTabs() {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM tabs`;
        db.all(query, (err, rows) => {
            if (err) {
                logger.error('Error retrieving tabs:', err.message);
                reject(err);
            } else {
                // Convert each snapshot (BLOB) to a Base64 string if snapshot is present
                rows.forEach(row => {
                    if (row.snapshot) {
                        row.snapshot = `data:image/png;base64,${row.snapshot.toString("base64")}`;
                    }
                });

                resolve(rows);
            }
        });
    }).catch(err => {
        logger.error('Error getting tabs:', err.message);
    });
}

function getSetting(setting) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialised'));
            return;
        }

        const query = `SELECT setting_value FROM settings WHERE setting_name = ?`;
        db.get(query, [setting], (err, row) => {
            if (err) {
                logger.error(`Error retrieving ${setting}:`, err.message);
                reject(err);
            } else {
                resolve(row.setting_value);
            }
        });
    }).catch(err => {
        logger.error(`Error getting ${setting}:`, err.message);
    });
}

// These get the values in the database and not the defaults from enums.js
function getDefaultURL() {
    return getSetting(Settings.DEFAULT_URL.NAME);
}

function getDefaultHeadset() {
    return getSetting(Settings.DEFAULT_HEADSET.NAME);
}

function getDefaultConnectionType() {
    return getSetting(Settings.DEFAULT_CONNECTION_TYPE.NAME);
}

// =================================
// ============ SETTERS ============
// =================================

function updateSetting(setting, value) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialised'));
            return;
        }

        const query = `UPDATE settings SET setting_value = ? WHERE setting_name = ?`;
        db.run(query, [value, setting], function (err) {
            if (err) {
                logger.error(`Error updating ${setting}:`, err.message);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function updateDefaultURL(newUrl) {
    return updateSetting(Settings.DEFAULT_URL.NAME, newUrl);
}

module.exports = {
    connect,
    close,
    createTables,

    addBookmark,
    addTab,

    getBookmarks,
    getTabs,
    getDefaultURL,
    getDefaultHeadset,
    getDefaultConnectionType,

    deleteBookmarkByUrl,

    deleteAllBookmarks,
    deleteAllTabs,
    deleteHeadsetsTable,
    deleteSettingsTable,

    updateDefaultURL
};