const axios = require("axios");
const os = require("os");
const { db } = require("../db/sensorDB");
const https = require("https");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/** ✅ Internal logic: trust any 200 as online */
const checkDesigoHeartbeat_Internal = async () => {
  try {
    const desigoTokenRow = await new Promise((resolve, reject) => {
      db.get(
        "SELECT token FROM DesigoAuthTokens ORDER BY id DESC LIMIT 1",
        (err, row) => {
          if (err || !row) reject("No Desigo token found.");
          else resolve(row);
        }
      );
    });

    const token = desigoTokenRow.token;
    const currentUsername = os.userInfo().username;
    console.log(`🧑 Logged-in Windows User: ${currentUsername}`);

    const heartbeatUrl = `https://${currentUsername}:443/WSI/api/Heartbeat`;

    try {
      const res = await axios.post(
        heartbeatUrl,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000,
          validateStatus: () => true,
          httpsAgent,
        }
      );

      console.log("🔁 Heartbeat Status Code:", res.status);

      if (res.status >= 200 && res.status < 300) {
        console.log("✅ Desigo Server is ONLINE");
        return "online";
      } else {
        console.warn("⚠️ Desigo responded with non-200:", res.status);
        return "offline";
      }
    } catch (err) {
      console.error("❌ Connection error:", err.message);
      return "offline";
    }
  } catch (err) {
    console.error("❌ Critical error checking heartbeat:", err.message || err);
    return "offline";
  }
};

/** ✅ Route for frontend */
const checkDesigoHeartbeat = async (req, res) => {
  const status = await checkDesigoHeartbeat_Internal();
  res.status(200).json({ status });
};

module.exports = { checkDesigoHeartbeat, checkDesigoHeartbeat_Internal };