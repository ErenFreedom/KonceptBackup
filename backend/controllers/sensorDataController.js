const { db } = require("../db/sensorDB"); // ✅ use your shared instance
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

    db.all(`SELECT id, sensor_id, api_endpoint FROM LocalSensorAPIs`, [], (err, rows) => {
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
    SELECT LocalActiveSensors.id AS id, LocalSensorBank.name 
    FROM LocalActiveSensors
    INNER JOIN LocalSensorAPIs ON LocalActiveSensors.id = LocalSensorAPIs.sensor_id
    INNER JOIN LocalSensorBank ON LocalSensorBank.id = LocalActiveSensors.bank_id
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
