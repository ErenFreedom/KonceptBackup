const axios = require("axios");
const jwt = require("jsonwebtoken");
const { db, createSensorDataTable } = require("../db/sensorDB");
require("dotenv").config();

const getStoredToken = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
      if (err || !row) return reject("No token found");
      resolve(row.token);
    });
  });
};

const getAdminDetailsFromToken = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET_APP);

    const companyId = decoded.companyId;
    const adminId = decoded.adminId;
    const subSites = decoded.subSites;

    if (!companyId) return null;

    return { companyId, adminId, subSites };
  } catch (err) {
    console.error("❌ Token decoding failed:", err.message);
    return null;
  }
};

const activateSubSiteSensor = async (req, res) => {
  try {
    const { sensorId, subsiteId, interval_seconds, batch_size } = req.body;

    if (!sensorId || !subsiteId) {
      return res.status(400).json({ message: "Sensor ID and Subsite ID required" });
    }

    const adminDetails = getAdminDetailsFromToken(req);
    if (!adminDetails) return res.status(401).json({ message: "Unauthorized" });

    const { companyId } = adminDetails;
    const token = await getStoredToken();
    const interval = interval_seconds ?? 10;
    const batch = batch_size ?? 5;

    const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/subsite/sensor/activation/activate`;

    await axios.post(
      cloudApiUrl,
      { sensorId, subsiteId, companyId },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const activeTable = `Sensor_${companyId}_${subsiteId}`;
    const sensorTableName = `SensorData_${companyId}_${subsiteId}_${sensorId}`;

    db.run(
      `INSERT INTO ${activeTable} 
        (id, bank_id, mode, interval_seconds, batch_size, is_active, created_at, updated_at)
       VALUES (?, ?, 'manual', ?, ?, 1, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET 
         is_active = 1,
         interval_seconds = excluded.interval_seconds,
         batch_size = excluded.batch_size`,
      [sensorId, sensorId, interval, batch],
      (err) => {
        if (err) {
          console.error("❌ DB Insert failed:", err.message);
          return res.status(500).json({ message: "Local DB insert failed" });
        }

        db.run(
          `CREATE TABLE IF NOT EXISTS ${sensorTableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id INTEGER,
            value TEXT,
            quality TEXT,
            quality_good BOOLEAN,
            timestamp TEXT NOT NULL,
            FOREIGN KEY(sensor_id) REFERENCES SensorBank_${companyId}_${subsiteId}(id)
          )`,
          (err) => {
            if (err) {
              console.error(`❌ Failed to create SensorData table ${sensorTableName}:`, err.message);
              return res.status(500).json({ message: "Table creation failed" });
            }

            res.status(200).json({ message: "Sensor activated successfully" });
          }
        );
      }
    );
  } catch (err) {
    console.error("❌ Error activating sub-site sensor:", err.message);
    res.status(500).json({ message: "Activation failed", error: err.message });
  }
};


const deactivateSubSiteSensor = async (req, res) => {
  try {
    const { sensorId, subsiteId } = req.body;

    if (!sensorId || !subsiteId) {
      return res.status(400).json({ message: "Sensor ID and Subsite ID required" });
    }

    // ✅ Extract admin info for local DB use
    const adminDetails = getAdminDetailsFromToken(req);
    if (!adminDetails) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const { companyId } = adminDetails;
    const frontendToken = req.headers.authorization;

    const controlTable = `IntervalControl_${companyId}_${subsiteId}`;
    const sensorTable = `Sensor_${companyId}_${subsiteId}`;

    // ✅ Step 1: Safety check — ensure sensor is not actively fetching/sending
    db.get(
      `SELECT id FROM ${sensorTable} WHERE bank_id = ?`,
      [sensorId],
      (err, sensorRow) => {
        if (err || !sensorRow) {
          console.error("❌ Sensor lookup failed:", err?.message);
          return res.status(404).json({ message: "Sensor not found in local DB" });
        }

        const localId = sensorRow.id;

        db.get(
          `SELECT is_fetching, is_sending FROM ${controlTable} WHERE sensor_id = ?`,
          [localId],
          async (err, statusRow) => {
            if (err) {
              console.error("❌ IntervalControl check failed:", err.message);
              return res.status(500).json({ message: "Database error while checking IntervalControl" });
            }

            if (!statusRow) {
              console.warn("⚠️ No IntervalControl entry found. Proceeding with caution.");
            } else if (statusRow.is_fetching === 1 || statusRow.is_sending === 1) {
              return res.status(403).json({
                message: `❌ Sensor is actively fetching or sending. Please stop it first before deactivating.`,
                is_fetching: statusRow.is_fetching === 1,
                is_sending: statusRow.is_sending === 1,
              });
            }

            // ✅ Step 2: Call cloud backend to deactivate
            const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/subsite/sensor/activation/deactivate`;
            try {
              await axios.post(
                cloudApiUrl,
                { sensorId, subsiteId },
                { headers: { Authorization: frontendToken } }
              );

              // ✅ Step 3: Update local DB
              db.run(
                `UPDATE ${sensorTable} SET is_active = 0 WHERE bank_id = ?`,
                [sensorId],
                (err) => {
                  if (err) {
                    console.error("❌ DB update failed:", err.message);
                    return res.status(500).json({ message: "Local deactivation failed" });
                  }

                  console.log(`✅ Sensor ${sensorId} deactivated in sub-site ${subsiteId}`);
                  return res.status(200).json({ message: "Sensor deactivated successfully" });
                }
              );
            } catch (error) {
              console.error("❌ Cloud deactivation failed:", error.response?.data || error.message);
              return res.status(500).json({
                message: "Failed to deactivate sensor in Cloud",
                error: error.response?.data || error.message,
              });
            }
          }
        );
      }
    );
  } catch (err) {
    console.error("❌ Error deactivating subsite sensor:", err.message);
    res.status(500).json({ message: "Deactivation failed", error: err.message });
  }
};


