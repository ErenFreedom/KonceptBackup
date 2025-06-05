const express = require("express");
const router = express.Router();
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const {
  processSubSiteSensorByAPI
} = require("../controllers/fetchSubsiteSensorDataController");

router.get("/fetch", verifyAuthToken, processSubSiteSensorByAPI);

module.exports = router;