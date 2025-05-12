const axios = require("axios");

const https = require("https");
require("dotenv").config();
const { updateLocalSensorIds } = require("../utils/syncLocalSensorIds");

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

const addSensor = async (req, res) => {
  try {
    const { sensorApi, sensorName, rateLimit } = req.body;

    console.log("📥 Incoming Add Sensor Request:", { sensorApi, sensorName, rateLimit });

    if (!sensorApi || !sensorName || !rateLimit) {
      return res.status(400).json({ message: "Sensor API, name, and rate limit are required" });
    }

    const existingApi = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM LocalSensorAPIs WHERE api_endpoint = ?", [sensorApi], (err, row) => {
        if (err) reject("DB error while checking existing API");
        else resolve(row);
      });
    });

    if (existingApi) {
      return res.status(409).json({ message: "Sensor API already exists in LocalSensorAPIs" });
    }

    const cloudToken = await getStoredToken();

    const desigoToken = await new Promise((resolve, reject) => {
      db.get("SELECT token FROM DesigoAuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
        if (err || !row?.token) reject("Desigo token not found");
        else resolve(row.token);
      });
    });

    const response = await axios.get(sensorApi, {
      headers: { Authorization: `Bearer ${desigoToken}` },
      httpsAgent: agent,
    });

    const sensorData = response.data;
    if (!sensorData || !sensorData[0]?.DataType || !sensorData[0]?.ObjectId || !sensorData[0]?.PropertyName) {
      return res.status(400).json({ message: "Invalid sensor API response format" });
    }

    const { DataType, ObjectId, PropertyName } = sensorData[0];

    // ✅ Send sensor + API to Cloud
    const cloudResponse = await axios.post(
      `${process.env.CLOUD_API_URL}/api/sensor-bank/add`,
      {
        sensorName,
        description: "Sensor added via Connector App",
        objectId: ObjectId,
        propertyName: PropertyName,
        dataType: DataType,
        isActive: false,
        apiEndpoint: sensorApi // ✅ INCLUDED HERE
      },
      {
        headers: { Authorization: `Bearer ${cloudToken}` }
      }
    );

    console.log("☁️ Cloud Sensor Added:", cloudResponse.data);

    db.serialize(() => {
      const insertSensorQuery = `
        INSERT INTO LocalSensorBank (name, description, object_id, property_name, data_type, is_active)
        VALUES (?, ?, ?, ?, ?, 0)
      `;

      db.run(
        insertSensorQuery,
        [sensorName, "Sensor added via Connector App", ObjectId, PropertyName, DataType],
        async function (err) {
          if (err) {
            console.error("❌ Error inserting into LocalSensorBank:", err.message);
            return res.status(500).json({ message: "Failed to insert sensor locally" });
          }

          await updateLocalSensorIds();

          db.get("SELECT id FROM LocalSensorBank WHERE object_id = ?", [ObjectId], (err, row) => {
            if (err || !row) {
              return res.status(500).json({ message: "Sensor ID not found after sync" });
            }

            const syncedSensorId = row.id;

            db.get("SELECT * FROM LocalSensorAPIs WHERE api_endpoint = ?", [sensorApi], (err, existingRow) => {
              if (err) {
                return res.status(500).json({ message: "DB error while verifying API" });
              }

              if (existingRow) {
                return res.status(200).json({
                  message: "Sensor added (API already existed)",
                  sensorId: syncedSensorId,
                  cloudResponse: cloudResponse.data
                });
              }

              const insertApiQuery = `
                INSERT INTO LocalSensorAPIs (sensor_id, api_endpoint)
                VALUES (?, ?)
              `;

              db.run(insertApiQuery, [syncedSensorId, sensorApi], (err) => {
                if (err) {
                  console.error("❌ Error inserting into LocalSensorAPIs:", err.message);
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
    console.log(`🧩 Sensor ID to delete: ${id}`);

    // ✅ Get stored cloud token
    let token;
    try {
      token = await getStoredToken();
    } catch (err) {
      return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
    }

    // ✅ Call Cloud Backend to Delete Sensor from SensorBank + SensorAPI
    const deleteSensorUrl = `${process.env.CLOUD_API_URL}/api/sensor-bank/delete/${id}`;
    console.log(`🗑 Deleting from Cloud SensorBank (and SensorAPI): ${deleteSensorUrl}`);

    try {
      await axios.delete(deleteSensorUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`✅ Cloud SensorBank + API entry for ID ${id} deleted`);
    } catch (error) {
      console.error("❌ Failed to delete sensor from Cloud:", error.response?.data || error.message);
      return res.status(500).json({
        message: "Cloud deletion failed",
        error: error.response?.data || error.message
      });
    }

    // ✅ Local DB Cleanup
    db.serialize(() => {
      db.run(`DELETE FROM LocalActiveSensors WHERE bank_id = ?`, [id], (err) => {
        if (err) console.error("❌ LocalActiveSensors delete error:", err.message);
        else console.log(`✅ LocalActiveSensors entry for sensor ${id} deleted`);
      });

      db.run(`DELETE FROM LocalSensorAPIs WHERE sensor_id = ?`, [id], (err) => {
        if (err) console.error("❌ LocalSensorAPIs delete error:", err.message);
        else console.log(`✅ LocalSensorAPIs entry for sensor ${id} deleted`);
      });

      db.run(`DELETE FROM LocalSensorBank WHERE id = ?`, [id], (err) => {
        if (err) console.error("❌ LocalSensorBank delete error:", err.message);
        else console.log(`✅ LocalSensorBank entry for sensor ${id} deleted`);
      });
    });

    res.status(200).json({ message: "Sensor deleted from cloud and local DB" });

  } catch (error) {
    console.error("❌ Unexpected error in deleteSensor:", error.message);
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
  const query = "SELECT sensor_id, api_endpoint FROM LocalSensorAPIs";

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ Error fetching API endpoints:", err.message);
      return res.status(500).json({ message: "Failed to fetch API endpoints", error: err.message });
    }

    // Return structured array of objects
    return res.status(200).json({ api_endpoints: rows });
  });
};

module.exports = { addSensor, getAllSensors, deleteSensor, getStoredDesigoToken, getAllLocalSensorsWithAPI, getAllLocalAPIEndpoints};
