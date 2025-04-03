const express = require("express");
const { verifyAuthToken } = require("../middlewares/authMiddleware"); // ✅ Existing Login Token Middleware
const { verifyDesigoAuthToken } = require("../middlewares/desigoAuthMiddleware"); // ✅ NEW Desigo Token Middleware
const { addSensor, getAllSensors, deleteSensor, getStoredDesigoToken, getAllLocalSensorsWithAPI } = require("../controllers/sensorController");

const router = express.Router();

// ✅ Apply BOTH Login Token & Desigo Token Middleware to Protect Routes
router.post("/add", verifyAuthToken, verifyDesigoAuthToken, addSensor);  // ✅ Protected Route (Add Sensor)
router.get("/", verifyAuthToken, getAllSensors); // ✅ Protected Route (Fetch All Sensors)
router.delete("/:id", verifyAuthToken, deleteSensor); // ✅ Protected Route (Delete a Sensor)
router.get("/desigo-token",verifyAuthToken, getStoredDesigoToken);
router.get("/localAPIs",verifyAuthToken, getAllLocalSensorsWithAPI);


module.exports = router;
