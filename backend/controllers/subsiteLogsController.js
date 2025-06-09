const { db } = require("../db/sensorDB");
const jwt = require("jsonwebtoken");
require("dotenv").config();

/** ✅ Get companyId from token */
const getCompanyIdFromToken = (req) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET_APP);
    return decoded.companyId;
  } catch (err) {
    console.error("❌ Invalid token:", err.message);
    return null;
  }
};

/** ✅ Sub-site Sensor Log + Status Controller */
const getSubsiteSensorLogStatus = (req, res) => {
  const { sensor_id, subsite_id } = req.query;

  if (!sensor_id || !subsite_id) {
    return res.status(400).json({ message: "sensor_id and subsite_id are required." });
  }

  const companyId = getCompanyIdFromToken(req);
  if (!companyId) {
    return res.status(401).json({ message: "Invalid or missing token." });
  }

  const controlTable = `IntervalControl_${companyId}_${subsite_id}`;
  const logTable = `SensorLogs_${companyId}_${subsite_id}`;

  db.get(
    `SELECT is_fetching, is_sending FROM ${controlTable} WHERE sensor_id = ?`,
    [sensor_id],
    (err, statusRow) => {
      if (err) {
        console.error(`❌ Error fetching interval status from ${controlTable}:`, err.message);
        return res.status(500).json({ message: "Database error." });
      }

      if (!statusRow) {
        return res.status(404).json({ message: "No interval status found for this sensor." });
      }

      db.all(
        `SELECT log, timestamp FROM ${logTable} WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 50`,
        [sensor_id],
        (err2, logRows) => {
          if (err2) {
            console.error(`❌ Error fetching logs from ${logTable}:`, err2.message);
            return res.status(500).json({ message: "Error fetching logs." });
          }

          return res.status(200).json({
            sensor_id,
            is_fetching: statusRow.is_fetching === 1,
            is_sending: statusRow.is_sending === 1,
            logs: logRows.map(entry => `[${entry.timestamp}] ${entry.log}`)
          });
        }
      );
    }
  );
};

module.exports = { getSubsiteSensorLogStatus };