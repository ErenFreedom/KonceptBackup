const sqlite3 = require("sqlite3").verbose();
const dbPath = require("./dbPath"); // ✅ Import shared DB path

// ✅ Open or create the SQLite DB at AppData
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Error opening database:", err.message);
    } else {
        console.log("✅ Local database connected.");
    }
});

// ✅ Create AuthTokens table (if it doesn't already exist)
const createAuthTokensTable = `
    CREATE TABLE IF NOT EXISTS AuthTokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

db.run(createAuthTokensTable, (err) => {
    if (err) {
        console.error("❌ Error creating AuthTokens table:", err.message);
    } else {
        console.log("✅ AuthTokens table created (or already exists).");
    }
});

// ✅ Export the DB instance
module.exports = db;