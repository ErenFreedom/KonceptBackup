const express = require("express");
const router = express.Router();
const { updateLocalSensorIds } = require("../utils/syncLocalSensorIds");

// ✅ API Endpoint to Sync Sensor IDs
router.post("/sync-sensor-ids", async (req, res) => {
    try {
        await updateLocalSensorIds();
        res.status(200).json({ message: "Sensor IDs successfully updated in Local DB" });
    } catch (error) {
        res.status(500).json({ message: "Failed to update sensor IDs", error: error.message });
    }
});

module.exports = router;
