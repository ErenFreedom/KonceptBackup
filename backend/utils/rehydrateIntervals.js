// helpers/rehydrateIntervals.js
const { db } = require("../db/sensorDB");
const jwt = require("jsonwebtoken");
const { fetchAndStoreSensorData } = require("../controllers/fetchSensorDataController");
const { sendDataToCloud } = require("../controllers/sendSensorDataController");

async function getStoredToken() {
  return new Promise((resolve, reject) => {
    db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
      if (err || !row) reject("Token not found");
      else resolve(row.token);
    });
  });
}

async function rehydrateIntervals() {
  try {
    const token = await getStoredToken();
    const decoded = jwt.verify(token, process.env.JWT_SECRET_APP);
    const companyId = decoded.companyId;

    // ✅ Restart fetching jobs
    db.all(`
      SELECT A.bank_id, A.interval_seconds, L.api_endpoint
      FROM IntervalControl IC
      JOIN LocalActiveSensors A ON A.id = IC.sensor_id
      JOIN LocalSensorAPIs L ON L.sensor_id = A.bank_id
      WHERE IC.is_fetching = 1
    `, [], (err, rows) => {
      if (err) return console.error("❌ Fetch rehydrate error:", err.message);

      rows.forEach(sensor => {
        fetchAndStoreSensorData({
          sensor_id: sensor.bank_id,
          api_endpoint: sensor.api_endpoint,
          interval_seconds: sensor.interval_seconds
        }, companyId, "AUTO-RECOVER-TOKEN");
        console.log(`♻️ Fetch job resumed for sensor ${sensor.bank_id}`);
      });
    });

    // ✅ Restart sending jobs
    db.all(`
      SELECT A.bank_id
      FROM IntervalControl IC
      JOIN LocalActiveSensors A ON A.id = IC.sensor_id
      WHERE IC.is_sending = 1
    `, [], (err, rows) => {
      if (err) return console.error("❌ Send rehydrate error:", err.message);

      rows.forEach(row => {
        sendDataToCloud(row.bank_id);
        console.log(`♻️ Send job resumed for sensor ${row.bank_id}`);
      });
    });

  } catch (err) {
    console.error("❌ Failed to rehydrate jobs:", err.message);
  }
}

module.exports = { rehydrateIntervals };