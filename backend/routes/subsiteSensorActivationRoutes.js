const express = require("express");
const router = express.Router();

const {
  activateSubSiteSensor,
  deactivateSubSiteSensor,
  removeSubSiteSensor,
  getAllActiveSubSiteSensors,
  reactivateSubSiteSensor,
  updateSubSiteSensorSettings
} = require("../controllers/activateSubSiteSensorController");

router.post("/activate", activateSubSiteSensor);

router.post("/deactivate", deactivateSubSiteSensor);

router.post("/remove", removeSubSiteSensor);

router.get("/active", getAllActiveSubSiteSensors);

router.post("/reactivate", reactivateSubSiteSensor);

router.put("/settings", updateSubSiteSensorSettings);

module.exports = router;