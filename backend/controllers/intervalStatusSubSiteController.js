const { db } = require("../db/sensorDB"); // shared SQLite DB instance
const jwt = require("jsonwebtoken");
require("dotenv").config();

/** 🔐 Extract companyId from token */
const getCompanyIdFromToken = (req) => {
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

    return decoded.companyId;
  } catch (err) {
    console.error("❌ Invalid JWT token:", err.message);
    return null;
  }
};

/** ✅ Sub-site Interval Status Checker */
const getSubsiteIntervalStatus = (req, res) => {
  const { subsite_id } = req.query;
  const companyId = getCompanyIdFromToken(req);

  if (!companyId || !subsite_id)
    return res.status(400).json({ message: "companyId and subsite_id are required." });

  const tableName = `IntervalControl_${companyId}_${subsite_id}`;
  db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
    if (err) {
      console.error(`❌ DB error fetching interval statuses from ${tableName}:`, err.message);
      return res.status(500).json({ message: "Failed to fetch interval statuses for sub-site." });
    }

    const statusMap = {};
    rows.forEach(row => {
      statusMap[row.sensor_id] = {
        is_fetching: row.is_fetching === 1,
        is_sending: row.is_sending === 1
      };
    });

    res.status(200).json(statusMap);
  });
};

module.exports = { getSubsiteIntervalStatus };