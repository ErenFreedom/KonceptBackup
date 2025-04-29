const { db } = require("../db/sensorDB");

// Get job status of a specific sensor
const getSensorJobStatus = (req, res) => {
  const bankId = req.query.bank_id;

  if (!bankId) {
    return res.status(400).json({ message: "Missing sensor bank_id" });
  }

  db.get("SELECT is_fetching, is_sending FROM IntervalControl WHERE sensor_id = ?", [bankId], (err, row) => {
    if (err) {
      console.error("❌ DB error while fetching sensor job status:", err.message);
      return res.status(500).json({ message: "DB error" });
    }

    if (!row) {
      return res.status(404).json({ message: "Sensor not found in IntervalControl" });
    }

    return res.status(200).json({
      is_fetching: !!row.is_fetching,
      is_sending: !!row.is_sending
    });
  });
};

// Get job status of ALL active sensors
const getAllSensorJobStatuses = (req, res) => {
  db.all("SELECT sensor_id, is_fetching, is_sending FROM IntervalControl", [], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch all sensor job statuses:", err.message);
      return res.status(500).json({ message: "Database error" });
    }

    const result = {};
    rows.forEach(row => {
      result[row.sensor_id] = {
        is_fetching: !!row.is_fetching,
        is_sending: !!row.is_sending
      };
    });

    res.status(200).json(result);
  });
};

module.exports = {
  getSensorJobStatus,
  getAllSensorJobStatuses
};