const { db } = require("../db/sensorDB");
const { checkDesigoHeartbeat_Internal } = require("./desigoHeartbeatController");

let failureCount = 0;
const MAX_FAILURES = 30;
const INTERVAL_MS = 180000; // 3 minutes

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

const monitorHeartbeat = async () => {
  try {
    const status = await checkDesigoHeartbeat_Internal();

    if (status === "online") {
      if (failureCount > 0) {
        console.log(`✅ Heartbeat restored after ${failureCount} failure(s). Resetting count.`);
      }
      failureCount = 0; // RESET ON SUCCESS
    } else {
      failureCount++;
      console.warn(`⚠️ Heartbeat failure #${failureCount}/${MAX_FAILURES}`);

      if (failureCount >= MAX_FAILURES) {
        console.error("🛑 Server unreachable 30 times in a row. Killing jobs...");
        await stopAllFetchingAndSending();
        failureCount = 0;
      }
    }
  } catch (err) {
    failureCount++;
    console.error("❌ Heartbeat check failed:", err.message || err);
    if (failureCount >= MAX_FAILURES) {
      console.error("🛑 Server unreachable 30 times (error path). Killing jobs...");
      await stopAllFetchingAndSending();
      failureCount = 0;
    }
  }
};

const startHeartbeatMonitor = () => {
  console.log(`🚀 Heartbeat monitor started (interval: ${INTERVAL_MS / 1000}s, max failures: ${MAX_FAILURES})`);
  setInterval(monitorHeartbeat, INTERVAL_MS);
};

module.exports = { startHeartbeatMonitor };