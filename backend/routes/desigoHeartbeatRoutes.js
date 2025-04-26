const express = require("express");
const { checkDesigoHeartbeat } = require("../controllers/desigoHeartbeatController");

const router = express.Router();

// Public Heartbeat Check
router.get("/heartbeat", checkDesigoHeartbeat);

module.exports = router;