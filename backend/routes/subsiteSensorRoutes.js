const express = require("express");
const router = express.Router();
const {
  addSubSiteSensor,
  deleteSubSiteSensor,
  getAllSubSiteSensors
} = require("../controllers/subsiteSensorController");

// Add a new sensor to a sub-site
router.post("/add", addSubSiteSensor);

// Delete sensor by bank_id (subsiteId in body)
router.delete("/delete/:id", deleteSubSiteSensor);

// Get all sensors for a given sub-site
router.get("/all", getAllSubSiteSensors);

module.exports = router;