const { db } = require("../db/sensorDB");

/** ✅ Sub-site Log Insert Helper */
const insertSubsiteLog = (sensor_id, logMessage, companyId, subsiteId) => {
  const tableName = `SensorLogs_${companyId}_${subsiteId}`;
  const insertQuery = `INSERT INTO ${tableName} (sensor_id, log) VALUES (?, ?)`;

  db.run(insertQuery, [sensor_id, logMessage], (err) => {
    if (err) {
      console.error(`❌ Failed to insert log into ${tableName}:`, err.message);
    } else {
      console.log(`📝 Log inserted into ${tableName} for sensor ${sensor_id}: ${logMessage}`);
    }
  });
};

module.exports = { insertSubsiteLog };