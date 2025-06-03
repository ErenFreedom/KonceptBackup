const axios = require("axios");
const https = require("https");
const jwt = require("jsonwebtoken");
const { db } = require("../db/sensorDB");
require("dotenv").config();

const agent = new https.Agent({ rejectUnauthorized: false });

/** 🔐 Get stored connector app token */
const getStoredToken = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", (err, row) => {
      if (err || !row) reject("No valid AuthToken");
      else resolve(row.token);
    });
  });
};

/** 🔐 Get Desigo token */
const getDesigoToken = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT token FROM DesigoAuthTokens ORDER BY id DESC LIMIT 1", (err, row) => {
      if (err || !row) reject("Desigo token not found");
      else resolve(row.token);
    });
  });
};

const addSubSiteSensor = async (req, res) => {
  try {
    const { subsiteId, sensorApi, sensorName, rateLimit } = req.body;

    if (!subsiteId || !sensorApi || !sensorName || !rateLimit) {
      return res.status(400).json({
        message: "subsiteId, sensorApi, sensorName, and rateLimit are required",
      });
    }

    const connectorToken = await getStoredToken();
    const desigoToken = await getDesigoToken();
    const decoded = jwt.decode(connectorToken);
    const companyId = decoded.companyId || decoded.company_id;

    const sensorTable = `Sensor_${companyId}_${subsiteId}`;
    const bankTable = `SensorBank_${companyId}_${subsiteId}`;
    const apiTable = `SensorAPI_${companyId}_${subsiteId}`;

    // 🔍 Check for duplicate sensor API across all SensorAPI_* tables
    const checkDuplicateApi = async () => {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'SensorAPI_%'`,
          [],
          (err, tables) => {
            if (err) return reject("Error querying table list");
            if (tables.length === 0) return resolve(false);

            let found = false;
            let remaining = tables.length;

            tables.forEach(({ name }) => {
              db.get(`SELECT * FROM ${name} WHERE api_endpoint = ?`, [sensorApi], (err, row) => {
                if (row) found = true;
                if (--remaining === 0) resolve(found);
              });
            });
          }
        );
      });
    };

    const existsAnywhere = await checkDuplicateApi();
    if (existsAnywhere) {
      return res.status(409).json({ message: "Sensor API already exists across some site" });
    }

    // ✅ Fetch sensor data from Desigo API using internal token
    const response = await axios.get(sensorApi, {
      headers: { Authorization: `Bearer ${desigoToken}` },
      httpsAgent: agent,
    });

    const sensorData = response.data?.[0];
    if (!sensorData?.DataType || !sensorData?.ObjectId || !sensorData?.PropertyName) {
      return res.status(400).json({ message: "Invalid Desigo API response format" });
    }

    const { DataType, ObjectId, PropertyName } = sensorData;

    // ✅ Add to Cloud
    const cloudResponse = await axios.post(
      `${process.env.CLOUD_API_URL}/api/subsite/sensor/add`,
      {
        subsiteId,
        sensorName,
        description: "Subsite sensor added",
        objectId: ObjectId,
        propertyName: PropertyName,
        dataType: DataType,
        isActive: false,
        apiEndpoint: sensorApi,
      },
      {
        headers: { Authorization: `Bearer ${connectorToken}` },
      }
    );

    // ✅ Insert into local DB
    db.serialize(() => {
      db.run(
        `INSERT INTO ${bankTable} (name, description, object_id, property_name, data_type, is_active, subsite_id)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [sensorName, "Subsite sensor added", ObjectId, PropertyName, DataType, subsiteId],
        function (err) {
          if (err) {
            console.error("❌ Insert into SensorBank failed:", err.message);
            return res.status(500).json({ message: "Sensor insert failed" });
          }

          const bankId = this.lastID;

          db.run(`INSERT INTO ${sensorTable} (bank_id, is_active) VALUES (?, 0)`, [bankId], function (err) {
            if (err) {
              console.error("❌ Insert into Sensor table failed:", err.message);
              return res.status(500).json({ message: "Sensor insert failed" });
            }

            const sensorId = this.lastID;

            db.run(
              `INSERT INTO ${apiTable} (sensor_id, api_endpoint, created_at)
               VALUES (?, ?, datetime('now'))`,
              [sensorId, sensorApi],
              (err) => {
                if (err) {
                  console.error("❌ Insert into SensorAPI failed:", err.message);
                  return res.status(500).json({ message: "API insert failed" });
                }

                return res.status(200).json({
                  message: "Sensor added successfully",
                  sensorId,
                  cloudResponse: cloudResponse.data,
                });
              }
            );
          });
        }
      );
    });
  } catch (err) {
    console.error("❌ addSubSiteSensor error:", err.message);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

const deleteSubSiteSensor = async (req, res) => {
  try {
    const { id } = req.params; // bank_id
    const { subsiteId } = req.body;

    if (!subsiteId || !id) {
      return res.status(400).json({ message: "Sensor ID and Sub-site ID are required" });
    }

    const token = await getStoredToken();
    const decoded = jwt.decode(token);
    const companyId = decoded.companyId || decoded.company_id;

    const bankTable = `SensorBank_${companyId}_${subsiteId}`;
    const sensorTable = `Sensor_${companyId}_${subsiteId}`;
    const apiTable = `SensorAPI_${companyId}_${subsiteId}`;

    // Step 1️⃣: Check if sensor is still active
    const isActive = await new Promise((resolve, reject) => {
      db.get(
        `SELECT is_active FROM ${sensorTable} WHERE bank_id = ?`,
        [id],
        (err, row) => {
          if (err) {
            console.error("❌ Error checking active state:", err.message);
            reject("Error checking active state");
          } else {
            resolve(row?.is_active === 1);
          }
        }
      );
    });

    if (isActive) {
      return res.status(403).json({ message: "Cannot delete active sensor. Please stop it first." });
    }

    // Step 2️⃣: Delete from Cloud
    const deleteUrl = `${process.env.CLOUD_API_URL}/api/subsite/sensor/delete/${id}`;
    try {
      await axios.delete(deleteUrl, {
        headers: { Authorization: `Bearer ${token}` },
        data: { subsiteId }, // ✅ Send subsiteId in DELETE body
      });
      console.log("✅ Sensor deleted from cloud");
    } catch (err) {
      console.error("❌ Cloud deletion failed:", err.response?.data || err.message);
      return res.status(500).json({
        message: "Cloud deletion failed",
        error: err.response?.data || err.message,
      });
    }

    // Step 3️⃣: Local DB cleanup
    db.serialize(() => {
      db.run(`DELETE FROM ${sensorTable} WHERE bank_id = ?`, [id], (err) => {
        if (err) console.error("❌ Sensor table delete error:", err.message);
        else console.log(`✅ Sensor entry (id: ${id}) deleted from ${sensorTable}`);
      });

      db.run(`DELETE FROM ${apiTable} WHERE sensor_id = ?`, [id], (err) => {
        if (err) console.error("❌ API table delete error:", err.message);
        else console.log(`✅ Sensor API entry for sensor ${id} deleted`);
      });

      db.run(`DELETE FROM ${bankTable} WHERE id = ?`, [id], (err) => {
        if (err) console.error("❌ Bank table delete error:", err.message);
        else console.log(`✅ SensorBank entry for sensor ${id} deleted`);
      });
    });

    return res.status(200).json({ message: "Sensor deleted from cloud and local DB" });

  } catch (error) {
    console.error("❌ deleteSubSiteSensor Error:", error.message);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/** 🔍 GET all sensors for sub-site */
const getAllSubSiteSensors = async (req, res) => {
  try {
    const { subsiteId } = req.query;

    if (!subsiteId) return res.status(400).json({ message: "subsiteId is required" });

    const connectorToken = await getStoredToken();
    const decoded = jwt.decode(connectorToken);
    const companyId = decoded.companyId || decoded.company_id;

    const bankTable = `SensorBank_${companyId}_${subsiteId}`;
    const apiTable = `SensorAPI_${companyId}_${subsiteId}`;

    const query = `
      SELECT b.id, b.name, b.description, b.object_id, b.property_name, 
             b.data_type, b.is_active, b.created_at, b.updated_at, a.api_endpoint
      FROM ${bankTable} b
      LEFT JOIN ${apiTable} a ON a.sensor_id = b.id
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error("❌ Error fetching sensors:", err.message);
        return res.status(500).json({ message: "Query failed", error: err.message });
      }

      return res.status(200).json({ sensors: rows });
    });
  } catch (err) {
    console.error("❌ getAllSubSiteSensors error:", err.message);
    res.status(500).json({ message: "Failed to fetch sensors", error: err.message });
  }
};

module.exports = {
  addSubSiteSensor,
  deleteSubSiteSensor,
  getAllSubSiteSensors
};