const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
const db = new sqlite3.Database(dbPath);

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
