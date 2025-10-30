const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
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


// ==================================
// ======== HELPER FUNCTIONS ========
// ==================================

// Helper to resolve headset IMAGE paths from enums to an absolute file path
function resolveHeadsetImagePath(imagePathFromEnum) {
    try {
        if (!imagePathFromEnum) return null;

        // Prefer the filename and look for it under the app's resources folder
        const fileName = path.basename(imagePathFromEnum);
        const appRoot = app.getAppPath();
        const resourcesCandidate = path.join(appRoot, 'resources', fileName);
        if (fs.existsSync(resourcesCandidate)) return resourcesCandidate;

        logger.warn(`Headset image not found for path: ${imagePathFromEnum}`);
        return null;
    } catch (e) {
        logger.warn(`Error resolving headset image path ${imagePathFromEnum}: ${e.message}`);
        return null;
    }
}

function bufferToDataUrl(imageBuffer) {
    try {
        if (!imageBuffer) return null;
        // Headset assets are stored as PNG resources; default to that mimetype.
        return `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (e) {
        logger.warn(`Error converting headset image buffer: ${e.message}`);
        return null;
    }
}

function safeParseJson(rawValue, fallback = []) {
    try {
        if (!rawValue) return fallback;
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
        logger.warn(`Error parsing JSON value '${rawValue}': ${e.message}`);
        return fallback;
    }
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
                company_name TEXT NOT NULL,
                headset_name TEXT NOT NULL,
                used_electrodes TEXT NOT NULL,
                image BLOB,
                PRIMARY KEY (company_name, headset_name)
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

function populateHeadsetsTable() {
    return new Promise((resolve, reject) => {
        const allRows = [];
        const values = [];

        Object.values(Headsets).forEach((headset) => {
            // Attempt to read the image as a Buffer; if missing, store NULL
            let imageBuffer = null;
            try {
                const imgPath = resolveHeadsetImagePath(headset.IMAGE);
                if (imgPath) {
                    imageBuffer = fs.readFileSync(imgPath);
                }
            } catch (e) {
                logger.warn(`Could not read headset image for ${headset.NAME}: ${e.message}`);
            }

            allRows.push('(?, ?, ?, ?)');
            values.push(
                headset.COMPANY,
                headset.NAME,
                JSON.stringify(headset.USED_ELECTRODES || []),
                imageBuffer
            );
        });

        if (allRows.length === 0) {
            resolve();
            return;
        }

        const insertSql = `INSERT OR IGNORE INTO headsets (company_name, headset_name, used_electrodes, image) VALUES ${allRows.join(', ')}`;

        db.run(insertSql, values, (err) => {
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

function createConnectionTypesTable() {
    return new Promise((resolve, reject) => {
        const createTable = `
            CREATE TABLE IF NOT EXISTS connection_types (
                name TEXT PRIMARY KEY
            );
        `;
        db.run(createTable, (err) => {
            if (err) {
                logger.error('Error creating connection_types table:', err.message);
                reject(err);
            } else {
                logger.info('connection_types table created successfully.');
                resolve();
            }
        });
    });
}

function populateConnectionTypesTable() {
    return new Promise((resolve, reject) => {
        const typesSet = new Set();
        // Collect all unique connection types from headsets (by using Set)
        Object.values(Headsets).forEach((headset) => {
            Object.values(headset.CONNECTION_TYPE || {}).forEach((t) => typesSet.add(t));
        });

        const types = Array.from(typesSet);
        if (types.length === 0) {
            resolve();
            return;
        }

        const placeholders = types.map(() => '(?)').join(', ');
        const sql = `INSERT OR IGNORE INTO connection_types (name) VALUES ${placeholders}`;
        db.run(sql, types, (err) => {
            if (err) {
                logger.error('Error populating connection_types table:', err.message);
                reject(err);
            } else {
                logger.info('connection_types table populated successfully.');
                resolve();
            }
        });
    });
}

function createHeadsetConnectionTypesTable() {
    return new Promise((resolve, reject) => {
        const createTable = `
            CREATE TABLE IF NOT EXISTS headset_connection_types (
                company_name TEXT NOT NULL,
                headset_name TEXT NOT NULL,
                connection_type TEXT NOT NULL,
                PRIMARY KEY (company_name, headset_name, connection_type),
                FOREIGN KEY (company_name, headset_name)
                    REFERENCES headsets(company_name, headset_name),
                FOREIGN KEY (connection_type)
                    REFERENCES connection_types(name)
            );
        `;
        db.run(createTable, (err) => {
            if (err) {
                logger.error('Error creating headset_connection_types table:', err.message);
                reject(err);
            } else {
                logger.info('headset_connection_types table created successfully.');
                resolve();
            }
        });
    });
}

function populateHeadsetConnectionTypesTable() {
    return new Promise((resolve, reject) => {
        const allRows = [];
        const values = [];

        Object.values(Headsets).forEach((headset) => {
            const connectionTypes = Object.values(headset.CONNECTION_TYPE || {});
            connectionTypes.forEach((connType) => {
                allRows.push('(?, ?, ?)');
                values.push(headset.COMPANY, headset.NAME, connType);
            });
        });

        if (allRows.length === 0) {
            resolve();
            return;
        }

        const sql = `INSERT OR IGNORE INTO headset_connection_types (company_name, headset_name, connection_type) VALUES ${allRows.join(', ')}`;
        db.run(sql, values, (err) => {
            if (err) {
                logger.error('Error populating headset_connection_types table:', err.message);
                reject(err);
            } else {
                logger.info('headset_connection_types table populated successfully.');
                resolve();
            }
        });
    });
}

function createSettingsTable() {
    return new Promise((resolve, reject) => {
        const createSettingsTable = `
            CREATE TABLE IF NOT EXISTS settings (
                name TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                category TEXT NOT NULL
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
        const insertSetting = `INSERT OR IGNORE INTO settings (name, value, category) VALUES (?, ?, ?)`;

        const defaultSettings = [
            {
                name: Settings.DEFAULT_URL.NAME,
                value: Settings.DEFAULT_URL.DEFAULT,
                category: Settings.DEFAULT_URL.CATEGORY,
            },
            {
                name: Settings.DEFAULT_HEADSET.NAME,
                value: Settings.DEFAULT_HEADSET.DEFAULT,
                category: Settings.DEFAULT_HEADSET.CATEGORY,
            },
            {
                name: Settings.DEFAULT_CONNECTION_TYPE.NAME,
                value: Settings.DEFAULT_CONNECTION_TYPE.DEFAULT,
                category: Settings.DEFAULT_CONNECTION_TYPE.CATEGORY,
            },
            {
                name: Settings.DEFAULT_STIMULI_PATTERN.NAME,
                value: Settings.DEFAULT_STIMULI_PATTERN.DEFAULT,
                category: Settings.DEFAULT_STIMULI_PATTERN.CATEGORY,
            },
            {
                name: Settings.DEFAULT_STIMULI_LIGHT_COLOR.NAME,
                value: Settings.DEFAULT_STIMULI_LIGHT_COLOR.DEFAULT,
                category: Settings.DEFAULT_STIMULI_LIGHT_COLOR.CATEGORY,
            },
            {
                name: Settings.DEFAULT_STIMULI_DARK_COLOR.NAME,
                value: Settings.DEFAULT_STIMULI_DARK_COLOR.DEFAULT,
                category: Settings.DEFAULT_STIMULI_DARK_COLOR.CATEGORY,
            },
        ];

        db.serialize(() => {
            defaultSettings.forEach(({ name, value, category }) => {
                db.run(insertSetting, [name, value.toString(), category], (err) => {
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
        .then(createConnectionTypesTable)
        .then(createHeadsetConnectionTypesTable)
        .then(populateHeadsetsTable)
        .then(populateConnectionTypesTable)
        .then(populateHeadsetConnectionTypesTable)
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
    // For convenience, drop the three related tables if they exist
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`DROP TABLE IF EXISTS headset_connection_types`, (err) => {
                if (err) {
                    logger.error('Error deleting headset_connection_types table:', err.message);
                    reject(err);
                    return;
                }
                db.run(`DROP TABLE IF EXISTS connection_types`, (err2) => {
                    if (err2) {
                        logger.error('Error deleting connection_types table:', err2.message);
                        reject(err2);
                        return;
                    }
                    db.run(`DROP TABLE IF EXISTS headsets`, (err3) => {
                        if (err3) {
                            logger.error('Error deleting headsets table:', err3.message);
                            reject(err3);
                        } else {
                            logger.info('ALL HEADSET related tables have been deleted');
                            resolve();
                        }
                    });
                });
            });
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

        const query = `SELECT value FROM settings WHERE name = ?`;
        db.get(query, [setting], (err, row) => {
            if (err) {
                logger.error(`Error retrieving ${setting}:`, err.message);
                reject(err);
            } else {
                resolve(row.value);
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

function getDefaultStimuliPattern() {
    return getSetting(Settings.DEFAULT_STIMULI_PATTERN.NAME);
}

function getDefaultStimuliLightColor() {
    return getSetting(Settings.DEFAULT_STIMULI_LIGHT_COLOR.NAME);
}

function getDefaultStimuliDarkColor() {
    return getSetting(Settings.DEFAULT_STIMULI_DARK_COLOR.NAME);
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

        const query = `UPDATE settings SET value = ? WHERE name = ?`;
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

function updateDefaultHeadset(newHeadset) {
    return updateSetting(Settings.DEFAULT_HEADSET.NAME, newHeadset);
}

function updateDefaultConnectionType(newConnectionType) {
    return updateSetting(Settings.DEFAULT_CONNECTION_TYPE.NAME, newConnectionType);
}

function updateDefaultStimuliPattern(newPattern) {
    return updateSetting(Settings.DEFAULT_STIMULI_PATTERN.NAME, newPattern);
}

function updateDefaultStimuliLightColor(newColor) {
    return updateSetting(Settings.DEFAULT_STIMULI_LIGHT_COLOR.NAME, newColor);
}

function updateDefaultStimuliDarkColor(newColor) {
    return updateSetting(Settings.DEFAULT_STIMULI_DARK_COLOR.NAME, newColor);
}


// =================================
// ============ QUERIES ============
// =================================

function getHeadsetConnectionTypes(headsetName, companyName) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialised'));
            return;
        }

        const query = `
            SELECT DISTINCT connection_type
            FROM headset_connection_types
            WHERE headset_name = ? AND company_name = ?
        `;
        db.all(query, [headsetName, companyName], (err, rows) => {
            if (err) {
                logger.error('Error retrieving connection types:', err.message);
                reject(err);
            } else {
                resolve(rows.map(row => row.connection_type));
            }
        });
    });
}

function getAvailableHeadsets() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialised'));
            return;
        }

        const query = `
            SELECT
                h.company_name AS companyName,
                h.headset_name AS headsetName,
                h.used_electrodes AS usedElectrodes,
                h.image AS imageBlob,
                GROUP_CONCAT(DISTINCT hct.connection_type) AS connectionTypes
            FROM headsets h
            LEFT JOIN headset_connection_types hct
                ON h.company_name = hct.company_name AND h.headset_name = hct.headset_name
            GROUP BY h.company_name, h.headset_name
            ORDER BY h.headset_name COLLATE NOCASE
        `;

        db.all(query, (err, rows) => {
            if (err) {
                logger.error('Error retrieving available headsets:', err.message);
                reject(err);
                return;
            }

            const mappedHeadsets = rows.map(row => ({
                company: row.companyName,
                name: row.headsetName,
                usedElectrodes: safeParseJson(row.usedElectrodes, []),
                connectionTypes: row.connectionTypes ? row.connectionTypes.split(',').filter(Boolean) : [],
                image: bufferToDataUrl(row.imageBlob)
            }));

            resolve(mappedHeadsets);
        });
    });
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
    getDefaultStimuliPattern,
    getDefaultStimuliLightColor,
    getDefaultStimuliDarkColor,

    deleteBookmarkByUrl,

    deleteAllBookmarks,
    deleteAllTabs,
    deleteHeadsetsTable,
    deleteSettingsTable,

    updateDefaultURL,
    updateDefaultHeadset,
    updateDefaultConnectionType,
    updateDefaultStimuliPattern,
    updateDefaultStimuliLightColor,
    updateDefaultStimuliDarkColor,

    getHeadsetConnectionTypes,
    getAvailableHeadsets,
};