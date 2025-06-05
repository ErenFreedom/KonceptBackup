const axios = require("axios");
const jwt = require("jsonwebtoken");
const https = require("https");
const { db } = require("../db/sensorDB");
const { insertLog } = require("../utils/logHelpersSubSite");
const intervalManager = require("../utils/intervalManagerSubSite");

const agent = new https.Agent({ rejectUnauthorized: false });

/** ✅ Fetch Auth Token from Local DB */
const getStoredToken = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
      if (err || !row) reject("No stored token found.");
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

/** ✅ Function to Fetch and Store Sub-site Data */
const fetchAndStoreSubSiteSensorData = async (sensor, companyId, subsiteId, desigoToken) => {
  try {
    const { sensor_id: bankId, api_endpoint } = sensor;

    const response = await axios.get(api_endpoint, {
      headers: { Authorization: `Bearer ${desigoToken}` },
      httpsAgent: agent,
    });

    const sensorData = response.data?.[0]?.Value;
    if (!sensorData) {
      insertLog(bankId, `⚠️ No data returned from Desigo endpoint (sub-site ${subsiteId})`);
      return;
    }

    const { Value, Quality, QualityGood, Timestamp } = sensorData;
    const tableName = `SensorData_${companyId}_${subsiteId}_${bankId}`;

    const activeTable = `Sensor_${companyId}_${subsiteId}`;
    db.get(`SELECT id FROM ${activeTable} WHERE bank_id = ?`, [bankId], (err, row) => {
      if (err || !row) {
        console.error(`❌ No active sensor found for bank_id=${bankId} in sub-site ${subsiteId}`);
        insertLog(bankId, `❌ No matching sensor_id in ${activeTable}`);
        return;
      }

      const localId = row.id;

      db.run(
        `INSERT INTO ${tableName} (sensor_id, value, quality, quality_good, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [localId, Value, Quality, QualityGood, Timestamp],
        (err) => {
          if (err) {
            console.error(`❌ Insert error into ${tableName}:`, err.message);
            insertLog(bankId, `❌ Insert error: ${err.message}`);
          } else {
            insertLog(bankId, `✅ Data inserted into ${tableName}`);
          }
        }
      );
    });
  } catch (err) {
    console.error(`❌ Fetch error for sub-site ${subsiteId} sensor ${sensor.sensor_id}:`, err.message);
    insertLog(sensor.sensor_id, `❌ Fetch error: ${err.message}`);
  }
};

/** ✅ Main Controller for Sub-site Sensor Fetching */
const processSubSiteSensorByAPI = async (req, res) => {
  try {
    const { api_endpoint, sensor_id, subsite_id } = req.query;
    const desigoToken = req.headers["x-desigo-token"];

    if (!api_endpoint || !sensor_id || !subsite_id || !desigoToken) {
      return res.status(400).json({ message: "api_endpoint, sensor_id, subsite_id and token required" });
    }

    const companyId = await getCompanyIdFromToken();

    const apiTable = `SensorAPI_${companyId}_${subsite_id}`;
    const sensorTable = `Sensor_${companyId}_${subsite_id}`;
    const controlTable = `IntervalControl_${companyId}_${subsite_id}`;

    db.get(`SELECT api_endpoint FROM ${apiTable} WHERE api_endpoint = ?`, [api_endpoint], (err, row) => {
      if (err || !row) {
        insertLog(sensor_id, `❌ API not found in ${apiTable}`);
        return res.status(404).json({ message: "API not registered in local DB" });
      }

      db.get(
        `SELECT bank_id, interval_seconds FROM ${sensorTable} WHERE bank_id = ? AND is_active = 1`,
        [sensor_id],
        (err, sensor) => {
          if (err || !sensor) {
            insertLog(sensor_id, `❌ Sensor not active in ${sensorTable}`);
            return res.status(404).json({ message: "Sensor not active or not found" });
          }

          const { bank_id, interval_seconds } = sensor;

          db.get(`SELECT id FROM ${sensorTable} WHERE bank_id = ?`, [bank_id], (err, row) => {
            if (err || !row) {
              insertLog(bank_id, `❌ Failed to map bank_id to id in ${sensorTable}`);
              return res.status(500).json({ message: "Internal ID mapping error" });
            }

            const localId = row.id;

            db.run(
              `INSERT INTO ${controlTable} (sensor_id, is_fetching)
               VALUES (?, 1)
               ON CONFLICT(sensor_id) DO UPDATE SET is_fetching = 1`,
              [localId],
              (err) => {
                if (err) {
                  insertLog(bank_id, `❌ IntervalControl insert failed in ${controlTable}: ${err.message}`);
                  return res.status(500).json({ message: "Failed to update fetch control" });
                }

                intervalManager.startFetch(bank_id, async () => {
                  try {
                    db.get(
                      `SELECT is_fetching FROM ${controlTable} WHERE sensor_id = ?`,
                      [localId],
                      (err, row) => {
                        if (err || !row || row.is_fetching !== 1) return;

                        fetchAndStoreSubSiteSensorData(
                          { sensor_id: bank_id, api_endpoint, interval_seconds },
                          companyId,
                          subsite_id,
                          desigoToken
                        );
                      }
                    );
                  } catch (err) {
                    insertLog(bank_id, `❌ Interval crash: ${err.message}`);
                  }
                }, interval_seconds * 1000);

                insertLog(bank_id, `🚀 Started sub-site fetch every ${interval_seconds}s`);
                return res.status(200).json({
                  message: "Sub-site fetch started",
                  sensor_id: bank_id,
                  companyId,
                  subsiteId: subsite_id,
                  interval_seconds
                });
              }
            );
          });
        }
      );
    });
  } catch (error) {
    console.error("❌ Error in processSubSiteSensorByAPI:", error.message);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = {
  processSubSiteSensorByAPI,
  fetchAndStoreSubSiteSensorData
};