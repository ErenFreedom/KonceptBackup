const express = require("express");
const router = express.Router();
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const {
  getSubsiteSensorJobStatus,
  getAllSubsiteSensorJobStatuses
} = require("../controllers/subsiteSensorJobStatusController");

router.get("/sensor", verifyAuthToken, getSubsiteSensorJobStatus);

router.get("/all", verifyAuthToken, getAllSubsiteSensorJobStatuses);

module.exports = router;