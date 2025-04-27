const express = require("express");
const { startHeartbeatMonitor } = require("../controllers/heartbeatMonitorController");

const router = express.Router();

// ✅ Optional: Allow manual starting if needed (Not necessary if auto-start from server.js)
router.post("/start-monitor", (req, res) => {
  startHeartbeatMonitor();
  res.status(200).json({ message: "Heartbeat monitor started manually." });
});

module.exports = router;