const removeSubSiteSensor = async (req, res) => {
  try {
    const { sensorId, subsiteId } = req.body;
    if (!sensorId || !subsiteId) {
      return res.status(400).json({ message: "Sensor ID and Subsite ID required" });
    }

    const adminDetails = getAdminDetailsFromToken(req);
    if (!adminDetails) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const { companyId } = adminDetails;
    const frontendToken = req.headers.authorization;

    const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/subsite/sensor/activation/remove`;

    await axios.post(cloudApiUrl, { sensorId, subsiteId }, {
      headers: { Authorization: frontendToken },
    });

    const activeTable = `Sensor_${companyId}_${subsiteId}`;
    const sensorTableName = `SensorData_${companyId}_${subsiteId}_${sensorId}`;

    db.run(
      `DELETE FROM ${activeTable} WHERE bank_id = ?`,
      [sensorId],
      (err) => {
        if (err) {
          console.error(`❌ Failed to delete from ${activeTable}:`, err.message);
          return res.status(500).json({ message: "Deletion failed" });
        }

        db.run(`DROP TABLE IF EXISTS ${sensorTableName}`, (dropErr) => {
          if (dropErr) {
            console.error(`❌ Failed to drop table ${sensorTableName}:`, dropErr.message);
            return res.status(500).json({ message: "Drop table failed" });
          }

          console.log(`✅ Sensor ${sensorId} removed and table dropped.`);
          return res.status(200).json({ message: "Sensor removed and table dropped" });
        });
      }
    );
  } catch (err) {
    console.error("❌ Error removing subsite sensor:", err.message);
    res.status(500).json({ message: "Removal failed", error: err.message });
  }
};


const getAllActiveSubSiteSensors = async (req, res) => {
  try {
    const subsiteId =
      req.query.subsiteId || req.query.subsite_id || req.query.subSiteId;

    if (!subsiteId) {
      return res.status(400).json({ message: "Sub-site ID is required" });
    }

    const adminDetails = getAdminDetailsFromToken(req);
    if (!adminDetails) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const { companyId } = adminDetails;
    const frontendToken = req.headers.authorization;

    // ✅ Step 1: Cloud API fetch
    const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/subsite/sensor/activation/active?subsite_id=${subsiteId}`;
    const cloudResponse = await axios.get(cloudApiUrl, {
      headers: { Authorization: frontendToken },
    });

    const cloudSensors = cloudResponse.data?.sensors || [];

    const sensorTable = `Sensor_${companyId}_${subsiteId}`;
    const apiTable = `SensorAPI_${companyId}_${subsiteId}`;

    // ✅ Step 2: Fetch local settings using correct join (bank_id = sensor_id)
    const localSensors = await new Promise((resolve, reject) => {
      db.all(
        `SELECT s.bank_id, s.interval_seconds, s.batch_size, a.api_endpoint
         FROM ${sensorTable} s
         LEFT JOIN ${apiTable} a ON s.bank_id = a.sensor_id
         WHERE s.is_active = 1`,
        [],
        (err, rows) => {
          if (err) {
            console.error("❌ Local DB error:", err.message);
            return reject("Failed to fetch local sub-site sensors");
          }
          resolve(rows);
        }
      );
    });

    // ✅ Step 3: Merge local with cloud
    const enrichedSensors = cloudSensors.map(sensor => {
      const local = localSensors.find(l => Number(l.bank_id) === Number(sensor.bank_id));
      return {
        ...sensor,
        interval_seconds: local?.interval_seconds || 10,
        batch_size: local?.batch_size || 1,
        api_endpoint: local?.api_endpoint || "N/A",
      };
    });

    res.status(200).json({
      message: "Fetched sub-site active sensors with local settings and API endpoint",
      sensors: enrichedSensors,
    });

  } catch (error) {
    console.error("❌ Error in getAllActiveSubSiteSensors:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


const reactivateSubSiteSensor = async (req, res) => {
  try {
    const { sensorId, subsiteId } = req.body;
    if (!sensorId || !subsiteId) {
      return res.status(400).json({ message: "Sensor ID and sub-site ID are required" });
    }

    const adminDetails = getAdminDetailsFromToken(req);
    if (!adminDetails) return res.status(401).json({ message: "Unauthorized" });

    const { companyId } = adminDetails;
    const frontendToken = req.headers.authorization;

    const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/subsite/sensor/activation/reactivate`;
    const cloudResponse = await axios.post(
      cloudApiUrl,
      { sensorId, subsiteId },
      { headers: { Authorization: frontendToken } }
    );

    console.log("✅ Sub-site sensor reactivated in Cloud:", cloudResponse.data);

    const localTable = `Sensor_${companyId}_${subsiteId}`;
    db.run(
      `UPDATE ${localTable} SET is_active = 1 WHERE bank_id = ?`,
      [sensorId],
      (err) => {
        if (err) {
          console.error("❌ Error updating local sub-site DB:", err.message);
        } else {
          console.log(`✅ Sub-site Sensor ${sensorId} reactivated locally.`);
        }
      }
    );

    res.status(200).json({ message: "Sensor reactivated successfully", cloudResponse: cloudResponse.data });
  } catch (error) {
    console.error("❌ Failed to reactivate sub-site sensor:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to reactivate sensor", error: error.message });
  }
};


const updateSubSiteSensorSettings = async (req, res) => {
  try {
    const { sensorId, subsiteId, interval_seconds, batch_size } = req.body;

    if (!sensorId || !subsiteId || interval_seconds == null || batch_size == null) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const adminDetails = getAdminDetailsFromToken(req);
    if (!adminDetails) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const { companyId } = adminDetails;
    const tableName = `Sensor_${companyId}_${subsiteId}`;

    db.run(
      `UPDATE ${tableName}
       SET interval_seconds = ?, 
           batch_size = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE bank_id = ? AND is_active = 0`,
      [interval_seconds, batch_size, sensorId],
      function (err) {
        if (err) {
          console.error("❌ Error updating sensor settings:", err.message);
          return res.status(500).json({ message: "Update failed", error: err.message });
        }

        if (this.changes === 0) {
          return res.status(400).json({ message: "Sensor must be deactivated to update settings" });
        }

        console.log(`✅ Sensor ${sensorId} settings updated`);
        res.status(200).json({ message: `Sensor ${sensorId} settings updated successfully` });
      }
    );
  } catch (err) {
    console.error("❌ Error updating sub-site sensor settings:", err.message);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

module.exports = { activateSubSiteSensor, deactivateSubSiteSensor, removeSubSiteSensor, getAllActiveSubSiteSensors, reactivateSubSiteSensor, updateSubSiteSensorSettings };