const express = require("express");
const router = express.Router();
const { verifyAuthToken } = require("../middlewares/authMiddleware");
const {
  processSubSiteSensorByAPI
} = require("../controllers/fetchSubsiteSensorDataController");

router.post("/fetch", verifyAuthToken, processSubSiteSensorByAPI);

module.exports = router;