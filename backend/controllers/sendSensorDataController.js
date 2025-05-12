const axios = require("axios");
const jwt = require("jsonwebtoken");
const { insertLog } = require("../utils/logHelpers");
const intervalManager = require("../utils/intervalManager");
const { db } = require("../db/sensorDB");
require("dotenv").config();

// ✅ Create IntervalControl Table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS IntervalControl (
    sensor_id INTEGER PRIMARY KEY,
    is_fetching INTEGER DEFAULT 0,
    is_sending INTEGER DEFAULT 0,
    FOREIGN KEY (sensor_id) REFERENCES LocalActiveSensors(id) ON DELETE CASCADE
  )
`);

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

/** ✅ Start cloud sending for sensor */
const sendDataToCloud = async (bank_id) => {
  try {
    const companyId = await getCompanyIdFromToken();
    const tableName = `SensorData_${companyId}_${bank_id}`;

    db.get(
      `SELECT id, interval_seconds, batch_size FROM LocalActiveSensors WHERE bank_id = ? AND is_active = 1`,
      [bank_id],
      (err, sensorRow) => {
        if (err || !sensorRow) {
          console.error(`❌ Sensor ${bank_id} not found or inactive.`, err?.message);
          insertLog(bank_id, `❌ Sensor ${bank_id} not found or inactive in LocalActiveSensors.`);
          return;
        }

        const { id: localId, interval_seconds, batch_size } = sensorRow;

        db.run(`
          INSERT INTO IntervalControl (sensor_id, is_sending)
          VALUES (?, 1)
          ON CONFLICT(sensor_id) DO UPDATE SET is_sending = 1;
        `, [localId], (err) => {
          if (err) {
            console.error("❌ Failed to update IntervalControl:", err.message);
            insertLog(bank_id, `❌ Failed to update IntervalControl: ${err.message}`);
            return;
          }

          // ✅ Start managed interval via intervalManager
          intervalManager.startSend(bank_id, async () => {
            try {
              db.get(`SELECT is_sending FROM IntervalControl WHERE sensor_id = ?`, [localId], async (err, row) => {
                if (err || !row || row.is_sending !== 1) return;

                db.all(
                  `SELECT * FROM ${tableName} WHERE sent_to_cloud = 0 ORDER BY timestamp ASC LIMIT ?`,
                  [batch_size],
                  async (err, rows) => {
                    if (err) {
                      insertLog(bank_id, `❌ DB Error fetching batch: ${err.message}`);
                      return;
                    }

                    if (rows.length < batch_size) {
                      insertLog(bank_id, `⏳ Waiting for full batch of ${batch_size}. Current: ${rows.length}`);
                      return;
                    }

                    const sanitizedBatch = rows.map(row => ({
                      ...row,
                      sensor_id: bank_id
                    }));

                    try {
                      const response = await axios.post(
                        `${process.env.CLOUD_API_URL}/api/sensor-data/receive-data`,
                        {
                          companyId,
                          sensorId: bank_id,
                          batch: sanitizedBatch,
                        },
                        {
                          headers: {
                            Authorization: `Bearer ${await getStoredToken()}`
                          }
                        }
                      );

                      console.log("✅ Cloud response:", response.data);
                      insertLog(bank_id, `✅ Sent batch to cloud. Count: ${rows.length}`);

                      const ids = rows.map(row => row.id).join(",");
                      db.run(`UPDATE ${tableName} SET sent_to_cloud = 1 WHERE id IN (${ids})`);
                    } catch (cloudErr) {
                      console.error(`❌ Cloud send error for sensor ${bank_id}:`, cloudErr.message);
                      insertLog(bank_id, `❌ Cloud send failed: ${cloudErr.message}`);
                    }
                  }
                );
              });
            } catch (intervalCrash) {
              console.error(`❌ Interval crash (send) for sensor ${bank_id}:`, intervalCrash.message);
              insertLog(bank_id, `❌ Interval crash (send): ${intervalCrash.message}`);
            }
          }, interval_seconds * 1000);

          console.log(`🚀 Started cloud send interval for sensor ${bank_id}`);
          insertLog(bank_id, `🚀 Started sending data to cloud every ${interval_seconds}s`);
        });
      }
    );
  } catch (err) {
    console.error("❌ sendDataToCloud outer error:", err.message);
    insertLog(bank_id, `❌ sendDataToCloud outer error: ${err.message}`);
  }
};

/** ✅ API to trigger sending */
const triggerSendSensorData = async (req, res) => {
  const { sensor_id } = req.query;
  if (!sensor_id) return res.status(400).json({ message: "Sensor ID is required." });

  await sendDataToCloud(sensor_id);
  return res.status(200).json({ message: `Started sending data for sensor ${sensor_id}` });
};

/** ✅ API to stop sending (and also fetching) */
const stopSendingToCloud = (req, res) => {
    const { sensor_id: bank_id } = req.query;
    if (!bank_id) return res.status(400).json({ message: "Sensor ID required to stop sending." });
  
    db.get(`SELECT id FROM LocalActiveSensors WHERE bank_id = ?`, [bank_id], (err, row) => {
      if (err || !row) {
        console.error(`❌ Failed to map bank_id ${bank_id} to local id`, err?.message);
        insertLog(bank_id, `❌ Cannot stop sending: sensor ${bank_id} not found in LocalActiveSensors`);
        return res.status(404).json({ message: `Sensor ${bank_id} not found.` });
      }
  
      const localId = row.id;
  
      db.run(
        `UPDATE IntervalControl SET is_sending = 0, is_fetching = 0 WHERE sensor_id = ?`,
        [localId],
        function (err) {
          if (err) {
            console.error("❌ Failed to stop jobs:", err.message);
            insertLog(bank_id, `❌ Failed to stop jobs: ${err.message}`);
            return res.status(500).json({ message: "Failed to stop jobs." });
          }
  
          intervalManager.stopSend(bank_id);
          intervalManager.stopFetch(bank_id);
  
          insertLog(bank_id, `🛑 Sending and Fetching jobs stopped.`);
          return res.status(200).json({ message: `Stopped all jobs for sensor ${bank_id}` });
        }
      );
    });
  };
module.exports = {
  triggerSendSensorData,
  stopSendingToCloud,
  sendDataToCloud
};