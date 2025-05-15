const axios = require("axios");
const { db, createSensorDataTable } = require("../db/sensorDB");

const CLOUD_SYNC_ENDPOINT = `${process.env.CLOUD_API_URL}/api/cloud/sync/local-db`;

/** ✅ Controller to sync local DB with cloud (with bank_id existence check) */
const syncFromCloud = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const response = await axios.get(CLOUD_SYNC_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const { sensorBank, activeSensors, sensorApis, sensorDataTables } = response.data;

    for (const sensor of sensorBank) {
      db.get(
        "SELECT id FROM LocalSensorBank WHERE id = ?",
        [sensor.id],
        async (err, row) => {
          if (err) return console.error("❌ Error checking LocalSensorBank:", err.message);

          if (!row) {
            // ✅ Insert into LocalSensorBank (new sensors only)
            db.run(
              `INSERT INTO LocalSensorBank (id, name, description, object_id, property_name, data_type, is_active, room_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                sensor.id,
                sensor.name,
                sensor.description || null,
                sensor.object_id,
                sensor.property_name,
                sensor.data_type,
                sensor.is_active,
                sensor.room_id || null,  // ✅ Include room_id from cloud (or NULL fallback)
                sensor.created_at,
                sensor.updated_at,
              ],
              (err) => {
                if (err) console.error("❌ Failed to insert into LocalSensorBank:", err.message);
              }
            );

            // ✅ Insert into LocalActiveSensors (if sensor is active)
            const active = activeSensors.find((s) => s.bank_id === sensor.id);
            if (active) {
              db.run(
                `INSERT INTO LocalActiveSensors (id, bank_id, mode, interval_seconds, batch_size, is_active, created_at, updated_at)
                 VALUES (?, ?, 'manual', 10, 1, ?, ?, ?)`,
                [
                  active.id,
                  active.bank_id,
                  active.is_active,
                  active.created_at,
                  active.updated_at,
                ],
                (err) => {
                  if (err) console.error("❌ Failed to insert into LocalActiveSensors:", err.message);
                }
              );
            }

            // ✅ Insert into LocalSensorAPIs
            const apis = sensorApis.filter((api) => api.sensor_id === sensor.id);
            for (const api of apis) {
              db.run(
                `INSERT INTO LocalSensorAPIs (id, sensor_id, api_endpoint, created_at)
                 VALUES (?, ?, ?, ?)`,
                [api.id, api.sensor_id, api.api_endpoint, api.created_at],
                (err) => {
                  if (err) console.error("❌ Failed to insert into LocalSensorAPIs:", err.message);
                }
              );
            }

            // ✅ Create SensorData_<companyId>_<sensorId> table
            const matchingTables = sensorDataTables.filter((t) => t.endsWith(`_${sensor.id}`));
            for (const tableName of matchingTables) {
              const parts = tableName.split("_");
              const companyId = parts[1];
              const sensorId = parts[2];
              await createSensorDataTable(companyId, sensorId);
            }
          } else {
            console.log(`⏩ Skipping sensor ${sensor.id} as it already exists locally.`);
          }
        }
      );
    }

    res.status(200).json({ message: "✅ Local DB synced from cloud (without duplication)." });
  } catch (err) {
    console.error("❌ Sync from cloud failed:", err.message);
    res.status(500).json({ message: "Failed to sync from cloud", error: err.message });
  }
};

module.exports = { syncFromCloud };