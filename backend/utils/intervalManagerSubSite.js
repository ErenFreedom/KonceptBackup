const fetchIntervalsSub = new Map();
const sendIntervalsSub = new Map();

module.exports = {
  startFetch(sensorId, intervalFn, intervalMs) {
    if (fetchIntervalsSub.has(sensorId)) return;
    const id = setInterval(intervalFn, intervalMs);
    fetchIntervalsSub.set(sensorId, id);
  },

  stopFetch(sensorId) {
    if (fetchIntervalsSub.has(sensorId)) {
      clearInterval(fetchIntervalsSub.get(sensorId));
      fetchIntervalsSub.delete(sensorId);
    }
  },

  startSend(sensorId, intervalFn, intervalMs) {
    if (sendIntervalsSub.has(sensorId)) return;
    const id = setInterval(intervalFn, intervalMs);
    sendIntervalsSub.set(sensorId, id);
  },

  stopSend(sensorId) {
    if (sendIntervalsSub.has(sensorId)) {
      clearInterval(sendIntervalsSub.get(sensorId));
      sendIntervalsSub.delete(sensorId);
    }
  },

  stopAll() {
    fetchIntervalsSub.forEach(clearInterval);
    sendIntervalsSub.forEach(clearInterval);
    fetchIntervalsSub.clear();
    sendIntervalsSub.clear();
  }
};