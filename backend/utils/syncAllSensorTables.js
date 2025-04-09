const axios = require("axios");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { db } = require("../db/sensorDB");

/** ✅ Get latest token */
const getStoredToken = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
      if (err || !row) return reject("❌ No stored token found");
      resolve(row.token);
    });
  });
};

/** ✅ Decode token for companyId */
const getCompanyIdFromToken = async () => {
  const token = await getStoredToken();
  const decoded = jwt.verify(token, process.env.JWT_SECRET_APP);
  return { token, companyId: decoded.companyId };
};

/** ✅ Fetch cloud sensors */
const fetchCloudSensors = async (token) => {
  const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensors/list`;
  const res = await axios.get(cloudApiUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.sensors || [];
};

/** ✅ Main function to sync all tables */
const syncAllSensorTables = async () => {
  try {
    const { token, companyId } = await getCompanyIdFromToken();
    const cloudSensors = await fetchCloudSensors(token);

    if (cloudSensors.length === 0) {
      console.warn("⚠ No sensors found on cloud.");
      return;
    }

    db.serialize(() => {
      cloudSensors.forEach((sensor) => {
        const { id, name, description, object_id, property_name, data_type } = sensor;

        // ✅ 1. Ensure LocalSensorBank is up to date
        db.run(`
          INSERT OR REPLACE INTO LocalSensorBank (id, name, description, object_id, property_name, data_type, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 0)
        `, [id, name, description, object_id, property_name, data_type], (err) => {
          if (err) console.error(`❌ Error syncing SensorBank ID=${id}:`, err.message);
        });

        // ✅ 2. Ensure LocalActiveSensors exists
        db.get("SELECT 1 FROM LocalActiveSensors WHERE bank_id = ?", [id], (err, row) => {
          if (err) return console.error(`❌ ActiveSensors lookup error for ID=${id}:`, err.message);
          if (!row) {
            db.run(`
              INSERT INTO LocalActiveSensors (bank_id, mode, interval_seconds, batch_size, is_active)
              VALUES (?, 'real_time', 10, 5, 1)
            `, [id], (err) => {
              if (err) console.error(`❌ Failed to insert into LocalActiveSensors ID=${id}:`, err.message);
              else console.log(`✅ Synced LocalActiveSensors for sensor_id=${id}`);
            });
          }
        });

        // ✅ 3. Ensure LocalSensorAPIs exists
        db.get("SELECT 1 FROM LocalSensorAPIs WHERE sensor_id = ?", [id], (err, row) => {
          if (err) return console.error(`❌ SensorAPI lookup error for ID=${id}:`, err.message);
          if (!row) {
            const apiEndpoint = `N/A`; // or some rule-based URL
            db.run(`
              INSERT INTO LocalSensorAPIs (sensor_id, api_endpoint)
              VALUES (?, ?)
            `, [id, apiEndpoint], (err) => {
              if (err) console.error(`❌ Failed to insert into LocalSensorAPIs ID=${id}:`, err.message);
              else console.log(`✅ Synced LocalSensorAPIs for sensor_id=${id}`);
            });
          }
        });
      });
    });

    console.log("✅ All tables synced with Cloud.");

  } catch (err) {
    console.error("❌ syncAllSensorTables error:", err.message || err);
  }
};

module.exports = { syncAllSensorTables };