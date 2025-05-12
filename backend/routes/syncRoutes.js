const express = require("express");
const router = express.Router();
const { syncFromCloud } = require("../controllers/syncFromCloudController");

router.get("/sync/from-cloud", syncFromCloud);

module.exports = router;