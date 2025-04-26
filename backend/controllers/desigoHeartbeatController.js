const axios = require("axios");
const { db } = require("../db/sensorDB");
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false }); // ✅ ignore SSL

const checkDesigoHeartbeat = async (req, res) => {
  try {
    // Step 1: Get latest Desigo Token
    const tokenRow = await new Promise((resolve, reject) => {
      db.get("SELECT token FROM DesigoAuthTokens ORDER BY id DESC LIMIT 1", (err, row) => {
        if (err) reject(err.message);
        else if (!row) reject("No Desigo token found.");
        else resolve(row);
      });
    });

    const token = tokenRow.token;

    if (!token) {
      console.error("❌ No Desigo token found.");
      return res.status(200).json({ status: "offline" });
    }

    // Step 2: Get any random active sensor API endpoint
    const apiRow = await new Promise((resolve, reject) => {
      db.get(`
        SELECT api_endpoint FROM LocalSensorAPIs
        JOIN LocalActiveSensors ON LocalSensorAPIs.sensor_id = LocalActiveSensors.bank_id
        WHERE LocalActiveSensors.is_active = 1 LIMIT 1
      `, (err, row) => {
        if (err) reject(err.message);
        else if (!row) reject("No active sensor with API found.");
        else resolve(row);
      });
    });

    const testApi = apiRow.api_endpoint;

    if (!testApi) {
      console.error("❌ No active sensor API found.");
      return res.status(200).json({ status: "offline" });
    }

    // Step 3: Make a safe call using Desigo token
    const response = await axios.get(testApi, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      httpsAgent: agent,
      timeout: 5000,
      validateStatus: () => true,
    });

    console.log("🌐 Heartbeat API Status:", response.status);

    if (response.status >= 200 && response.status < 400) {
      res.status(200).json({ status: "online" });
    } else {
      res.status(200).json({ status: "offline" });
    }

  } catch (error) {
    console.error("❌ Heartbeat Error:", error.message || error);
    res.status(200).json({ status: "offline" });
  }
};

module.exports = { checkDesigoHeartbeat };