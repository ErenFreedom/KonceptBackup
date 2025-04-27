const { db } = require("../db/sensorDB");
const { checkDesigoHeartbeat_Internal } = require("./desigoHeartbeatController");

let failureCount = 0;

/** ✅ Stops all fetching and sending if server unreachable */
const stopAllFetchingAndSending = () => {
  return new Promise((resolve) => {
    db.run(`UPDATE IntervalControl SET is_fetching = 0, is_sending = 0`, [], (err) => {
      if (err) {
        console.error("❌ Failed to stop IntervalControl jobs:", err.message);
      } else {
        console.log("🛑 All fetching/sending jobs stopped (Heartbeat failure).");
      }
      resolve();
    });
  });
};

/** ✅ Monitor heartbeat periodically */
const monitorHeartbeat = async () => {
  try {
    const healthStatus = await checkDesigoHeartbeat_Internal();
    if (healthStatus === "online") {
      failureCount = 0;
      console.log("✅ Heartbeat OK");
    } else {
      failureCount++;
      console.warn(`⚠️ Heartbeat failure ${failureCount}/3`);

      if (failureCount >= 3) {
        console.error("🛑 Server unreachable. Killing jobs...");
        await stopAllFetchingAndSending();
        failureCount = 0;
      }
    }
  } catch (error) {
    failureCount++;
    console.error(`❌ Error checking heartbeat:`, error.message);

    if (failureCount >= 3) {
      console.error("🛑 Server unreachable after 3 errors. Killing jobs...");
      await stopAllFetchingAndSending();
      failureCount = 0;
    }
  }
};

/** ✅ Start monitoring */
const startHeartbeatMonitor = () => {
  console.log("🚀 Heartbeat monitor started (interval: 30s)");
  setInterval(monitorHeartbeat, 30000); // every 30 seconds
};

module.exports = { startHeartbeatMonitor };