const express = require("express");
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const { processSensorByAPI } = require("../controllers/fetchSensorDataController");

const router = express.Router();

// ✅ Route to fetch sensor data based on API & Sensor ID
router.get("/fetch-sensor", verifyAuthToken, processSensorByAPI);


module.exports = router;
