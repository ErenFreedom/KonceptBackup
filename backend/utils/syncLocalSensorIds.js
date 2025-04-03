const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// ✅ Database Path
const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
console.log(`📌 Using database path: ${dbPath}`);

// ✅ Open SQLite Database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Error opening database:", err.message);
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

/** ✅ Function to Fetch Company ID from JWT */
const getCompanyIdFromToken = async () => {
    try {
        const token = await getStoredToken();
        const decoded = jwt.verify(token, process.env.JWT_SECRET_APP);
        console.log(`🔍 Extracted companyId: ${decoded.companyId}`);
        return { token, companyId: decoded.companyId };
    } catch (error) {
        console.error("❌ Error decoding JWT:", error.message);
        throw new Error("Invalid token");
    }
};

/** ✅ Function to Fetch Sensors from Cloud DB */
const fetchCloudSensors = async (token) => {
    try {
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensors/list`;
        console.log(`📤 Fetching sensors from Cloud: ${cloudApiUrl}`);

        const response = await axios.get(cloudApiUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.data.sensors || response.data.sensors.length === 0) {
            console.log("⚠ No sensors found in Cloud DB.");
            return [];
        }

        console.log(`✅ Received ${response.data.sensors.length} sensors from Cloud.`);
        return response.data.sensors;

    } catch (error) {
        console.error("❌ Error fetching sensors from Cloud:", error.response?.data || error.message);
        throw new Error("Failed to fetch sensors from Cloud DB");
    }
};

/** ✅ Function to Update `id` in Local DB Based on Cloud IDs */
const updateLocalSensorIds = async () => {
    try {
        // ✅ Get Token & Company ID
        const { token, companyId } = await getCompanyIdFromToken();

        // ✅ Fetch Sensors from Cloud
        const cloudSensors = await fetchCloudSensors(token);

        if (cloudSensors.length === 0) {
            console.log("⚠ No sensors to update in Local DB.");
            return;
        }

        cloudSensors.forEach((sensor) => {
            db.run(
                `UPDATE LocalSensorBank SET id = ? WHERE object_id = ?`,
                [sensor.id, sensor.object_id],
                (err) => {
                    if (err) {
                        console.error(`❌ Error updating Sensor ID for ${sensor.object_id}:`, err.message);
                    } else {
                        console.log(`✅ Updated Local SensorBank: object_id=${sensor.object_id} → id=${sensor.id}`);
                    }
                }
            );
        });

        console.log("✅ ID Sync completed successfully!");

    } catch (error) {
        console.error("❌ Error syncing Local Sensor IDs:", error.message);
    }
};

/** ✅ Export Function */
module.exports = { updateLocalSensorIds };
