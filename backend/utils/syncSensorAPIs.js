const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) return console.error("❌ DB Error:", err.message);
  console.log("✅ Connected to local DB");
});

// ✅ Fetch all active sensors
db.all("SELECT bank_id FROM LocalActiveSensors", [], (err, activeSensors) => {
  if (err) return console.error("❌ Failed to read LocalActiveSensors:", err.message);

  activeSensors.forEach(({ bank_id }) => {
    // Check if sensor exists in LocalSensorAPIs
    db.get(
      "SELECT * FROM LocalSensorAPIs WHERE sensor_id = ?",
      [bank_id],
      (err, row) => {
        if (err) return console.error(`❌ DB error on sensor_id=${bank_id}:`, err.message);
        if (row) return; // Already exists

        // If missing, construct an API endpoint using a rule (e.g., assume /sensor/{bank_id})
        const constructedAPI = `http://localhost:8085/api/sensor/${bank_id}`;
        const insertQuery = `
          INSERT INTO LocalSensorAPIs (sensor_id, api_endpoint, created_at)
          VALUES (?, ?, datetime('now'))
        `;

        db.run(insertQuery, [bank_id, constructedAPI], (err) => {
          if (err) console.error(`❌ Failed to insert for sensor_id=${bank_id}:`, err.message);
          else console.log(`✅ Synced API for sensor_id=${bank_id}`);
        });
      }
    );
  });
});
