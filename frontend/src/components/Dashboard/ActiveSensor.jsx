import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./ActiveSensor.css"; // ✅ Ensure styling for proper layout
import { FaCheckCircle } from "react-icons/fa"; // ✅ Green active icon
import { MdCancel } from "react-icons/md"; // ❌ Red inactive icon

const ActiveSensor = () => {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState(null); // Stores selected sensor info
  const [editSensor, setEditSensor] = useState(null); // holds sensor being edited
  const [editValues, setEditValues] = useState({ interval: "", batch: "" });
  const [localSensorsWithAPI, setLocalSensorsWithAPI] = useState([]);
  const [isViewingInfo, setIsViewingInfo] = useState(false); // NEW
  const [sendingSensorId, setSendingSensorId] = useState(null); // Currently sending sensor
  const [showSendModal, setShowSendModal] = useState(false); // Modal toggle
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeSensorStatus, setActiveSensorStatus] = useState({});
  const [isShowingLogs, setIsShowingLogs] = useState(false);



  const openSendDataModal = async (sensor) => {
    const localMatch = localSensorsWithAPI.find(
      (s) => Number(s.id) === Number(sensor.bank_id)
    );

    const status = activeSensorStatus[sensor.bank_id] || {};

    setSelectedSensor({
      ...sensor,
      api_endpoint: localMatch?.api_endpoint || "Not Available",

    });

    setShowSendModal(true);
  };










  useEffect(() => {
    const fetchActiveSensors = async () => {
      try {
        const token = localStorage.getItem("adminToken");

        if (!token) {
          toast.error("Session expired. Please log in again.");
          return;
        }

        const response = await axios.get("http://localhost:5004/api/sensors/active", {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("✅ Active Sensors:", response.data);

        if (response.data.sensors && Array.isArray(response.data.sensors)) {
          setSensors(response.data.sensors);
        } else {
          console.error("❌ Unexpected API Response Format:", response.data);
          toast.error("Failed to load active sensors.");
        }
      } catch (error) {
        console.error("❌ Error fetching active sensors:", error.response?.data || error.message);
        toast.error("Failed to load active sensors.");
      } finally {
        setLoading(false);
      }
    };

    fetchActiveSensors();
  }, []);

  useEffect(() => {
    const fetchLocalSensorAPIs = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        const response = await axios.get("http://localhost:5004/api/sensor/localAPIs", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setLocalSensorsWithAPI(response.data?.sensors || []);
      } catch (error) {
        console.error("❌ Failed to fetch local sensor APIs:", error.response?.data || error.message);
      }
    };

    fetchLocalSensorAPIs();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchSensorStatus();
      fetchAllJobStatuses();
    }, 30000); // poll every 30 seconds

    fetchAllJobStatuses();

    return () => clearInterval(interval);
  }, []);

  const fetchSensorLogs = async (sensorId) => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get(`http://localhost:5004/api/logs/status`, {
        params: { sensor_id: sensorId },
        headers: { Authorization: `Bearer ${token}` },
      });

      setLogs(response.data.logs || []);
      setIsViewingInfo(false);
      setIsShowingLogs(true);
      setIsLogModalOpen(true);
    } catch (error) {
      console.error("❌ Error fetching logs:", error.response?.data || error.message);
      toast.error("Failed to fetch logs.");
    }
  };


  const fetchSensorStatus = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get("http://localhost:5004/api/connector-data/status", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setActiveSensorStatus(response.data || {});
    } catch (error) {
      console.error("❌ Error fetching interval status:", error.message);
    }
  };



  useEffect(() => {
    let intervalId;
    if (isLogModalOpen && selectedSensor) {
      intervalId = setInterval(() => {
        fetchSensorLogs(selectedSensor.bank_id);
      }, 3000); // every 3 seconds
    }
    return () => clearInterval(intervalId);
  }, [isLogModalOpen, selectedSensor]);


  useEffect(() => {
    if (selectedSensor) {
      const updated = activeSensorStatus[selectedSensor.bank_id];
      if (updated) {
        setSelectedSensor(prev => ({
          ...prev,
          is_fetching: updated.is_fetching || false,
          is_sending: updated.is_sending || false,
        }));
      }
    }
  }, [activeSensorStatus, selectedSensor?.bank_id]);







  /** ✅ Deactivate Sensor */
  const deactivateSensor = async (id) => {
    try {
      const token = localStorage.getItem("adminToken");
      await axios.post("http://localhost:5004/api/sensors/deactivate", { sensorId: id }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success(`Sensor ${id} deactivated!`);
      setSensors((prev) =>
        prev.map((sensor) =>
          sensor.bank_id === id ? { ...sensor, is_active: 0 } : sensor
        )
      );

    } catch (error) {
      console.error("❌ Error deactivating sensor:", error.response?.data || error.message);
      toast.error("Failed to deactivate sensor.");
    }
  };

  /** ✅ Remove Sensor */
  const removeSensor = async (id) => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.post(
        "http://localhost:5004/api/sensors/remove",
        { sensorId: id },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success(`✅ Sensor ${id} removed successfully.`);
      setSensors((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to remove sensor.";

      if (errorMsg.toLowerCase().includes("must be deactivated")) {
        toast.error("⚠️ Please deactivate the sensor before removing it.");
      } else if (errorMsg.toLowerCase().includes("not found")) {
        toast.error("❌ Sensor not found in active sensors.");
      } else {
        toast.error(`❌ ${errorMsg}`);
      }

      console.error("❌ Error removing sensor:", errorMsg);
    }
  };

  const reactivateSensor = async (id) => {
    try {
      const token = localStorage.getItem("adminToken");
      await axios.post("http://localhost:5004/api/sensors/reactivate", { sensorId: id }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success(`Sensor ${id} reactivated!`);
      setSensors(prev =>
        prev.map(sensor => sensor.bank_id === id ? { ...sensor, is_active: 1 } : sensor)
      );
    } catch (error) {
      console.error("❌ Error reactivating sensor:", error.response?.data || error.message);
      toast.error("Failed to reactivate sensor.");
    }
  };


  const updateSensorSettings = async (sensorId, interval, batch) => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.post("http://localhost:5004/api/sensors/update-settings", {
        sensorId,
        interval_seconds: Number(interval),
        batch_size: Number(batch),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success(`✅ Sensor ${sensorId} settings updated!`);

      // Update state
      setSensors((prev) =>
        prev.map((sensor) =>
          sensor.bank_id === sensorId
            ? { ...sensor, interval_seconds: Number(interval), batch_size: Number(batch) }
            : sensor
        )
      );
      setSelectedSensor(null);
    } catch (error) {
      console.error("❌ Error updating sensor settings:", error.response?.data || error.message);
      toast.error("Failed to update sensor settings.");
    }
  };

  const getDesigoToken = async () => {
    try {
      const username = localStorage.getItem("desigoUsername");
      if (!username) {
        toast.error("No username found in storage.");
        return null;
      }

      const response = await axios.get("http://localhost:5004/api/desigo/auth/stored-token", {
        params: { username },
      });

      return response.data?.token || null;
    } catch (error) {
      console.error("❌ Failed to fetch Desigo token:", error.response?.data || error.message);
      toast.error("Failed to retrieve Desigo token.");
      return null;
    }
  };

  const fetchAllJobStatuses = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get("http://localhost:5004/api/sensors/job-status/all", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setActiveSensorStatus(response.data || {}); // this sets job status for all
    } catch (err) {
      console.error("❌ Failed to fetch job statuses:", err.response?.data || err.message);
    }
  };




  const handleSendData = async (sensor) => {
    try {
      const token = localStorage.getItem("adminToken");

      // Step 1: Deactivate the sensor
      await axios.post("http://localhost:5004/api/sensors/deactivate", { sensorId: sensor.bank_id }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Sensor ${sensor.id} deactivated.`);

      // Step 2: Remove the sensor
      await axios.post("http://localhost:5004/api/sensors/remove", { sensorId: sensor.bank_id }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Sensor ${sensor.id} removed.`);

      // Step 3: Update UI
      setSensors(prev => prev.filter(s => s.id !== sensor.id));

      // Optional: proceed to actual "send data" logic here
      toast.info("✅ Sensor cleanup complete. Now sending data...");

    } catch (error) {
      console.error("❌ Error during send data process:", error.response?.data || error.message);
      toast.error("Failed to process sensor cleanup.");
    }
  };

  const startSendingData = async (sensorId, api) => {
    try {
      const adminToken = localStorage.getItem("adminToken");
      const desigoToken = await getDesigoToken();

      if (!desigoToken) {
        toast.error("Desigo token missing. Cannot start.");
        return;
      }

      await axios.get(`http://localhost:5004/api/local/fetch-sensor`, {
        params: { api_endpoint: api, sensor_id: sensorId },
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "x-desigo-token": desigoToken,
        },
      });

      await axios.get(`http://localhost:5004/api/connector-data/send`, {
        params: { sensor_id: sensorId },
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      toast.success("✅ Sensor started sending data to cloud");

      // Refresh global status
      await fetchAllJobStatuses();
      await fetchSensorStatus();

      // Refresh selectedSensor (important!)

    } catch (err) {
      console.error("❌ Error starting data send:", err.response?.data || err.message);
      toast.error("Failed to start sending data.");
    }
  };





  const stopSendingData = async () => {
    try {
      const token = localStorage.getItem("adminToken");

      await axios.get("http://localhost:5004/api/connector-data/stop-send", {
        params: { sensor_id: selectedSensor.bank_id },
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.info("🛑 Sensor data transmission fully stopped.");

      // Refresh global status
      await fetchAllJobStatuses();
      await fetchSensorStatus();

      // Refresh selectedSensor (important!)

    } catch (err) {
      console.error("❌ Failed to stop data:", err.response?.data || err.message);
      toast.error("Failed to stop sending data.");
    }
  };




  return (
    <div className="active-sensor-bank">
      <h2>Active Sensors</h2>
      <div className="sensor-grid">
        {loading ? (
          <p>Loading active sensors...</p>
        ) : sensors.length > 0 ? (
          sensors.map((sensor) => (
            <div key={sensor.id} className="sensor-card">
              <p><strong>Name:</strong> {sensor.name}</p>
              {activeSensorStatus[sensor.bank_id]?.is_fetching === 1 || activeSensorStatus[sensor.bank_id]?.is_sending === 1 ? (
                <div className="pulsating-dot" title="Fetching or Sending..."></div>
              ) : null}



              <p><strong>ID:</strong> {sensor.id}</p>
              <p><strong>Bank ID:</strong> {sensor.bank_id}</p>
              {activeSensorStatus[sensor.bank_id]?.is_fetching || activeSensorStatus[sensor.bank_id]?.is_sending ? (
                <div className="job-indicator">
                  <FaCheckCircle style={{ color: "green", marginRight: "5px" }} />
                  <span style={{ color: "green", fontWeight: "bold" }}>Running Job</span>
                </div>
              ) : (
                <div className="job-indicator">
                  <MdCancel style={{ color: "gray", marginRight: "5px" }} />
                  <span style={{ color: "gray" }}>Idle</span>
                </div>
              )}

              {/* ✅ Status with Animation */}
              <div className="sensor-status">
                {sensor.is_active ? (
                  <span className="active-status">
                    <FaCheckCircle className="active-icon" /> Activated
                  </span>
                ) : (
                  <span className="inactive-status">
                    <MdCancel className="inactive-icon" /> Inactive
                  </span>
                )}
              </div>

              {/* ✅ Dropdown for actions */}
              <div className="dropdown">
                <button className="dropdown-button">Options ▼</button>
                <div className="dropdown-content">
                  {/* ✅ Send Data (Only if active) */}
                  {sensor.is_active ? (
                    <button onClick={() => openSendDataModal(sensor)}>📡 Manage Data Sending</button>
                  ) : (
                    <button disabled style={{ color: "gray", cursor: "not-allowed" }}>📡 Manage Data Sending</button>
                  )}


                  {/* ✅ Deactivate (Only if active) */}
                  {sensor.is_active ? (
                    <button
                      onClick={() => deactivateSensor(sensor.bank_id)}
                      disabled={
                        activeSensorStatus[sensor.bank_id]?.is_fetching ||
                        activeSensorStatus[sensor.bank_id]?.is_sending
                      }
                      style={{
                        color:
                          activeSensorStatus[sensor.bank_id]?.is_fetching ||
                            activeSensorStatus[sensor.bank_id]?.is_sending
                            ? "gray"
                            : "inherit",
                        cursor:
                          activeSensorStatus[sensor.bank_id]?.is_fetching ||
                            activeSensorStatus[sensor.bank_id]?.is_sending
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      🛑 Deactivate
                    </button>
                  ) : (
                    <button disabled style={{ color: "gray", cursor: "not-allowed" }}>
                      🛑 Deactivate
                    </button>
                  )}


                  {/* ✅ Reactivate (Only if inactive) */}
                  {sensor.is_active ? (
                    <button disabled style={{ color: "gray", cursor: "not-allowed" }}>🔄 Reactivate</button>
                  ) : (
                    <button onClick={() => reactivateSensor(sensor.bank_id)}>🔄 Reactivate</button>
                  )}

                  {sensor.is_active ? (
                    <button disabled style={{ color: "gray", cursor: "not-allowed" }}>✏️ Edit Sensor</button>
                  ) : (
                    <button onClick={() => {
                      setSelectedSensor(sensor);
                      setIsViewingInfo(false); // make sure info/edit modal doesn’t show
                      setIsShowingLogs(false);  // tell React we're showing logs
                      setIsLogModalOpen(false);
                      fetchSensorLogs(sensor.bank_id);
                    }}
                    >✏️ Edit Sensor</button>
                  )}

                  <button
                    disabled={
                      !(
                        activeSensorStatus[sensor.bank_id]?.is_fetching ||
                        activeSensorStatus[sensor.bank_id]?.is_sending
                      )
                    }
                    onClick={() => {
                      setSelectedSensor(sensor);
                      fetchSensorLogs(sensor.bank_id);
                    }}
                    style={{
                      color:
                        activeSensorStatus[sensor.bank_id]?.is_fetching ||
                          activeSensorStatus[sensor.bank_id]?.is_sending
                          ? "inherit"
                          : "gray",
                      cursor:
                        activeSensorStatus[sensor.bank_id]?.is_fetching ||
                          activeSensorStatus[sensor.bank_id]?.is_sending
                          ? "pointer"
                          : "not-allowed",
                    }}
                  >
                    🧾 View Logs
                  </button>








                  {/* ✅ Always allow remove and show info */}
                  <button onClick={() => removeSensor(sensor.bank_id)}>❌ Remove</button>
                  <button onClick={() => showInfo(sensor)}>ℹ️ Show Info</button>

                </div>

              </div>
            </div>
          ))
        ) : (
          <p>No active sensors available.</p>
        )}
      </div>

      {/* ✅ Modal for displaying sensor info */}
      {/* ✅ Modal for Sensor Info */}
      {selectedSensor && isViewingInfo && !isShowingLogs && (
        <div className="modal">
          <div className="modal-content">
            <h3>Sensor Details</h3>
            <p><strong>Name:</strong> {selectedSensor.name}</p>
            <p><strong>ID:</strong> {selectedSensor.id}</p>
            <p><strong>Bank ID:</strong> {selectedSensor.bank_id}</p>
            <p><strong>Status:</strong> {selectedSensor.is_active ? "Activated" : "Inactive"}</p>
            <p><strong>Interval:</strong> {selectedSensor.interval_seconds}s</p>
            <p><strong>Batch Size:</strong> {selectedSensor.batch_size}</p>

            <p>
              <strong>Sensor API:</strong>{" "}
              <span style={{ userSelect: "text" }}>{selectedSensor.api_endpoint}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedSensor.api_endpoint);
                  toast.success("✅ API copied to clipboard!");
                }}
                style={{
                  marginLeft: "10px",
                  padding: "2px 8px",
                  backgroundColor: "#eee",
                  borderRadius: "5px",
                  border: "1px solid #ccc",
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                📋 Copy
              </button>
            </p>

            <button className="close-button" onClick={() => {
              setSelectedSensor(null);
              setIsViewingInfo(false);
            }}>Close</button>
          </div>
        </div>
      )}

      {/* ✅ Modal for Editing Sensor */}
      {selectedSensor && !isViewingInfo && !isShowingLogs && (
        <div className="modal">
          <div className="modal-content">
            <h3>Edit Sensor Settings</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const interval = e.target.interval.value;
              const batch = e.target.batch.value;
              updateSensorSettings(selectedSensor.bank_id, interval, batch);
            }}>
              <label>Interval (seconds):</label>
              <input type="number" name="interval" defaultValue={selectedSensor.interval_seconds || 10} required />

              <label>Batch Size:</label>
              <input type="number" name="batch" defaultValue={selectedSensor.batch_size || 1} required />

              <button type="submit">✅ Save</button>
              <button className="close-button" type="button" onClick={() => setSelectedSensor(null)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* ✅ Modal for Viewing Logs */}
      {selectedSensor && isShowingLogs && isLogModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>Logs for Sensor {selectedSensor?.bank_id}</h3>
            <div
              className="log-stream"
              style={{
                maxHeight: "300px",
                overflowY: "scroll",
                backgroundColor: "#111",
                color: "#0f0",
                padding: "10px",
                border: "1px solid #333",
                marginTop: "10px"
              }}
            >
              {logs.length > 0 ? (
                logs.map((log, idx) => <p key={idx}>📄 {log}</p>)
              ) : (
                <p>No logs yet.</p>
              )}
            </div>
            <button className="close-button" onClick={() => {
              setIsLogModalOpen(false);
              setIsShowingLogs(false);
              setSelectedSensor(null);
            }}>Close</button>
          </div>
        </div>
      )}



      {showSendModal && selectedSensor && (
        <div className="modal">
          <div className="modal-content">
            <h3>Send Sensor Data to Cloud</h3>
            <p><strong>Name:</strong> {selectedSensor.name}</p>
            <p><strong>ID:</strong> {selectedSensor.id}</p>
            <p><strong>Bank ID:</strong> {selectedSensor.bank_id}</p>
            <p><strong>Interval:</strong> {selectedSensor.interval_seconds}s</p>
            <p><strong>Batch Size:</strong> {selectedSensor.batch_size}</p>
            <p>
              <strong>Sensor API:</strong>{" "}
              <span style={{ userSelect: "text" }}>{selectedSensor.api_endpoint}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedSensor.api_endpoint);
                  toast.success("✅ API copied to clipboard!");
                }}
                style={{
                  marginLeft: "10px",
                  padding: "2px 8px",
                  backgroundColor: "#eee",
                  borderRadius: "5px",
                  border: "1px solid #ccc",
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                📋 Copy
              </button>
            </p>

            {/* Pulsating icon */}
            {sendingSensorId === selectedSensor.bank_id ? (
              <p style={{ color: "green", fontWeight: "bold" }}>
                🟢 Sending data...
              </p>
            ) : (
              <p style={{ color: "gray" }}>⚫ Not sending data.</p>
            )}

            {/* Start / Stop Buttons */}
            <button
              className="confirm-button"
              disabled={
                activeSensorStatus[selectedSensor.bank_id]?.is_fetching ||
                activeSensorStatus[selectedSensor.bank_id]?.is_sending
              }
              onClick={() =>
                startSendingData(selectedSensor.bank_id, selectedSensor.api_endpoint)
              }
            >
              🚀 Start Sending
            </button>

            <button
              className="stop-button"
              disabled={
                !(
                  activeSensorStatus[selectedSensor.bank_id]?.is_fetching ||
                  activeSensorStatus[selectedSensor.bank_id]?.is_sending
                )
              }
              onClick={stopSendingData}
            >
              🛑 Stop Sending
            </button>


            <button
              className="close-button"
              onClick={() => {
                setShowSendModal(false);
                setSelectedSensor(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}



    </div>
  );
};





export default ActiveSensor;
