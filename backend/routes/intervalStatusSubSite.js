const express = require("express");
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const { getSubsiteIntervalStatus } = require("../controllers/intervalStatusSubSiteController");

const router = express.Router();

router.get("/status", verifyAuthToken, getSubsiteIntervalStatus);

module.exports = router;