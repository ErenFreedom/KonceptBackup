const express = require("express");
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const { activateSensor, deactivateSensor, removeActiveSensor, getAllActiveSensors, reactivateSensor, updateSensorSettings } = require("../controllers/activateSensorController");

const router = express.Router();

router.get("/active", verifyAuthToken, getAllActiveSensors);
router.post("/activate", verifyAuthToken, activateSensor);   // ✅ Route to activate sensor
router.post("/deactivate", verifyAuthToken, deactivateSensor); // ✅ Route to deactivate sensor
router.post("/remove", verifyAuthToken, removeActiveSensor); // ✅ Route to remove sensor
router.post("/reactivate", verifyAuthToken,reactivateSensor);
router.post("/update-settings", verifyAuthToken, updateSensorSettings);


module.exports = router;
