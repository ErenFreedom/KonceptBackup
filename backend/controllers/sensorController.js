const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const https = require("https");
require("dotenv").config();
const { updateLocalSensorIds } = require("../utils/syncLocalSensorIds");

const agent = new https.Agent({ rejectUnauthorized: false });

// ✅ Ensure correct database path
const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
console.log(`📌 Using database path: ${dbPath}`);

// ✅ Open Local Database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Error opening database:", err.message);
    else {
        db.run("PRAGMA foreign_keys = ON;", (err) => {
            if (err) console.error("❌ Failed to enable foreign keys:", err.message);
            else console.log("✅ Foreign keys enabled.");
        });
    }
});


/** ✅ Function to Fetch Latest Token from Local DB */
const getStoredToken = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
            if (err) {
                console.error("❌ Error fetching token:", err.message);
                reject("Error fetching token from database");
            } else if (!row) {
                reject("No stored token found.");
            } else {
                resolve(row.token);
            }
        });
    });
};

/** ✅ Add a Sensor (Connector Backend → Cloud Backend + Local DB) */
const addSensor = async (req, res) => {
    try {
        const { sensorApi, sensorName, rateLimit } = req.body;

        if (!sensorApi || !sensorName || !rateLimit) {
            return res.status(400).json({ message: "Sensor API, name, and rate limit are required" });
        }

        // ✅ Fetch stored cloud JWT
        let cloudToken;
        try {
            cloudToken = await getStoredToken();
            console.log(`🔐 Using Cloud Token: ${cloudToken}`);
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Cloud token missing or invalid" });
        }

        // ✅ Fetch Desigo token from request header
        const desigoAuthHeader = req.headers["desigo-authorization"];
        const desigoToken = desigoAuthHeader && desigoAuthHeader.split(" ")[1];
        if (!desigoToken) {
            return res.status(401).json({ message: "Unauthorized: Desigo token missing" });
        }

        // ✅ Verify sensor API is accessible
        let sensorData;
        try {
            console.log(`🔍 Fetching Sensor Data from: ${sensorApi}`);
            const response = await axios.get(sensorApi, {
                headers: { Authorization: `Bearer ${desigoToken}` },
                httpsAgent: agent // ✅ This allows self-signed SSL
            });

            sensorData = response.data;
            console.log(`✅ Sensor Data Received:`, sensorData);
        } catch (error) {
            console.error("❌ Invalid Sensor API:", error.message);
            return res.status(400).json({ message: "Invalid Sensor API. No response received." });
        }

        // ✅ Extract required Desigo fields
        if (!sensorData || !sensorData[0]?.DataType || !sensorData[0]?.ObjectId || !sensorData[0]?.PropertyName) {
            console.error("❌ Invalid sensor API response format:", sensorData);
            return res.status(400).json({ message: "Invalid sensor API response format" });
        }

        const { DataType, ObjectId, PropertyName } = sensorData[0];

        // ✅ Push to Cloud
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensor-bank/add`;
        let cloudResponse;
        try {
            cloudResponse = await axios.post(cloudApiUrl, {
                sensorName,
                description: `Sensor added via Connector App`,
                objectId: ObjectId,
                propertyName: PropertyName,
                dataType: DataType,
                isActive: false
            }, {
                headers: { Authorization: `Bearer ${cloudToken}` }
            });

            console.log("✅ Sensor added to Cloud:", cloudResponse.data);
        } catch (error) {
            console.error("❌ Failed to add sensor to cloud:", error.response?.data || error.message);
            return res.status(500).json({
                message: "Failed to add sensor to cloud",
                error: error.response?.data || error.message
            });
        }

        // ✅ Insert into Local DB
        db.serialize(() => {
            const insertSensorQuery = `
                INSERT INTO LocalSensorBank (name, description, object_id, property_name, data_type, is_active)
                VALUES (?, ?, ?, ?, ?, 0)
            `;
            db.run(insertSensorQuery, [sensorName, "Sensor added via Connector App", ObjectId, PropertyName, DataType], function (err) {
                if (err) {
                    console.error("❌ Error inserting into LocalSensorBank:", err.message);
                    return res.status(500).json({ message: "Failed to insert sensor locally" });
                }

                const newSensorId = this.lastID;
                console.log(`✅ Sensor inserted with ID: ${newSensorId}`);

                const insertApiQuery = `
                    INSERT INTO LocalSensorAPIs (sensor_id, api_endpoint)
                    VALUES (?, ?)
                `;
                db.run(insertApiQuery, [newSensorId, sensorApi], async (err) => {
                    if (err) {
                        console.error("❌ Error inserting into LocalSensorAPIs:", err.message);
                    } else {
                        console.log(`✅ API for sensor ${newSensorId} stored in LocalSensorAPIs.`);
                        await updateLocalSensorIds(); // optional: sync with memory
                    }
                });

                return res.status(200).json({
                    message: "Sensor added successfully",
                    sensorId: newSensorId,
                    cloudResponse: cloudResponse.data
                });
            });
        });

    } catch (error) {
        console.error("❌ Error adding sensor:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};



/** ✅ Delete a Sensor (Connector Requests Cloud to Delete + Remove from Local DB) */
const deleteSensor = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🧩 Sensor ID received in request: ${id}`);

        // ✅ Get stored token
        let token;
        try {
            token = await getStoredToken();
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
        }

        // ✅ Cloud delete
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensor-bank/delete/${id}`;
        console.log(`🗑 Deleting Sensor from Cloud: ${cloudApiUrl}`);

        let cloudResponse;
        try {
            cloudResponse = await axios.delete(cloudApiUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log("✅ Sensor deleted from Cloud:", cloudResponse.data);
        } catch (error) {
            console.error("❌ Error deleting from Cloud:", error.response?.data || error.message);
            return res.status(500).json({
                message: "Failed to delete sensor from cloud",
                error: error.response?.data || error.message,
            });
        }

        // ✅ Local DB cleanup
        db.serialize(() => {
            db.run(`DELETE FROM LocalActiveSensors WHERE bank_id = ?`, [id], (err) => {
                if (err) console.error("❌ Error deleting from LocalActiveSensors:", err.message);
                else console.log(`✅ Sensor ${id} deleted from LocalActiveSensors.`);
            });

            db.run(`DELETE FROM LocalSensorAPIs WHERE sensor_id = ?`, [id], async (err) => {
                if (err) console.error("❌ Error deleting from LocalSensorAPIs:", err.message);
                else {
                    console.log(`✅ Sensor ${id} API deleted from LocalSensorAPIs.`);
                    await updateLocalSensorIds(); // optional sync
                }
            });

            db.run(`DELETE FROM LocalSensorBank WHERE id = ?`, [id], (err) => {
                if (err) console.error("❌ Error deleting from LocalSensorBank:", err.message);
                else console.log(`✅ Sensor ${id} deleted from LocalSensorBank.`);
            });
        });

        return res.status(200).json({
            message: "Sensor deleted successfully",
            cloudResponse: cloudResponse.data,
        });

    } catch (error) {
        console.error("❌ Error deleting sensor:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};




/** ✅ Get All Sensors (Connector Fetches from Cloud Only) */
const getAllSensors = async (req, res) => {
    try {
        // ✅ Fetch stored JWT from local DB
        let token;
        try {
            token = await getStoredToken();
            console.log(`🔍 Using Token: ${token}`);
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
        }

        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensor-bank/all`;
        console.log(`📤 Fetching Sensors from Cloud: ${cloudApiUrl}`);

        try {
            const cloudResponse = await axios.get(cloudApiUrl, { headers: { Authorization: `Bearer ${token}` } });
            console.log("✅ Sensors received from Cloud:", cloudResponse.data);
            res.status(200).json({ sensors: cloudResponse.data });
        } catch (error) {
            console.error("❌ Error fetching sensors from cloud:", error.response?.data || error.message);
            res.status(500).json({ message: "Failed to fetch sensors from cloud", error: error.response?.data || error.message });
        }
    } catch (error) {
        console.error("❌ Error fetching sensors:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

const getStoredDesigoToken = async (req, res) => {
    try {
        // Query the latest Desigo Token from the database
        db.get("SELECT token FROM DesigoAuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
            if (err || !row) {
                console.error("❌ Error fetching Desigo token:", err?.message || "No token found");
                return res.status(401).json({ message: "Unauthorized: No Desigo Token Found" });
            }
            res.status(200).json({ desigoToken: row.token });
        });
    } catch (error) {
        console.error("❌ Error retrieving Desigo token:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


/** ✅ Get All Sensors from Local DB with API */
const getAllLocalSensorsWithAPI = async (req, res) => {
    try {
        const query = `
        SELECT 
          b.id, b.name, b.description, b.object_id, b.property_name, 
          b.data_type, b.is_active, b.created_at, b.updated_at,
          a.api_endpoint
        FROM LocalSensorBank b
        LEFT JOIN LocalSensorAPIs a ON a.sensor_id = b.id
      `;

        db.all(query, [], (err, rows) => {
            if (err) {
                console.error("❌ Error fetching local sensors with API:", err.message);
                return res.status(500).json({ message: "Failed to fetch sensors", error: err.message });
            }

            return res.status(200).json({ sensors: rows });
        });
    } catch (error) {
        console.error("❌ Internal error in getAllLocalSensorsWithAPI:", error.message);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

module.exports = { addSensor, getAllSensors, deleteSensor, getStoredDesigoToken, getAllLocalSensorsWithAPI };
