const axios = require("axios");
const jwt = require("jsonwebtoken");
const { insertLog } = require("../utils/logHelpersSubSite");
const intervalManager = require("../utils/intervalManagerSubSite");
const { db } = require("../db/sensorDB");
require("dotenv").config();

/** ✅ Get latest stored JWT */
const getStoredToken = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
      if (err || !row) return reject("No valid token found.");
      resolve(row.token);
    });
  });
};

/** ✅ Decode companyId from JWT */
const getCompanyIdFromToken = async () => {
  const token = await getStoredToken();
  const decoded = jwt.verify(token, process.env.JWT_SECRET_APP);
  return decoded.companyId;
};

/** ✅ Start cloud sending for subsite sensor */
const sendSubsiteDataToCloud = async (subsiteId, bank_id) => {
  try {
    const companyId = await getCompanyIdFromToken();
    const tableName = `SensorData_${companyId}_${subsiteId}_${bank_id}`;

    db.get(
      `SELECT id, interval_seconds, batch_size FROM Sensor_${companyId}_${subsiteId} WHERE bank_id = ? AND is_active = 1`,
      [bank_id],
      (err, sensorRow) => {
        if (err || !sensorRow) {
          console.error(`❌ Sensor ${bank_id} not found or inactive in sub-site`, err?.message);
          insertLog(bank_id, `❌ Sensor ${bank_id} not active in Sensor_${companyId}_${subsiteId}`);
          return;
        }

        const { id: localId, interval_seconds, batch_size } = sensorRow;

        db.run(
          `INSERT INTO IntervalControl_${companyId}_${subsiteId} (sensor_id, is_sending)
           VALUES (?, 1)
           ON CONFLICT(sensor_id) DO UPDATE SET is_sending = 1`,
          [localId],
          (err) => {
            if (err) {
              console.error("❌ Failed to update IntervalControl:", err.message);
              insertLog(bank_id, `❌ Failed IntervalControl update: ${err.message}`);
              return;
            }

            intervalManager.startSend(bank_id, async () => {
              try {
                db.get(
                  `SELECT is_sending FROM IntervalControl_${companyId}_${subsiteId} WHERE sensor_id = ?`,
                  [localId],
                  async (err, row) => {
                    if (err || !row || row.is_sending !== 1) return;

                    db.all(
                      `SELECT * FROM ${tableName} WHERE sent_to_cloud = 0 ORDER BY timestamp ASC LIMIT ?`,
                      [batch_size],
                      async (err, rows) => {
                        if (err) {
                          insertLog(bank_id, `❌ Fetch error: ${err.message}`);
                          return;
                        }

                        if (rows.length < batch_size) {
                          insertLog(bank_id, `⏳ Waiting for batch. Needed: ${batch_size}, Found: ${rows.length}`);
                          return;
                        }

                        const sanitizedBatch = rows.map(row => ({
                          ...row,
                          sensor_id: bank_id
                        }));

                        try {
                          const response = await axios.post(
                            `${process.env.CLOUD_API_URL}/api/subsite/sensor-data/receive-data`,
                            {
                              companyId,
                              subsiteId,
                              sensorId: bank_id,
                              batch: sanitizedBatch
                            },
                            {
                              headers: { Authorization: `Bearer ${await getStoredToken()}` }
                            }
                          );

                          insertLog(bank_id, `✅ Sub-site batch sent to cloud. Count: ${rows.length}`);
                          const ids = rows.map(row => row.id).join(",");
                          db.run(`UPDATE ${tableName} SET sent_to_cloud = 1 WHERE id IN (${ids})`);
                        } catch (err) {
                          insertLog(bank_id, `❌ Cloud error: ${err.message}`);
                        }
                      }
                    );
                  }
                );
              } catch (intervalCrash) {
                insertLog(bank_id, `❌ Send interval crash: ${intervalCrash.message}`);
              }
            }, interval_seconds * 1000);

            insertLog(bank_id, `🚀 Started cloud send for sub-site sensor every ${interval_seconds}s`);
          }
        );
      }
    );
  } catch (err) {
    console.error("❌ sendSubsiteDataToCloud outer error:", err.message);
    insertLog(bank_id, `❌ sendSubsiteDataToCloud outer error: ${err.message}`);
  }
};

/** ✅ Trigger Sub-site Sending */
const triggerSendSubsiteData = async (req, res) => {
  const { subsite_id, sensor_id } = req.query;
  if (!subsite_id || !sensor_id)
    return res.status(400).json({ message: "subsite_id and sensor_id are required" });

  await sendSubsiteDataToCloud(subsite_id, sensor_id);
  return res.status(200).json({ message: `Started sending for sensor ${sensor_id} in sub-site ${subsite_id}` });
};

/** ✅ Stop Sub-site Fetch and Send */
const stopSubsiteJobs = (req, res) => {
  const { subsite_id, sensor_id } = req.query;
  if (!subsite_id || !sensor_id)
    return res.status(400).json({ message: "subsite_id and sensor_id are required to stop" });

  getCompanyIdFromToken().then(companyId => {
    db.get(`SELECT id FROM Sensor_${companyId}_${subsite_id} WHERE bank_id = ?`, [sensor_id], (err, row) => {
      if (err || !row) {
        insertLog(sensor_id, `❌ Cannot stop: not found in Sensor_${companyId}_${subsite_id}`);
        return res.status(404).json({ message: `Sensor not found in sub-site` });
      }

      const localId = row.id;

      db.run(
        `UPDATE IntervalControl_${companyId}_${subsite_id} SET is_sending = 0, is_fetching = 0 WHERE sensor_id = ?`,
        [localId],
        function (err) {
          if (err) {
            insertLog(sensor_id, `❌ Stop failed: ${err.message}`);
            return res.status(500).json({ message: "Failed to stop jobs." });
          }

          intervalManager.stopSend(sensor_id);
          intervalManager.stopFetch(sensor_id);

          insertLog(sensor_id, `🛑 Jobs stopped for sub-site sensor.`);
          return res.status(200).json({ message: `Stopped jobs for sensor ${sensor_id}` });
        }
      );
    });
  });
};

module.exports = {
  triggerSendSubsiteData,
  stopSubsiteJobs,
  sendSubsiteDataToCloud
};