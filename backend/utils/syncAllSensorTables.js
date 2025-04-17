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

/** ✅ Fetch sensor list from Cloud */
const fetchCloudSensors = async (token) => {
  const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensors/list`;
  const res = await axios.get(cloudApiUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data?.sensors || [];
};

/** ✅ Pure sync: update sensor_id across all local tables */
const syncAllSensorTables = async () => {
  try {
    const { token } = await getCompanyIdFromToken();
    const cloudSensors = await fetchCloudSensors(token);

    if (cloudSensors.length === 0) {
      console.warn("⚠ No sensors received from Cloud.");
      return;
    }

    db.serialize(() => {
      cloudSensors.forEach(({ id: cloudId, object_id }) => {
        if (!object_id) return;

        // 1. Get local sensor id based on object_id
        db.get("SELECT id FROM LocalSensorBank WHERE object_id = ?", [object_id], (err, localRow) => {
          if (err) return console.error(`❌ Error reading LocalSensorBank for object_id=${object_id}:`, err.message);
          if (!localRow) return; // Skip if local entry doesn't exist

          const localId = localRow.id;
          if (localId === cloudId) return; // Already synced

          // 2. Update ID in LocalSensorBank
          db.run("UPDATE LocalSensorBank SET id = ? WHERE id = ?", [cloudId, localId], (err) => {
            if (err) console.error(`❌ Failed to update LocalSensorBank ID=${localId}:`, err.message);
          });

          // 3. Update bank_id in LocalActiveSensors
          db.run("UPDATE LocalActiveSensors SET bank_id = ? WHERE bank_id = ?", [cloudId, localId], (err) => {
            if (err) console.error(`❌ Failed to update LocalActiveSensors ID=${localId}:`, err.message);
          });

          // 4. Update sensor_id in LocalSensorAPIs
          db.run("UPDATE LocalSensorAPIs SET sensor_id = ? WHERE sensor_id = ?", [cloudId, localId], (err) => {
            if (err) console.error(`❌ Failed to update LocalSensorAPIs ID=${localId}:`, err.message);
          });

          console.log(`✅ Synced IDs for object_id=${object_id}: local=${localId} → cloud=${cloudId}`);
        });
      });
    });

    console.log("✅ Sensor ID sync across local tables completed.");
  } catch (err) {
    console.error("❌ syncAllSensorTables error:", err.message || err);
  }
};

module.exports = { syncAllSensorTables };