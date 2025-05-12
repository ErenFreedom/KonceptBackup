const axios = require("axios");
const jwt = require("jsonwebtoken");
const https = require("https");
const { db } = require("../db/sensorDB");
const { insertLog } = require("../utils/logHelpers");
const intervalManager = require("../utils/intervalManager");

const agent = new https.Agent({ rejectUnauthorized: false });

/** ✅ Fetch Auth Token from Local DB */
const getStoredToken = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
      if (err) reject("Error fetching token");
      else if (!row) reject("No stored token");
      else resolve(row.token);
    });
  });
};

/** ✅ Decode JWT to Get Company ID */
const getCompanyIdFromToken = async () => {
  const token = await getStoredToken();
  const decoded = jwt.verify(token, process.env.JWT_SECRET_APP);
  return decoded.companyId;
};

/** ✅ Function to Fetch and Store Data */
const fetchAndStoreSensorData = async (sensor, companyId, desigoToken) => {
  try {
    const { sensor_id: bankId, api_endpoint } = sensor;

    const response = await axios.get(api_endpoint, {
      headers: { Authorization: `Bearer ${desigoToken}` },
      httpsAgent: agent
    });

    const sensorData = response.data?.[0]?.Value;
    if (!sensorData) {
      insertLog(bankId, "⚠️ No data returned from Desigo endpoint.");
      return;
    }

    const { Value, Quality, QualityGood, Timestamp } = sensorData;
    const tableName = `SensorData_${companyId}_${bankId}`;

    db.get(`SELECT id FROM LocalActiveSensors WHERE bank_id = ?`, [bankId], (err, row) => {
      if (err || !row) {
        console.error(`❌ No matching LocalActiveSensor row found for bank_id=${bankId}`);
        insertLog(bankId, `❌ No matching sensor_id in LocalActiveSensors for bank_id=${bankId}`);
        return;
      }

      const activeSensorId = row.id;

      const insertQuery = `
        INSERT INTO ${tableName} (sensor_id, value, quality, quality_good, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.run(insertQuery, [activeSensorId, Value, Quality, QualityGood, Timestamp], (err) => {
        if (err) {
          console.error(`❌ DB Insert Error in ${tableName}:`, err.message);
          insertLog(bankId, `❌ Failed to insert data into ${tableName}: ${err.message}`);
        } else {
          insertLog(bankId, `✅ Data saved successfully to ${tableName}`);
        }
      });
    });
  } catch (err) {
    console.error(`❌ Error fetching from Desigo CC for sensor ${sensor.sensor_id}:`, err.message);
    insertLog(sensor.sensor_id, `❌ Fetch failed: ${err.message}`);
  }
};

/** ✅ Main Controller to Start Fetching */
const processSensorByAPI = async (req, res) => {
  try {
    const { api_endpoint, sensor_id } = req.query;
    const desigoToken = req.headers["x-desigo-token"];

    if (!api_endpoint || !sensor_id || !desigoToken) {
      return res.status(400).json({ message: "API endpoint, sensor ID, and Desigo token are required." });
    }

    console.log(`🔍 API: ${api_endpoint} | Sensor ID: ${sensor_id}`);
    const companyId = await getCompanyIdFromToken();

    db.get(`SELECT api_endpoint FROM LocalSensorAPIs WHERE api_endpoint = ?`, [api_endpoint], (err, row) => {
      if (err || !row) {
        insertLog(sensor_id, "❌ Sensor API not found in LocalSensorAPIs.");
        return res.status(404).json({ message: "Sensor API not found in LocalSensorAPIs." });
      }

      db.get(
        `SELECT bank_id, interval_seconds, is_active FROM LocalActiveSensors WHERE bank_id = ? AND is_active = 1`,
        [sensor_id],
        (err, sensor) => {
          if (err || !sensor) {
            insertLog(sensor_id, "❌ Sensor is not active or not found.");
            return res.status(404).json({ message: "Sensor not active or not found in LocalActiveSensors." });
          }

          const { bank_id, interval_seconds } = sensor;

          db.get(`SELECT id FROM LocalActiveSensors WHERE bank_id = ?`, [bank_id], (err, row) => {
            if (err || !row) {
              console.error("❌ Mapping bank_id to id failed:", err?.message);
              insertLog(bank_id, `❌ Failed to map bank_id to local id.`);
              return res.status(500).json({ message: "Internal mapping error." });
            }

            const localId = row.id;

            db.run(
              `
              INSERT INTO IntervalControl (sensor_id, is_fetching)
              VALUES (?, 1)
              ON CONFLICT(sensor_id) DO UPDATE SET is_fetching = 1;
            `,
              [localId],
              (err) => {
                if (err) {
                  console.error("❌ Failed to update IntervalControl:", err.message);
                  insertLog(bank_id, `❌ Failed to update fetch control: ${err.message}`);
                  return res.status(500).json({ message: "Failed to update fetch status." });
                }

                // ✅ Safe persistent interval with try-catch wrapper
                intervalManager.startFetch(bank_id, async () => {
                  try {
                    db.get(
                      `SELECT is_fetching FROM IntervalControl WHERE sensor_id = ?`,
                      [localId],
                      (err, row) => {
                        if (err || !row || row.is_fetching !== 1) return;

                        fetchAndStoreSensorData(
                          { sensor_id: bank_id, api_endpoint, interval_seconds },
                          companyId,
                          desigoToken
                        );
                      }
                    );
                  } catch (err) {
                    console.error(`❌ Interval crash (fetch) for sensor ${bank_id}:`, err.message);
                    insertLog(bank_id, `❌ Interval crash (fetch): ${err.message}`);
                  }
                }, interval_seconds * 1000);

                insertLog(bank_id, `🚀 Started persistent fetch every ${interval_seconds}s`);
                return res.status(200).json({
                  message: "Fetching started for sensor",
                  sensor_id: bank_id,
                  companyId,
                  interval_seconds
                });
              }
            );
          });
        }
      );
    });
  } catch (error) {
    console.error("❌ Error in processSensorByAPI:", error.message);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = {
  processSensorByAPI,
  fetchAndStoreSensorData
};