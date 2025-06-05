const express = require("express");
const router = express.Router();
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const {
  triggerSendSubsiteData,
  stopSubsiteJobs
} = require("../controllers/sendToCloudSubSiteController");

router.post("/send", verifyAuthToken, triggerSendSubsiteData);

router.post("/stop", verifyAuthToken, stopSubsiteJobs);

module.exports = router;