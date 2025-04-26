const axios = require("axios");
const { db } = require("../db/sensorDB");
const { insertLog } = require("./logHelpers");

let consecutiveFailures = 0; // ✅ Track how many failures happened

// ✅ Try pinging a known sensor API using Desigo token
const checkDesigoConnection = async () => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT token FROM DesigoAuthTokens ORDER BY id DESC LIMIT 1",
      (err, tokenRow) => {
        if (err || !tokenRow) {
          console.error("❌ No Desigo token found.");
          return reject("No token available.");
        }

        const token = tokenRow.token;

        db.get(
          `
          SELECT api_endpoint FROM LocalSensorAPIs
          JOIN LocalActiveSensors ON LocalSensorAPIs.sensor_id = LocalActiveSensors.id
          WHERE LocalActiveSensors.is_active = 1
          LIMIT 1
          `,
          async (err, apiRow) => {
            if (err || !apiRow) {
              console.error("❌ No active sensor API found.");
              return reject("No active sensor API.");
            }

            const testApi = apiRow.api_endpoint;

            try {
              await axios.get(testApi, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 5000,
              });

              console.log("✅ Desigo server reachable.");
              resolve(true);
            } catch (err) {
              console.error("❌ Failed to reach Desigo:", err.message);
              reject("Desigo server unreachable.");
            }
          }
        );
      }
    );
  });
};

// ✅ Stop all sending
const stopAllSending = () => {
  db.run("UPDATE IntervalControl SET is_sending = 0 WHERE is_sending = 1", [], function (err) {
    if (err) {
      console.error("❌ Error stopping sending:", err.message);
    } else {
      console.log(`🛑 Stopped sending for ${this.changes} sensor(s).`);
    }
  });
};

// ✅ Stop all fetching
const stopAllFetching = () => {
  db.run("UPDATE IntervalControl SET is_fetching = 0 WHERE is_fetching = 1", [], function (err) {
    if (err) {
      console.error("❌ Error stopping fetching:", err.message);
    } else {
      console.log(`🛑 Stopped fetching for ${this.changes} sensor(s).`);
    }
  });
};

// ✅ Health monitor with retry logic
const desigoHealthMonitor = async () => {
  try {
    await checkDesigoConnection();
    if (consecutiveFailures > 0) {
      console.log("✅ Desigo connection restored. Resetting failure counter.");
    }
    consecutiveFailures = 0; // ✅ Reset on success
  } catch (err) {
    consecutiveFailures++;

    console.warn(`⚠️ Desigo Health Failure #${consecutiveFailures}`);

    if (consecutiveFailures >= 3) {
      console.error("🛑 3 Consecutive Failures. Stopping all sensor activities.");
      insertLog(0, "🛑 Stopping all sensors: Desigo server unreachable for 3 consecutive checks.");
      stopAllSending();
      stopAllFetching();
    }
  }
};

module.exports = { desigoHealthMonitor };