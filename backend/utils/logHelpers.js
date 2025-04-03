// utils/logHelpers.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);

/** ✅ Log Insert Helper */
const insertLog = (sensor_id, logMessage) => {
  const insertQuery = `
    INSERT INTO SensorLogs (sensor_id, log) VALUES (?, ?)
  `;

  db.run(insertQuery, [sensor_id, logMessage], (err) => {
    if (err) {
      console.error("❌ Failed to insert log:", err.message);
    } else {
      console.log(`📝 Log inserted for sensor ${sensor_id}: ${logMessage}`);
    }
  });
};

module.exports = { insertLog };
