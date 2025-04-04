
const { db } = require("../db/sensorDB"); // ✅ use your shared instance
const getIntervalStatus = (req, res) => {
  db.all("SELECT * FROM IntervalControl", [], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch interval statuses:", err.message);
      return res.status(500).json({ message: "Database error while fetching interval statuses." });
    }

    const statusMap = {};
    rows.forEach(row => {
      statusMap[row.sensor_id] = {
        is_fetching: row.is_fetching === 1,
        is_sending: row.is_sending === 1
      };
    });

    res.status(200).json(statusMap);
  });
};

module.exports = { getIntervalStatus };
