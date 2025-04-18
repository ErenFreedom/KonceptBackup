const axios = require("axios");


const jwt = require("jsonwebtoken");
const { insertLog } = require("../utils/logHelpers");
require("dotenv").config();

const { db } = require("../db/sensorDB"); // ✅ use your shared instance

// ✅ Create IntervalControl Table (referencing LocalSensorBank)
db.run(`
    CREATE TABLE IF NOT EXISTS IntervalControl (
        sensor_id INTEGER PRIMARY KEY,
        is_fetching INTEGER DEFAULT 0,
        is_sending INTEGER DEFAULT 0,
        FOREIGN KEY (sensor_id) REFERENCES LocalActiveSensors(id) ON DELETE CASCADE
    )
`);

/** ✅ Fetch Latest Token from Local DB */
const getStoredToken = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
            if (err || !row) return reject("No valid token found.");
            resolve(row.token);
        });
    });
};

/** ✅ Fetch Company ID from JWT */
const getCompanyIdFromToken = async () => {
    try {
        const token = await getStoredToken();
        const decoded = jwt.verify(token, process.env.JWT_SECRET_APP);
        console.log(`🔍 Extracted companyId: ${decoded.companyId}`);
        return decoded.companyId;
    } catch (err) {
        console.error("❌ JWT decode failed:", err.message);
        throw new Error("Invalid token");
    }
};

/** ✅ Send Sensor Data to Cloud */
/** ✅ Send Sensor Data to Cloud */
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

                    setInterval(() => {
                        try {
                            db.get(`SELECT is_sending FROM IntervalControl WHERE sensor_id = ?`, [localId], async (err, row) => {
                                if (err || !row || row.is_sending !== 1) return;

                                db.all(`SELECT * FROM ${tableName} WHERE sent_to_cloud = 0 ORDER BY timestamp ASC LIMIT ?`, [batch_size], async (err, rows) => {
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
                                });
                            });
                        } catch (intervalCrash) {
                            console.error(`❌ sendDataToCloud internal interval crash:`, intervalCrash.message);
                            insertLog(bank_id, `❌ Interval crashed: ${intervalCrash.message}`);
                        }
                    }, interval_seconds * 1000);

                    console.log(`🚀 Started cloud send interval for sensor ${bank_id} every ${interval_seconds}s`);
                    insertLog(bank_id, `🚀 Started sending data to cloud every ${interval_seconds}s`);
                });
            }
        );
    } catch (err) {
        console.error("❌ sendDataToCloud outer error:", err.message);
        insertLog(bank_id, `❌ sendDataToCloud outer error: ${err.message}`);
    }
};

/** ✅ API to Trigger Sending */
const triggerSendSensorData = async (req, res) => {
    const { sensor_id } = req.query;
    if (!sensor_id) return res.status(400).json({ message: "Sensor ID is required." });

    await sendDataToCloud(sensor_id);
    return res.status(200).json({ message: `Started sending data for sensor ${sensor_id}` });
};

/** ✅ API to Stop Sending */
const stopSendingToCloud = (req, res) => {
    const { sensor_id: bank_id } = req.query;
    if (!bank_id) return res.status(400).json({ message: "Sensor ID required to stop sending." });

    // 🔁 Step 1: Get local id from LocalActiveSensors
    db.get(`SELECT id FROM LocalActiveSensors WHERE bank_id = ?`, [bank_id], (err, row) => {
        if (err || !row) {
            console.error(`❌ Failed to map bank_id ${bank_id} to local id`, err?.message);
            insertLog(bank_id, `❌ Cannot stop sending: sensor ${bank_id} not found in LocalActiveSensors`);
            return res.status(404).json({ message: `Sensor ${bank_id} not found.` });
        }

        const localId = row.id;

        // 🔁 Step 2: Stop interval using correct local id
        db.run(
            `UPDATE IntervalControl SET is_sending = 0, is_fetching = 0 WHERE sensor_id = ?`,
            [localId],
            function (err) {
                if (err) {
                    console.error("❌ Failed to stop sending:", err.message);
                    insertLog(bank_id, `❌ Failed to stop sending: ${err.message}`);
                    return res.status(500).json({ message: "Failed to stop sending." });
                }

                if (this.changes === 0) {
                    insertLog(bank_id, `⚠️ No active interval found while stopping.`);
                    return res.status(404).json({ message: `No active sending interval found for sensor ${bank_id}` });
                }

                console.log(`🛑 Sending stopped for sensor ${bank_id}`);
                insertLog(bank_id, `🛑 Sending to cloud stopped.`);
                return res.status(200).json({ message: `Stopped sending to cloud for sensor ${bank_id}` });
            }
        );
    });
};
module.exports = { triggerSendSensorData, stopSendingToCloud };
