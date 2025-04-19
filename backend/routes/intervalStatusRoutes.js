const express = require("express");
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const { getIntervalStatus } = require("../controllers/intervalStatusController");

const router = express.Router();

router.get("/status", verifyAuthToken, getIntervalStatus);

module.exports = router;
