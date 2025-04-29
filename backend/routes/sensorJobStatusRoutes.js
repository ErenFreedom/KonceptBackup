const express = require("express");
const router = express.Router();
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const {
  getSensorJobStatus,
  getAllSensorJobStatuses
} = require("../controllers/sensorJobStatusController");

router.get("/sensor", verifyAuthToken, getSensorJobStatus); // ?bank_id=XX
router.get("/all", verifyAuthToken, getAllSensorJobStatuses);

module.exports = router;