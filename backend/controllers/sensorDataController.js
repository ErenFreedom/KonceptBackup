const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// ✅ Ensure correct database path
const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
console.log(`📌 Using database path: ${dbPath}`);

// ✅ Open Local Database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error("❌ Error opening database:", err.message);
    } else {
        console.log("✅ Connected to Local SQLite Database.");
    }
});

/** ✅ Fetch All Sensors from LocalSensorBank */
const getLocalSensors = (req, res) => {
    console.log("🔍 Fetching sensors from LocalSensorBank");

    db.all(`SELECT id, name, object_id, property_name, is_active FROM LocalSensorBank`, [], (err, rows) => {
        if (err) {
            console.error("❌ Error fetching sensors:", err.message);
            return res.status(500).json({ message: "Failed to fetch sensors" });
        }

        if (!rows || rows.length === 0) {
            return res.status(404).json({ message: "No sensors found in Local DB" });
        }

        res.status(200).json({ sensors: rows });
    });
};

/** ✅ Fetch All Sensor APIs from LocalSensorAPIs */
const getLocalSensorAPIs = (req, res) => {
    console.log("🔍 Fetching sensor APIs from LocalSensorAPIs");

    db.all(`SELECT id, sensor_id, sensor_api FROM LocalSensorAPIs`, [], (err, rows) => {
        if (err) {
            console.error("❌ Error fetching sensor APIs:", err.message);
            return res.status(500).json({ message: "Failed to fetch sensor APIs" });
        }

        if (!rows || rows.length === 0) {
            return res.status(404).json({ message: "No sensor APIs found in Local DB" });
        }

        res.status(200).json({ sensorAPIs: rows });
    });
};

/** ✅ Fetch Sensor ID and Name using a Single API */
const getSensorByAPI = (req, res) => {
    const { api_endpoint } = req.query; // Get API endpoint from request query

    if (!api_endpoint) {
        return res.status(400).json({ message: "API Endpoint is required." });
    }

    console.log(`🔍 Searching for sensor using API: ${api_endpoint}`);

    // ✅ Corrected Query with the right column name
    const query = `
        SELECT LocalSensorBank.id, LocalSensorBank.name 
        FROM LocalSensorBank
        INNER JOIN LocalSensorAPIs ON LocalSensorBank.id = LocalSensorAPIs.sensor_id
        WHERE LocalSensorAPIs.api_endpoint = ?;
    `;

    db.get(query, [api_endpoint], (err, row) => {
        if (err) {
            console.error("❌ Error fetching sensor by API:", err.message);
            return res.status(500).json({ message: "Failed to fetch sensor by API" });
        }

        if (!row) {
            return res.status(404).json({ message: "No sensor found for the given API." });
        }

        res.status(200).json(row); // ✅ Return sensor ID & name
    });
};

/** ✅ Export All Functions */
module.exports = { getLocalSensors, getLocalSensorAPIs, getSensorByAPI };
