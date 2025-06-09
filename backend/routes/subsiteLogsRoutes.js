const express = require("express");
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const { getSubsiteSensorLogStatus } = require("../controllers/subsiteLogsController");

const router = express.Router();

router.get("/status", verifyAuthToken, getSubsiteSensorLogStatus);

module.exports = router;