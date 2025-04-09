const axios = require("axios");

const https = require("https");
require("dotenv").config();
const { syncAllSensorTables } = require("../utils/syncAllSensorTables");

const agent = new https.Agent({ rejectUnauthorized: false });

const { db } = require("../db/sensorDB"); // ✅ use your shared instance

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

/** ✅ Add a Sensor (Connector Backend → Cloud Backend + Local DB) */
const addSensor = async (req, res) => {
  try {
    const { sensorApi, sensorName, rateLimit } = req.body;

    console.log("📥 Incoming Add Sensor Request:");
    console.log("🌐 sensorApi:", sensorApi);
    console.log("📛 sensorName:", sensorName);
    console.log("⏱ rateLimit:", rateLimit);

    if (!sensorApi || !sensorName || !rateLimit) {
      return res.status(400).json({ message: "Sensor API, name, and rate limit are required" });
    }

    // ✅ Check for existing API endpoint
    const existingApi = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM LocalSensorAPIs WHERE api_endpoint = ?", [sensorApi], (err, row) => {
        if (err) return reject("DB error while checking existing API");
        resolve(row);
      });
    });

    if (existingApi) {
      console.warn("⚠ Sensor API already exists in LocalSensorAPIs. Skipping insert.");
      return res.status(409).json({ message: "Sensor API already exists in LocalSensorAPIs" });
    }

    // ✅ Get Cloud Token
    const cloudToken = await getStoredToken();
    console.log("🔐 Cloud Token Fetched");

    // ✅ Get Desigo Token
    const desigoToken = await new Promise((resolve, reject) => {
      db.get("SELECT token FROM DesigoAuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
        if (err || !row?.token) reject("Desigo token not found");
        else resolve(row.token);
      });
    });
    console.log("🔐 Desigo Token Fetched");

    // ✅ Fetch Sensor Data from API
    console.log("🌍 Fetching data from sensor API:", sensorApi);
    const response = await axios.get(sensorApi, {
      headers: { Authorization: `Bearer ${desigoToken}` },
      httpsAgent: agent,
    });

    const sensorData = response.data;
    if (!sensorData || !sensorData[0]?.DataType || !sensorData[0]?.ObjectId || !sensorData[0]?.PropertyName) {
      return res.status(400).json({ message: "Invalid sensor API response format" });
    }

    const { DataType, ObjectId, PropertyName } = sensorData[0];
    console.log("✅ Sensor Data Parsed:", { DataType, ObjectId, PropertyName });

    // ✅ Push to Cloud
    const cloudResponse = await axios.post(
      `${process.env.CLOUD_API_URL}/api/sensor-bank/add`,
      {
        sensorName,
        description: "Sensor added via Connector App",
        objectId: ObjectId,
        propertyName: PropertyName,
        dataType: DataType,
        isActive: false,
      },
      { headers: { Authorization: `Bearer ${cloudToken}` } }
    );
    console.log("☁️ Cloud Sensor Added:", cloudResponse.data);

    // ✅ Insert into Local DB
    db.serialize(() => {
      const insertSensorQuery = `
        INSERT INTO LocalSensorBank (name, description, object_id, property_name, data_type, is_active)
        VALUES (?, ?, ?, ?, ?, 0)
      `;
      console.log("📝 Inserting into LocalSensorBank...");
      db.run(
        insertSensorQuery,
        [sensorName, "Sensor added via Connector App", ObjectId, PropertyName, DataType],
        async function (err) {
          if (err) {
            console.error("❌ Error inserting into LocalSensorBank:", err.message);
            return res.status(500).json({ message: "Failed to insert sensor locally" });
          }

          console.log("✅ Sensor temporarily inserted into LocalSensorBank");

          // ✅ Sync IDs and APIs to Cloud
          await syncAllSensorTables();
          console.log("🔁 All tables synced with Cloud.");

          // ✅ Get synced sensor ID
          db.get("SELECT id FROM LocalSensorBank WHERE object_id = ?", [ObjectId], (err, row) => {
            if (err || !row) {
              console.error("❌ Sensor not found after sync:", err?.message || "Missing row");
              return res.status(500).json({ message: "Sensor ID not found after sync" });
            }

            const syncedSensorId = row.id;
            console.log(`📌 Final Synced Sensor ID: ${syncedSensorId}`);

            // ✅ Check again if API exists before insert
            db.get("SELECT * FROM LocalSensorAPIs WHERE api_endpoint = ?", [sensorApi], (err, existingRow) => {
              if (err) {
                console.error("❌ Error checking API before insert:", err.message);
                return res.status(500).json({ message: "DB error while verifying API" });
              }

              if (existingRow) {
                console.warn("⚠ API already exists after sync. Skipping insert.");
                return res.status(200).json({
                  message: "Sensor added successfully (API already existed)",
                  sensorId: syncedSensorId,
                  cloudResponse: cloudResponse.data
                });
              }

              const insertApiQuery = `
                INSERT INTO LocalSensorAPIs (sensor_id, api_endpoint)
                VALUES (?, ?)
              `;

              console.log("🌐 Inserting API Endpoint:", sensorApi);
              db.run(insertApiQuery, [syncedSensorId, sensorApi], (err) => {
                if (err) {
                  console.error("❌ Error inserting into LocalSensorAPIs:", err.message);
                } else {
                  console.log(`✅ Inserted API for sensor ${syncedSensorId}`);
                }

                return res.status(200).json({
                  message: "Sensor added successfully",
                  sensorId: syncedSensorId,
                  cloudResponse: cloudResponse.data
                });
              });
            });
          });
        }
      );
    });

  } catch (error) {
    console.error("❌ Error adding sensor:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.toString() });
  }
};

