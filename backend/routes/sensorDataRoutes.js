const express = require("express");
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const { getLocalSensors, getLocalSensorAPIs, getSensorByAPI } = require("../controllers/sensorDataController");

const router = express.Router();

// ✅ Route to fetch all sensors from LocalSensorBank
router.get("/sensors", verifyAuthToken, getLocalSensors);

// ✅ Route to fetch all sensor APIs from LocalSensorAPIs
router.get("/sensor-apis", verifyAuthToken, getLocalSensorAPIs);

// ✅ Route to fetch sensor ID & Name using a single API
router.get("/sensor-by-api", verifyAuthToken, getSensorByAPI);

module.exports = router;
