const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const jwt = require("jsonwebtoken");
const { db, createSensorDataTable } = require("../db/sensorDB"); 


require("dotenv").config();

// ✅ Local Database Path
const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
console.log(`📌 Using database path: ${dbPath}`);

// ✅ Open Local Database


/** ✅ Function to Fetch Latest Token from Local DB */
const getStoredToken = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
            if (err) {
                console.error("❌ Error fetching token:", err.message);
                reject("Error fetching token from database");
            } else if (!row) {
                reject("No stored token found.");
            } else {
                resolve(row.token);
            }
        });
    });
};

const getCompanyIdFromToken = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
            if (err || !row) {
                console.error("❌ Error fetching token:", err?.message || "No token found");
                return reject("Error fetching token from database");
            }

            try {
                const decoded = jwt.verify(row.token, process.env.JWT_SECRET_APP);
                console.log(`🔍 Extracted companyId: ${decoded.companyId}`);
                resolve(decoded.companyId);
            } catch (error) {
                console.error("❌ Error decoding JWT:", error.message);
                reject("Invalid token");
            }
        });
    });
};


/** ✅ Activate Sensor (Connector Sends Request to Cloud + Updates Local DB) */
const activateSensor = async (req, res) => {
    try {
        const { sensorId, interval_seconds, batch_size } = req.body;
        if (!sensorId) {
            return res.status(400).json({ message: "Sensor ID is required" });
        }

        // ✅ Get companyId from JWT
        let companyId;
        try {
            companyId = await getCompanyIdFromToken();
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Failed to fetch company ID" });
        }

        // ✅ Set default values if not provided
        const interval = interval_seconds ?? 10;
        const batch = batch_size ?? 1;

        // ✅ Fetch stored JWT from local DB
        let token;
        try {
            token = await getStoredToken();
            console.log(`🔍 Using Token: ${token}`);
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
        }

        console.log(`📤 Sending Activation Request with Token: ${token}`);

        // ✅ Send activation request to Cloud Backend
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensors/activate`;
        console.log(`📤 Activating Sensor in Cloud: ${cloudApiUrl}`);

        try {
            const cloudResponse = await axios.post(cloudApiUrl, { sensorId, companyId }, { 
                headers: { Authorization: `Bearer ${token}` } 
            });

            console.log("✅ Sensor activated successfully in Cloud:", cloudResponse.data);

            // ✅ Insert or update in Local DB (LocalActiveSensors)
            db.run(
                `INSERT INTO LocalActiveSensors (bank_id, is_active, mode, interval_seconds, batch_size)
                 VALUES (?, 1, 'manual', ?, ?)
                 ON CONFLICT(bank_id) DO UPDATE SET 
                    is_active = 1, 
                    mode = 'manual', 
                    interval_seconds = excluded.interval_seconds,
                    batch_size = excluded.batch_size`,
                [sensorId, interval, batch],
                async (err) => {
                    if (err) {
                        console.error("❌ Error inserting into Local DB:", err.message);
                    } else {
                        console.log(`✅ Sensor ${sensorId} activated in Local DB with Interval ${interval}s and Batch ${batch}.`);

                        // ✅ Create Dynamic Table for Sensor Data (Format: SensorData_CompanyId_SensorId)
                        const sensorTableName = `SensorData_${companyId}_${sensorId}`;
                        console.log(`📌 Creating sensor data table: ${sensorTableName}`);
                        await createSensorDataTable(companyId, sensorId);
                    }
                }
            );

            res.status(200).json({ 
                message: "Sensor activated successfully", 
                cloudResponse: cloudResponse.data,
                settings: { interval_seconds: interval, batch_size: batch }
            });
        } catch (error) {
            console.error("❌ Failed to activate sensor in Cloud:", error.response?.data || error.message);
            res.status(500).json({ message: "Failed to activate sensor in Cloud", error: error.response?.data || error.message });
        }
    } catch (error) {
        console.error("❌ Error activating sensor:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};





/** ✅ Deactivate Sensor (Connector Sends Request to Cloud + Updates Local DB) */
/** ✅ Deactivate Sensor (Connector Sends Request to Cloud + Updates Local DB) */
const deactivateSensor = async (req, res) => {
    try {
        const { sensorId } = req.body;
        if (!sensorId) {
            return res.status(400).json({ message: "Sensor ID is required" });
        }

        // ✅ First check IntervalControl table
        db.get(
            `SELECT is_fetching, is_sending FROM IntervalControl WHERE sensor_id = ?`,
            [sensorId],
            async (err, statusRow) => {
                if (err) {
                    console.error("❌ Error checking IntervalControl:", err.message);
                    return res.status(500).json({ message: "Database error" });
                }

                if (!statusRow) {
                    console.warn("⚠️ No IntervalControl entry found. Proceeding with caution.");
                } else if (statusRow.is_fetching === 1 || statusRow.is_sending === 1) {
                    return res.status(403).json({
                        message: `❌ Sensor is actively fetching or sending. Please stop it first before deactivating.`,
                        is_fetching: statusRow.is_fetching === 1,
                        is_sending: statusRow.is_sending === 1
                    });
                }

                // ✅ Fetch stored JWT from local DB
                let token;
                try {
                    token = await getStoredToken();
                    console.log(`🔍 Using Token: ${token}`);
                } catch (error) {
                    return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
                }

                // ✅ Send deactivation request to Cloud Backend
                const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensors/deactivate`;
                console.log(`📤 Deactivating Sensor in Cloud: ${cloudApiUrl}`);

                try {
                    const cloudResponse = await axios.post(cloudApiUrl, { sensorId }, { headers: { Authorization: `Bearer ${token}` } });
                    console.log("✅ Sensor deactivated successfully in Cloud:", cloudResponse.data);

                    // ✅ Update in Local DB (Set is_active = 0)
                    db.run(
                        `UPDATE LocalActiveSensors SET is_active = 0 WHERE bank_id = ?`,
                        [sensorId],
                        (err) => {
                            if (err) console.error("❌ Error updating Local DB:", err.message);
                            else console.log(`✅ Sensor ${sensorId} deactivated in Local DB.`);
                        }
                    );

                    return res.status(200).json({ message: "Sensor deactivated successfully", cloudResponse: cloudResponse.data });

                } catch (error) {
                    console.error("❌ Failed to deactivate sensor in Cloud:", error.response?.data || error.message);
                    return res.status(500).json({ message: "Failed to deactivate sensor in Cloud", error: error.response?.data || error.message });
                }
            }
        );
    } catch (error) {
        console.error("❌ Error deactivating sensor:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};


/** ✅ Remove Sensor (Connector Sends Request to Cloud + Deletes from Local DB) */
const removeActiveSensor = async (req, res) => {
    try {
        const { sensorId } = req.body;
        if (!sensorId) {
            return res.status(400).json({ message: "Sensor ID is required" });
        }

        // ✅ Get companyId from JWT
        let companyId;
        try {
            companyId = await getCompanyIdFromToken();
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Failed to fetch company ID" });
        }

        // ✅ Fetch stored JWT from local DB
        let token;
        try {
            token = await getStoredToken();
            console.log(`🔍 Using Token: ${token}`);
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
        }

        console.log(`📤 Sending Removal Request with Token: ${token}`);

        // ✅ Send removal request to Cloud Backend
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensors/remove`;
        console.log(`📤 Removing Sensor from Active in Cloud: ${cloudApiUrl}`);

        try {
            const cloudResponse = await axios.post(cloudApiUrl, { sensorId, companyId }, { 
                headers: { Authorization: `Bearer ${token}` } 
            });

            console.log("✅ Sensor removed successfully from Active Sensors in Cloud:", cloudResponse.data);

            // ✅ Delete from Local DB (LocalActiveSensors)
            db.run(
                `DELETE FROM LocalActiveSensors WHERE bank_id = ?`,
                [sensorId],
                (err) => {
                    if (err) {
                        console.error("❌ Error deleting from Local DB:", err.message);
                    } else {
                        console.log(`✅ Sensor ${sensorId} removed from Local DB.`);

                        // ✅ Drop Dynamic Sensor Data Table
                        const sensorTableName = `SensorData_${companyId}_${sensorId}`;
                        console.log(`🗑 Dropping sensor data table: ${sensorTableName}`);
                        db.run(`DROP TABLE IF EXISTS ${sensorTableName}`, (dropErr) => {
                            if (dropErr) {
                                console.error(`❌ Error deleting table ${sensorTableName}:`, dropErr.message);
                            } else {
                                console.log(`✅ Table ${sensorTableName} deleted.`);
                            }
                        });
                    }
                }
            );

            res.status(200).json({ message: "Sensor removed successfully", cloudResponse: cloudResponse.data });
        } catch (error) {
            console.error("❌ Failed to remove sensor in Cloud:", error.response?.data || error.message);
            res.status(500).json({ message: "Failed to remove sensor in Cloud", error: error.response?.data || error.message });
        }
    } catch (error) {
        console.error("❌ Error removing sensor:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};



const getAllActiveSensors = async (req, res) => {
    try {
      // ✅ Fetch stored JWT
      const token = await getStoredToken();
      const companyId = await getCompanyIdFromToken();
  
      // ✅ Get Cloud Data
      const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensors/active`;
      const cloudResponse = await axios.get(cloudApiUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      const cloudSensors = cloudResponse.data?.sensors || [];
  
      // ✅ Fetch local sensor settings (interval, batch)
      const localSensors = await new Promise((resolve, reject) => {
        db.all(`SELECT bank_id, interval_seconds, batch_size FROM LocalActiveSensors WHERE is_active = 1`, [], (err, rows) => {
          if (err) {
            console.error("❌ Error fetching from Local DB:", err.message);
            return reject("Failed to fetch local sensors");
          }
          resolve(rows);
        });
      });
  
      // ✅ Merge local and cloud data by bank_id
      const enrichedSensors = cloudSensors.map(sensor => {
        const local = localSensors.find(l => Number(l.bank_id) === Number(sensor.bank_id));
        return {
          ...sensor,
          interval_seconds: local?.interval_seconds || 10,
          batch_size: local?.batch_size || 1,
        };
      });
  
      res.status(200).json({
        message: "Fetched active sensors with local settings",
        sensors: enrichedSensors,
      });
    } catch (error) {
      console.error("❌ Error in getAllActiveSensors:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  };
  

/** ✅ Reactivate Sensor (Connector Sends Request to Cloud + Updates Local DB) */
const reactivateSensor = async (req, res) => {
    try {
        const { sensorId } = req.body;

        if (!sensorId) {
            return res.status(400).json({ message: "Sensor ID is required" });
        }

        // ✅ Fetch stored JWT from local DB
        let token;
        try {
            token = await getStoredToken();
            console.log(`🔍 Using Token: ${token}`);
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
        }

        // ✅ Get companyId from JWT
        let companyId;
        try {
            companyId = await getCompanyIdFromToken();
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Failed to fetch company ID" });
        }

        // ✅ Send reactivation request to Cloud Backend
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensors/reactivate`;
        console.log(`📤 Re-activating Sensor in Cloud: ${cloudApiUrl}`);

        try {
            const cloudResponse = await axios.post(cloudApiUrl, { sensorId }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            console.log("✅ Sensor reactivated successfully in Cloud:", cloudResponse.data);

            // ✅ Update Local DB (Set is_active = 1)
            db.run(
                `UPDATE LocalActiveSensors SET is_active = 1 WHERE bank_id = ?`,
                [sensorId],
                (err) => {
                    if (err) {
                        console.error("❌ Error updating Local DB:", err.message);
                    } else {
                        console.log(`✅ Sensor ${sensorId} reactivated in Local DB.`);
                    }
                }
            );

            res.status(200).json({ message: "Sensor reactivated successfully", cloudResponse: cloudResponse.data });
        } catch (error) {
            console.error("❌ Failed to reactivate sensor in Cloud:", error.response?.data || error.message);
            res.status(500).json({ message: "Failed to reactivate sensor in Cloud", error: error.response?.data || error.message });
        }
    } catch (error) {
        console.error("❌ Error reactivating sensor:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};


const updateSensorSettings = async (req, res) => {
    try {
      const { sensorId, interval_seconds, batch_size } = req.body;
  
      if (!sensorId || interval_seconds == null || batch_size == null) {
        return res.status(400).json({ message: "Sensor ID, interval_seconds, and batch_size are required" });
      }
  
      db.run(
        `UPDATE LocalActiveSensors 
         SET interval_seconds = ?, 
             batch_size = ?, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE bank_id = ? AND is_active = 0`,
        [interval_seconds, batch_size, sensorId],
        function (err) {
          if (err) {
            console.error("❌ Error updating Local DB:", err.message);
            return res.status(500).json({ message: "Failed to update settings", error: err.message });
          }
  
          if (this.changes === 0) {
            return res.status(400).json({ message: "Sensor must be deactivated to update settings" });
          }
  
          console.log(`✅ Sensor ${sensorId} settings updated locally.`);
          res.status(200).json({ message: `Sensor ${sensorId} settings updated successfully` });
        }
      );
    } catch (error) {
      console.error("❌ Error updating sensor settings:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  };

  





/** ✅ Export Functions */
module.exports = { activateSensor, deactivateSensor, removeActiveSensor,getAllActiveSensors, reactivateSensor, updateSensorSettings  };
