const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(app.getPath('userData'), 'boggle.db');
const logger = require('./logger');

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

async function createTables() {
    return createBookmarksTable()
        .then(createTabsTable)
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

function addTab({url, title, isActive, snapshot, originalURL, isErrorPage}) {
    try {
        // Converting base64 image to buffer
        let base64Data = snapshot.replace(/^data:image\/\w+;base64,/, "");
        let binarySnapshot = Buffer.from(base64Data, "base64");

        return new Promise((resolve, reject) => {
            const insertTab = `
                INSERT INTO tabs (url, title, isActive, snapshot, originalURL, isErrorPage)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            db.run(insertTab, [url, title, isActive, binarySnapshot, originalURL, isErrorPage], function(err) {
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
        db.run(deleteTabs, function(err) {
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


module.exports = {
    connect,
    close,
    createTables,

    addBookmark,
    addTab,

    getBookmarks,
    getTabs,

    deleteBookmarkByUrl,

    deleteAllBookmarks,
    deleteAllTabs,
};