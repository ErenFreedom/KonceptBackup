const axios = require("axios");
const jwt = require("jsonwebtoken");
const https = require("https");
const { db } = require("../db/sensorDB");
const { insertSubsiteLog } = require("../utils/logHelpersSubSite");
const intervalManager = require("../utils/intervalManagerSubSite");

const agent = new https.Agent({ rejectUnauthorized: false });

/** ✅ Fetch Latest Stored JWT Token */
const getStoredToken = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
      if (err || !row) reject("No stored token found.");
      else resolve(row.token);
    });
  });
};

/** ✅ Extract companyId from decoded token */
const getCompanyIdFromToken = async () => {
  const token = await getStoredToken();
  const decoded = jwt.verify(token, process.env.JWT_SECRET_APP);
  return decoded.companyId;
};

/** ✅ Fetch and Store Sub-site Sensor Data */
const fetchAndStoreSubSiteSensorData = async (sensor, companyId, subsiteId, desigoToken) => {
  try {
    const { sensor_id: bankId, api_endpoint } = sensor;

    const response = await axios.get(api_endpoint, {
      headers: { Authorization: `Bearer ${desigoToken}` },
      httpsAgent: agent,
    });

    const sensorData = response.data?.[0]?.Value;
    if (!sensorData) {
      insertSubsiteLog(bankId, `⚠️ No data returned from Desigo endpoint`, companyId, subsiteId);
      return;
    }

    const { Value, Quality, QualityGood, Timestamp } = sensorData;
    const tableName = `SensorData_${companyId}_${subsiteId}_${bankId}`;
    const activeTable = `Sensor_${companyId}_${subsiteId}`;

    db.get(`SELECT id FROM ${activeTable} WHERE bank_id = ?`, [bankId], (err, row) => {
      if (err || !row) {
        console.error(`❌ No active sensor found for bank_id=${bankId}`);
        insertSubsiteLog(bankId, `❌ No matching sensor_id in ${activeTable}`, companyId, subsiteId);
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
            insertSubsiteLog(bankId, `❌ Insert error: ${err.message}`, companyId, subsiteId);
          } else {
            insertSubsiteLog(bankId, `✅ Data inserted into ${tableName}`, companyId, subsiteId);
          }
        }
      );
    });
  } catch (err) {
    console.error(`❌ Fetch error:`, err.message);
    insertSubsiteLog(sensor.sensor_id, `❌ Fetch error: ${err.message}`, companyId, subsiteId);
  }
};

/** ✅ Main Controller to Process Sub-site Sensor Fetch */
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

    // ✅ Check if API exists in local DB
    db.get(`SELECT api_endpoint FROM ${apiTable} WHERE api_endpoint = ?`, [api_endpoint], (err, row) => {
      if (err || !row) {
        insertSubsiteLog(sensor_id, `❌ API not found in ${apiTable}`, companyId, subsite_id);
        return res.status(404).json({ message: "API not registered in local DB" });
      }

      // ✅ Use sensor_id = bank_id, and map it to local id
      db.get(
        `SELECT id, interval_seconds FROM ${sensorTable} WHERE bank_id = ? AND is_active = 1`,
        [sensor_id],
        (err, sensor) => {
          if (err || !sensor) {
            insertSubsiteLog(sensor_id, `❌ Sensor not active in ${sensorTable}`, companyId, subsite_id);
            return res.status(404).json({ message: "Sensor not active or not found" });
          }

          const localId = sensor.id;
          const bank_id = sensor_id;

          db.run(
            `INSERT INTO ${controlTable} (sensor_id, is_fetching)
             VALUES (?, 1)
             ON CONFLICT(sensor_id) DO UPDATE SET is_fetching = 1`,
            [localId],
            (err) => {
              if (err) {
                insertSubsiteLog(bank_id, `❌ IntervalControl insert failed: ${err.message}`, companyId, subsite_id);
                return res.status(500).json({ message: "Failed to update fetch control" });
              }

              // ✅ Start fetch interval
              intervalManager.startFetch(bank_id, async () => {
                try {
                  db.get(
                    `SELECT is_fetching FROM ${controlTable} WHERE sensor_id = ?`,
                    [localId],
                    (err, row) => {
                      if (err || !row || row.is_fetching !== 1) return;

                      fetchAndStoreSubSiteSensorData(
                        { sensor_id: bank_id, api_endpoint, interval_seconds: sensor.interval_seconds },
                        companyId,
                        subsite_id,
                        desigoToken
                      );
                    }
                  );
                } catch (err) {
                  insertSubsiteLog(bank_id, `❌ Interval crash: ${err.message}`, companyId, subsite_id);
                }
              }, sensor.interval_seconds * 1000);

              insertSubsiteLog(bank_id, `🚀 Started sub-site fetch every ${sensor.interval_seconds}s`, companyId, subsite_id);
              return res.status(200).json({
                message: "Sub-site fetch started",
                sensor_id: bank_id,
                companyId,
                subsiteId: subsite_id,
                interval_seconds: sensor.interval_seconds
              });
            }
          );
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