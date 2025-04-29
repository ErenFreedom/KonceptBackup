const axios = require("axios");
const os = require("os");
const { db } = require("../db/sensorDB");
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/** ✅ Internal logic to check heartbeat without needing req/res */
const checkDesigoHeartbeat_Internal = async () => {
  try {
    const desigoTokenRow = await new Promise((resolve, reject) => {
      db.get("SELECT token FROM DesigoAuthTokens ORDER BY id DESC LIMIT 1", (err, row) => {
        if (err || !row) reject("No Desigo token found.");
        else resolve(row);
      });
    });

    const token = desigoTokenRow.token;
    const currentUsername = os.userInfo().username;
    console.log(`🧑 Logged-in Windows User: ${currentUsername}`);

    const realServerHeartbeat = `https://${currentUsername}:443/WSI/api/Heartbeat`;
    const dummyServerHeartbeat = `http://localhost:8085/WSI/api/Heartbeat`;

    let realServerAlive = false;
    let dummyServerAlive = false;

    try {
      const realRes = await axios.post(realServerHeartbeat, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
        validateStatus: () => true,
        httpsAgent,
      });

      if (realRes.status >= 200 && realRes.status < 400) {
        realServerAlive = true;
        console.log("✅ Real Desigo Server is ONLINE");
      } else {
        console.warn("⚠️ Real server heartbeat gave bad status:", realRes.status);
      }
    } catch (err) {
      console.warn("⚠️ Real server connection error:", err.message);
    }

    if (!realServerAlive) {
      try {
        const dummyRes = await axios.post(dummyServerHeartbeat, {}, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 3000,
          validateStatus: () => true,
          httpsAgent,
        });

        if (dummyRes.status >= 200 && dummyRes.status < 400) {
          dummyServerAlive = true;
          console.log("✅ Dummy Desigo Server is ONLINE");
        } else {
          console.warn("⚠️ Dummy server heartbeat gave bad status:", dummyRes.status);
        }
      } catch (err) {
        console.warn("⚠️ Dummy server connection error:", err.message);
      }
    }

    if (realServerAlive || dummyServerAlive) {
      return "online"; // ✅ Only if both fail, it's offline
    } else {
      console.error("❌ Both servers offline.");
      return "offline";
    }

  } catch (error) {
    console.error("❌ Heartbeat critical error:", error.message || error);
    return "offline";
  }
};

/** ✅ Express route handler (frontend call) */
const checkDesigoHeartbeat = async (req, res) => {
  const status = await checkDesigoHeartbeat_Internal();
  return res.status(200).json({ status });
};

module.exports = { checkDesigoHeartbeat, checkDesigoHeartbeat_Internal };