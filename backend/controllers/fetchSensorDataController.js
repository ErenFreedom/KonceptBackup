const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const jwt = require("jsonwebtoken");
const { insertLog } = require("../utils/logHelpers");
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false });


// ✅ DB Path & Connection
const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) console.error("❌ Error opening database:", err.message);
    else console.log("✅ Connected to Local SQLite Database.");
});

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
        const { sensor_id, api_endpoint } = sensor;

        const response = await axios.get(api_endpoint, {
            headers: { Authorization: `Bearer ${desigoToken}` },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }) // 👈 Add this
        });

        const sensorData = response.data?.[0]?.Value;
        if (!sensorData) {
            insertLog(sensor_id, "⚠️ No data returned from Desigo endpoint.");
            return;
        }

        const { Value, Quality, QualityGood, Timestamp } = sensorData;
        const tableName = `SensorData_${companyId}_${sensor_id}`;

        const insertQuery = `
            INSERT INTO ${tableName} (sensor_id, value, quality, quality_good, timestamp)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.run(insertQuery, [sensor_id, Value, Quality, QualityGood, Timestamp], (err) => {
            if (err) {
                console.error(`❌ DB Insert Error in ${tableName}:`, err.message);
                insertLog(sensor_id, `❌ Failed to insert data into ${tableName}: ${err.message}`);
            } else {
                insertLog(sensor_id, `✅ Data saved successfully to ${tableName}`);
            }
        });
    } catch (err) {
        console.error(`❌ Error fetching from Desigo CC for sensor ${sensor.sensor_id}:`, err.message);
        insertLog(sensor.sensor_id, `❌ Fetch failed: ${err.message}`);
    }
};


/** ✅ Main Controller */
const processSensorByAPI = async (req, res) => {
    try {
        const { api_endpoint, sensor_id } = req.query;
        const desigoToken = req.headers["x-desigo-token"];

        if (!api_endpoint || !sensor_id || !desigoToken) {
            return res.status(400).json({ message: "API endpoint, sensor ID, and Desigo token are required." });
        }

        console.log(`🔍 API: ${api_endpoint} | Sensor ID: ${sensor_id}`);
        const companyId = await getCompanyIdFromToken();

        // ✅ Step 1: Validate Sensor API
        db.get(`SELECT api_endpoint FROM LocalSensorAPIs WHERE api_endpoint = ?`, [api_endpoint], (err, row) => {
            if (err || !row) {
                insertLog(sensor_id, "❌ Sensor API not found in LocalSensorAPIs.");
                return res.status(404).json({ message: "Sensor API not found in LocalSensorAPIs." });
            }

            // ✅ Step 2: Check Active Sensor Status
            db.get(`SELECT bank_id, interval_seconds, is_active FROM LocalActiveSensors WHERE bank_id = ? AND is_active = 1`, [sensor_id], (err, sensor) => {
                if (err || !sensor) {
                    insertLog(sensor_id, "❌ Sensor is not active or not found.");
                    return res.status(404).json({ message: "Sensor not active or not found in LocalActiveSensors." });
                }

                const { bank_id, interval_seconds } = sensor;

                // ✅ Step 3: Check IntervalControl Table
                db.get(`SELECT is_fetching FROM IntervalControl WHERE sensor_id = ?`, [bank_id], (err, row) => {
                    if (err) return res.status(500).json({ message: "Error checking IntervalControl table." });

                    if (row && row.is_fetching === 1) {
                        insertLog(bank_id, "⚠️ Fetching already in progress.");
                        return res.status(409).json({ message: `Sensor ${bank_id} is already fetching.` });
                    }

                    // ✅ Step 4: Insert or Update IntervalControl
                    db.run(`
                        INSERT INTO IntervalControl (sensor_id, is_fetching) VALUES (?, 1)
                        ON CONFLICT(sensor_id) DO UPDATE SET is_fetching = 1;
                    `, [bank_id], (err) => {
                        if (err) {
                            console.error("❌ Failed to update IntervalControl:", err.message);
                            insertLog(bank_id, `❌ Failed to update fetch control: ${err.message}`);
                            return res.status(500).json({ message: "Failed to update fetch status." });
                        }

                        // ✅ Step 5: Start Interval
                        setInterval(() => {
                            db.get(
                                `SELECT is_fetching FROM IntervalControl WHERE sensor_id = ?`,
                                [bank_id],
                                (err, row) => {
                                    if (err || !row || row.is_fetching !== 1) return;

                                    fetchAndStoreSensorData(
                                        { sensor_id: bank_id, api_endpoint, interval_seconds },
                                        companyId,
                                        desigoToken
                                    );
                                }
                            );
                        }, interval_seconds * 1000);

                        insertLog(bank_id, `🚀 Started data fetch every ${interval_seconds}s`);

                        return res.status(200).json({
                            message: "Fetching started for sensor",
                            sensor_id: bank_id,
                            companyId,
                            interval_seconds
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error("❌ Error in processSensorByAPI:", error.message);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

module.exports = { processSensorByAPI };


