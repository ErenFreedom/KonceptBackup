const { db } = require("../db/sensorDB");

// Get job status of a specific sensor
const getSensorJobStatus = (req, res) => {
  const bankId = req.query.bank_id;

  if (!bankId) {
    return res.status(400).json({ message: "Missing sensor bank_id" });
  }

  const query = `
    SELECT IntervalControl.is_fetching, IntervalControl.is_sending
    FROM IntervalControl
    JOIN LocalActiveSensors ON IntervalControl.sensor_id = LocalActiveSensors.id
    WHERE LocalActiveSensors.bank_id = ?
  `;

  db.get(query, [bankId], (err, row) => {
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
  const query = `
    SELECT
      IntervalControl.sensor_id AS local_id,
      LocalActiveSensors.bank_id AS bank_id,
      IntervalControl.is_fetching,
      IntervalControl.is_sending
    FROM IntervalControl
    JOIN LocalActiveSensors ON IntervalControl.sensor_id = LocalActiveSensors.id
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch all sensor job statuses:", err.message);
      return res.status(500).json({ message: "Database error" });
    }

    const result = {};
    rows.forEach(row => {
      result[row.bank_id] = {
        is_fetching: !!row.is_fetching,
        is_sending: !!row.is_sending,
      };
    });

    return res.status(200).json(result);
  });
};

module.exports = {
  getSensorJobStatus,
  getAllSensorJobStatuses
};