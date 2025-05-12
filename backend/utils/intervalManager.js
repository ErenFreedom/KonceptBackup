// utils/intervalManager.js
const fetchIntervals = new Map();
const sendIntervals = new Map();

module.exports = {
  startFetch(sensorId, intervalFn, intervalMs) {
    if (fetchIntervals.has(sensorId)) return;
    const id = setInterval(intervalFn, intervalMs);
    fetchIntervals.set(sensorId, id);
  },

  stopFetch(sensorId) {
    if (fetchIntervals.has(sensorId)) {
      clearInterval(fetchIntervals.get(sensorId));
      fetchIntervals.delete(sensorId);
    }
  },

  startSend(sensorId, intervalFn, intervalMs) {
    if (sendIntervals.has(sensorId)) return;
    const id = setInterval(intervalFn, intervalMs);
    sendIntervals.set(sensorId, id);
  },

  stopSend(sensorId) {
    if (sendIntervals.has(sensorId)) {
      clearInterval(sendIntervals.get(sensorId));
      sendIntervals.delete(sensorId);
    }
  },

  stopAll() {
    fetchIntervals.forEach(clearInterval);
    sendIntervals.forEach(clearInterval);
    fetchIntervals.clear();
    sendIntervals.clear();
  }
};