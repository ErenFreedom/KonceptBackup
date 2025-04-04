// utils/logHelpers.js
const { db } = require("../db/sensorDB"); // or localDB, whichever contains SensorLogs table
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
