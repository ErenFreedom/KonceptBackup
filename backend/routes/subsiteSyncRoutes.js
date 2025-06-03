const express = require("express");
const router = express.Router();
const { triggerSubSiteSync } = require("../controllers/syncSubsiteController");

// GET /api/subsite/sync-all
router.get("/sync-all", triggerSubSiteSync);

module.exports = router;