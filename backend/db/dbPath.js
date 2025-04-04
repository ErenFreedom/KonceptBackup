// backend/db/dbPath.js
const path = require('path');
const os = require('os');
const fs = require('fs');

const appDataDir = path.join(os.homedir(), 'AppData', 'Local', 'ConnectorBackend');
if (!fs.existsSync(appDataDir)) {
  fs.mkdirSync(appDataDir, { recursive: true });
}

const dbPath = path.join(appDataDir, 'localDB.sqlite');
console.log("📌 Using database path:", dbPath);

module.exports = dbPath;