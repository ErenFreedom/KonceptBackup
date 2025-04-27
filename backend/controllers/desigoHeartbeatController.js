const axios = require("axios");
const os = require("os"); // ✅ to detect username
const { db } = require("../db/sensorDB");
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false }); // accept self-signed certs

/**
 * Professional Desigo Heartbeat Controller (Dual Check: Real + Dummy)
 */
const checkDesigoHeartbeat = async (req, res) => {
  try {
    // 1. Fetch Desigo token from local DB
    const desigoTokenRow = await new Promise((resolve, reject) => {
      db.get("SELECT token FROM DesigoAuthTokens ORDER BY id DESC LIMIT 1", (err, row) => {
        if (err || !row) reject("No Desigo token found.");
        else resolve(row);
      });
    });

    const token = desigoTokenRow.token;

    // 2. Get current Windows logged-in username
    const currentUsername = os.userInfo().username;
    console.log(`🧑 Logged-in Windows User: ${currentUsername}`);

    // 3. Construct both heartbeat URLs
    const realServerHeartbeat = `https://${currentUsername}:443/WSI/api/Heartbeat`;
    const dummyServerHeartbeat = `http://localhost:8085/WSI/api/Heartbeat`;

    // 4. Try Real Server Heartbeat First
    try {
      const realRes = await axios.post(realServerHeartbeat, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
        validateStatus: () => true,
        httpsAgent,
      });

      if (realRes.status >= 200 && realRes.status < 400) {
        console.log("✅ Real Desigo Server is ONLINE");
        return res.status(200).json({ status: "online" });
      } else {
        console.warn("⚠️ Real Desigo heartbeat failed, trying dummy server...");
      }
    } catch (err) {
      console.warn("⚠️ Real server connection failed:", err.message);
    }

    // 5. If real server fails, try Dummy Server Heartbeat
    try {
      const dummyRes = await axios.post(dummyServerHeartbeat, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000,
        validateStatus: () => true,
        httpsAgent,
      });

      if (dummyRes.status >= 200 && dummyRes.status < 400) {
        console.log("✅ Dummy Desigo Server is ONLINE");
        return res.status(200).json({ status: "online" });
      } else {
        console.warn("⚠️ Dummy Desigo heartbeat failed too...");
      }
    } catch (err) {
      console.warn("⚠️ Dummy server connection failed:", err.message);
    }

    // 6. Both failed
    console.error("❌ Both servers offline.");
    return res.status(200).json({ status: "offline" });

  } catch (error) {
    console.error("❌ Heartbeat check critical error:", error.message || error);
    return res.status(200).json({ status: "offline" });
  }
};

module.exports = { checkDesigoHeartbeat };