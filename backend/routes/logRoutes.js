const express = require("express");
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const { getSensorLogStatus } = require("../controllers/logsController");

const router = express.Router();

router.get("/status", verifyAuthToken, getSensorLogStatus);

module.exports = router;
