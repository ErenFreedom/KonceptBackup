const express = require("express");
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const { triggerSendSensorData , stopSendingToCloud} = require("../controllers/sendSensorDataController");

const router = express.Router();

// ✅ Route to Start Sending Data to Cloud
router.get("/send", verifyAuthToken, triggerSendSensorData);
router.get("/stop-send", verifyAuthToken, stopSendingToCloud);

module.exports = router;
