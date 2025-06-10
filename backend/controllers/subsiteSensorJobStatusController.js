const { db } = require("../db/sensorDB");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const getAdminDetailsFromToken = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Missing or malformed Authorization header");
      return null;
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET_APP);

    if (!decoded.companyId) {
      console.error("❌ companyId missing in JWT payload:", decoded);
      return null;
    }

    return {
      companyId: decoded.companyId,
      adminId: decoded.adminId,
      subSites: decoded.subSites
    };
  } catch (err) {
    console.error("❌ Token decoding failed:", err.message);
    return null;
  }
};

// ✅ Get job status of a specific sub-site sensor
const getSubsiteSensorJobStatus = (req, res) => {
  const bankId = req.query.bank_id;
  const subsiteId = req.query.subsite_id;
  const { companyId } = getAdminDetailsFromToken(req) || {};

  if (!bankId || !subsiteId || !companyId) {
    return res.status(400).json({ message: "Missing bank_id or subsite_id or token" });
  }

  const sensorTable = `Sensor_${companyId}_${subsiteId}`;
  const controlTable = `IntervalControl_${companyId}_${subsiteId}`;

  const query = `
    SELECT ${controlTable}.is_fetching, ${controlTable}.is_sending
    FROM ${controlTable}
    JOIN ${sensorTable} ON ${controlTable}.sensor_id = ${sensorTable}.id
    WHERE ${sensorTable}.bank_id = ?
  `;

  db.get(query, [bankId], (err, row) => {
    if (err) {
      console.error("❌ DB error in sub-site job status fetch:", err.message);
      return res.status(500).json({ message: "DB error" });
    }

    if (!row) {
      return res.status(404).json({ message: "Sensor not found in IntervalControl" });
    }

    return res.status(200).json({
      is_fetching: !!row.is_fetching,
      is_sending: !!row.is_sending
    });
  });
};

// ✅ Get job status of all sub-site sensors
const getAllSubsiteSensorJobStatuses = (req, res) => {
  const subsiteId = req.query.subsite_id;
  const { companyId } = getAdminDetailsFromToken(req) || {};

  if (!subsiteId || !companyId) {
    return res.status(400).json({ message: "Missing subsite_id or token" });
  }

  const sensorTable = `Sensor_${companyId}_${subsiteId}`;
  const controlTable = `IntervalControl_${companyId}_${subsiteId}`;

  const query = `
    SELECT
      ${controlTable}.sensor_id AS local_id,
      ${sensorTable}.bank_id AS bank_id,
      ${controlTable}.is_fetching,
      ${controlTable}.is_sending
    FROM ${controlTable}
    JOIN ${sensorTable} ON ${controlTable}.sensor_id = ${sensorTable}.id
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ DB error in sub-site job status fetch all:", err.message);
      return res.status(500).json({ message: "DB error" });
    }

    const result = {};
    rows.forEach(row => {
      result[row.bank_id] = {
        is_fetching: !!row.is_fetching,
        is_sending: !!row.is_sending
      };
    });

    return res.status(200).json(result);
  });
};

module.exports = {
  getSubsiteSensorJobStatus,
  getAllSubsiteSensorJobStatuses
};