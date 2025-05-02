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
        console.log("🛑 All fetching/sending jobs stopped due to heartbeat failure.");
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
      if (failureCount > 0) {
        console.log(`✅ Heartbeat restored after ${failureCount} failure(s)`);
      }
      failureCount = 0;
    } else {
      failureCount++;
      console.warn(`⚠️ Heartbeat failure #${failureCount}/3`);

      if (failureCount >= 3) {
        console.error("🛑 Server unreachable 3 times in a row. Killing jobs...");
        await stopAllFetchingAndSending();
        failureCount = 0;
      }
    }
  } catch (error) {
    failureCount++;
    console.error("❌ Error checking heartbeat:", error.message || error);

    if (failureCount >= 3) {
      console.error("🛑 Server unreachable after 3 errors. Killing jobs...");
      await stopAllFetchingAndSending();
      failureCount = 0;
    }
  }
};

/** ✅ Start monitor on backend boot */
const startHeartbeatMonitor = () => {
  console.log("🚀 Heartbeat monitor started (interval: 100s)");
  setInterval(monitorHeartbeat, 100000); // every 100 seconds
};

module.exports = { startHeartbeatMonitor };