/** ✅ Delete a Sensor (Connector Requests Cloud to Delete + Remove from Local DB) */
const deleteSensor = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🧩 Sensor ID received in request: ${id}`);

    // ✅ Fetch token
    let token;
    try {
      token = await getStoredToken();
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
    }

    // ✅ Cloud delete
    const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensor-bank/delete/${id}`;
    console.log(`🗑 Deleting Sensor from Cloud: ${cloudApiUrl}`);

    let cloudResponse;
    try {
      cloudResponse = await axios.delete(cloudApiUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("✅ Sensor deleted from Cloud:", cloudResponse.data);
    } catch (error) {
      console.error("❌ Error deleting from Cloud:", error.response?.data || error.message);
      return res.status(500).json({
        message: "Failed to delete sensor from cloud",
        error: error.response?.data || error.message,
      });
    }

    // ✅ Local DB deletion (then sync)
    db.serialize(() => {
      db.run(`DELETE FROM LocalActiveSensors WHERE bank_id = ?`, [id], (err) => {
        if (err) console.error("❌ Error deleting from LocalActiveSensors:", err.message);
        else console.log(`✅ Sensor ${id} deleted from LocalActiveSensors.`);
      });

      db.run(`DELETE FROM LocalSensorAPIs WHERE sensor_id = ?`, [id], (err) => {
        if (err) console.error("❌ Error deleting from LocalSensorAPIs:", err.message);
        else console.log(`✅ Sensor ${id} deleted from LocalSensorAPIs.`);
      });

      db.run(`DELETE FROM LocalSensorBank WHERE id = ?`, [id], async (err) => {
        if (err) {
          console.error("❌ Error deleting from LocalSensorBank:", err.message);
        } else {
          console.log(`✅ Sensor ${id} deleted from LocalSensorBank.`);

          // ✅ Run the full sync after deletions
          await syncAllSensorTables();
        }
      });
    });

    res.status(200).json({
      message: "Sensor deleted successfully",
      cloudResponse: cloudResponse.data,
    });

  } catch (error) {
    console.error("❌ Error deleting sensor:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};




/** ✅ Get All Sensors (Connector Fetches from Cloud Only) */
const getAllSensors = async (req, res) => {
  try {
    // ✅ Fetch stored JWT from local DB
    let token;
    try {
      token = await getStoredToken();
      console.log(`🔍 Using Token: ${token}`);
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
    }

    const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/sensor-bank/all`;
    console.log(`📤 Fetching Sensors from Cloud: ${cloudApiUrl}`);

    try {
      const cloudResponse = await axios.get(cloudApiUrl, { headers: { Authorization: `Bearer ${token}` } });
      console.log("✅ Sensors received from Cloud:", cloudResponse.data);
      res.status(200).json({ sensors: cloudResponse.data });
    } catch (error) {
      console.error("❌ Error fetching sensors from cloud:", error.response?.data || error.message);
      res.status(500).json({ message: "Failed to fetch sensors from cloud", error: error.response?.data || error.message });
    }
  } catch (error) {
    console.error("❌ Error fetching sensors:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getStoredDesigoToken = async (req, res) => {
  try {
    // Query the latest Desigo Token from the database
    db.get("SELECT token FROM DesigoAuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
      if (err || !row) {
        console.error("❌ Error fetching Desigo token:", err?.message || "No token found");
        return res.status(401).json({ message: "Unauthorized: No Desigo Token Found" });
      }
      res.status(200).json({ desigoToken: row.token });
    });
  } catch (error) {
    console.error("❌ Error retrieving Desigo token:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


/** ✅ Get All Sensors from Local DB with API */
const getAllLocalSensorsWithAPI = async (req, res) => {
  try {
    const query = `
        SELECT 
          b.id, b.name, b.description, b.object_id, b.property_name, 
          b.data_type, b.is_active, b.created_at, b.updated_at,
          a.api_endpoint
        FROM LocalSensorBank b
        LEFT JOIN LocalSensorAPIs a ON a.sensor_id = b.id
      `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error("❌ Error fetching local sensors with API:", err.message);
        return res.status(500).json({ message: "Failed to fetch sensors", error: err.message });
      }

      return res.status(200).json({ sensors: rows });
    });
  } catch (error) {
    console.error("❌ Internal error in getAllLocalSensorsWithAPI:", error.message);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


const getAllLocalAPIEndpoints = (req, res) => {
  const query = "SELECT api_endpoint FROM LocalSensorAPIs";

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ Error fetching API endpoints:", err.message);
      return res.status(500).json({ message: "Failed to fetch API endpoints", error: err.message });
    }

    // Flatten array of objects → return just the list of strings
    const endpoints = rows.map(row => row.api_endpoint);
    return res.status(200).json({ api_endpoints: endpoints });
  });
};

module.exports = { addSensor, getAllSensors, deleteSensor, getStoredDesigoToken, getAllLocalSensorsWithAPI, getAllLocalAPIEndpoints};
