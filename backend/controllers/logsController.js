const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);

const getSensorLogStatus = (req, res) => {
  const { sensor_id } = req.query;

  if (!sensor_id) {
    return res.status(400).json({ message: "Sensor ID is required." });
  }

  // Get interval control status first
  db.get(
    `SELECT is_fetching, is_sending FROM IntervalControl WHERE sensor_id = ?`,
    [sensor_id],
    (err, statusRow) => {
      if (err) {
        console.error("❌ Error fetching sensor log status:", err.message);
        return res.status(500).json({ message: "Database error." });
      }

      if (!statusRow) {
        return res.status(404).json({ message: "No status found for this sensor." });
      }

      // Now fetch logs for this sensor
      db.all(
        `SELECT log, timestamp FROM SensorLogs WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 50`,
        [sensor_id],
        (err2, logRows) => {
          if (err2) {
            console.error("❌ Error fetching sensor logs:", err2.message);
            return res.status(500).json({ message: "Database error while fetching logs." });
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

module.exports = { getSensorLogStatus };
