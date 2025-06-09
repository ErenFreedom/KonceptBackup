import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./ActiveSensor.css";
import { useJobStatus } from "../../context/JobStatusContext";
import { FaCheckCircle } from "react-icons/fa";
import { MdCancel } from "react-icons/md";

const SubsiteActiveSensor = ({ subsiteId }) => {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [editSensor, setEditSensor] = useState(null);
  const [editValues, setEditValues] = useState({ interval: "", batch: "" });
  const [isViewingInfo, setIsViewingInfo] = useState(false);
  const [sendingSensorId, setSendingSensorId] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const { jobStatusMap, setJobStatusMap } = useJobStatus();
  const [isShowingLogs, setIsShowingLogs] = useState(false);
  const [activeSensorStatus, setActiveSensorStatus] = useState({});

  const openSendDataModal = async (sensor) => {
    setSelectedSensor(sensor);  // ✅ simplified

    setShowSendModal(true);

    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get("http://localhost:5004/api/subsite/jobs/sensor", {
        params: { bank_id: sensor.bank_id, subsite_id: subsiteId }, // ✅ both needed
        headers: { Authorization: `Bearer ${token}` },
      });

      setJobStatusMap((prev) => ({
        ...prev,
        [sensor.bank_id]: {
          is_fetching: response.data.is_fetching,
          is_sending: response.data.is_sending,
        },
      }));
    } catch (error) {
      console.error("❌ Failed to fetch job status:", error.response?.data || error.message);
    }
  };

  const fetchActiveSensors = async () => {
    try {
      const token = localStorage.getItem("adminToken");

      if (!token) {
        toast.error("Session expired. Please log in again.");
        return;
      }

      const response = await axios.get(
        `http://localhost:5004/api/subsite/sensor/active`,
        {
          params: { subsite_id: subsiteId }, // ✅ fixed to snake_case
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.sensors && Array.isArray(response.data.sensors)) {
        setSensors(response.data.sensors);
      } else {
        toast.error("Failed to load active sub-site sensors.");
      }
    } catch (error) {
      console.error("❌ Error fetching sub-site active sensors:", error.response?.data || error.message);
      toast.error("Failed to load active sub-site sensors.");
    } finally {
      setLoading(false);
    }
  };



  // const fetchLocalSensorAPIs = async () => {
  //   try {
  //     const token = localStorage.getItem("adminToken");
  //     const response = await axios.get("http://localhost:5004/api/sensor/localAPIs", {
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //       },
  //     });
  //     setLocalSensorsWithAPI(response.data?.sensors || []);
  //   } catch (error) {
  //     console.error("❌ Failed to fetch local sensor APIs:", error.response?.data || error.message);
  //   }
  // };

  const fetchSensorStatus = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get("http://localhost:5004/api/subsite/interval/status", {
        params: { subsite_id: subsiteId }, // ✅ explicitly pass subsite_id
        headers: { Authorization: `Bearer ${token}` },
      });

      setActiveSensorStatus(response.data || {});
    } catch (error) {
      console.error("❌ Error fetching sub-site interval status:", error.message);
    }
  };

  const fetchAllJobStatuses = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get("http://localhost:5004/api/subsite/jobs/all", {
        params: { subsite_id: subsiteId }, // ✅ required
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(response.data.statuses)) {
        const newStatusMap = {};
        response.data.statuses.forEach((status) => {
          newStatusMap[status.bank_id] = {
            is_fetching: status.is_fetching,
            is_sending: status.is_sending,
          };
        });
        setJobStatusMap(newStatusMap);
      }
    } catch (error) {
      console.error("❌ Failed to fetch job statuses:", error.message);
    }
  };

  const fetchSensorLogs = async (sensorId) => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.get("http://localhost:5004/api/subsite/logs/status", {
        params: { sensorId, subsiteId },  // 👈 include both
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(response.data.logs)) {
        setLogs(response.data.logs);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error("❌ Error fetching logs:", error.response?.data || error.message);
      toast.error("Failed to fetch sensor logs.");
    }
  };

  useEffect(() => {
    fetchActiveSensors();
  }, [subsiteId]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchSensorStatus();
      fetchAllJobStatuses();
    }, 2000);

    fetchAllJobStatuses();

    return () => clearInterval(interval);
  }, [subsiteId]);

  useEffect(() => {
    let intervalId;
    if (isLogModalOpen && selectedSensor) {
      intervalId = setInterval(() => {
        fetchSensorLogs(selectedSensor.bank_id);
      }, 3000);
    }
    return () => clearInterval(intervalId);
  }, [isLogModalOpen, selectedSensor]);

  const deactivateSensor = async (id) => {
    try {
      const token = localStorage.getItem("adminToken");
      await axios.post("http://localhost:5004/api/subsite/sensor/deactivate", { sensorId: id }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success(`Sensor ${id} deactivated!`);
      setSensors((prev) => prev.map((sensor) => sensor.bank_id === id ? { ...sensor, is_active: 0 } : sensor));
    } catch (error) {
      console.error("❌ Error deactivating sensor:", error.response?.data || error.message);
      toast.error("Failed to deactivate sensor.");
    }
  };

  const removeSensor = async (id) => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await axios.post("http://localhost:5004/api/subsite/sensor/remove", { sensorId: id }, {
        headers: { Authorization: `Bearer ${token}` },
      });

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

  return <div className="subsite-active-sensor">Loading...</div>;
};


const reactivateSensor = async (id) => {
  try {
    const token = localStorage.getItem("adminToken");
    await axios.post("http://localhost:5004/api/subsite/sensor/reactivate", { sensorId: id }, {
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
    const response = await axios.put("http://localhost:5004/api/subsite/sensor/settings", {
      sensorId,
      interval_seconds: Number(interval),
      batch_size: Number(batch),
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });

    toast.success(`✅ Sensor ${sensorId} settings updated!`);

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
    const response = await axios.get("http://localhost:5004/api/subsite/jobs/all", {
      headers: { Authorization: `Bearer ${token}` },
    });

    setJobStatusMap(response.data || {});
  } catch (err) {
    console.error("❌ Failed to fetch sub-site job statuses:", err.response?.data || err.message);
  }
};


const startSendingData = async (sensorId, api, subsiteId) => {
  try {
    const adminToken = localStorage.getItem("adminToken");
    const desigoToken = await getDesigoToken();

    if (!desigoToken) {
      toast.error("Desigo token missing. Cannot start.");
      return;
    }

    // ✅ Step 1: Trigger sub-site fetch from local server
    await axios.get("http://localhost:5004/api/subsite/sensor-data/fetch", {
      params: {
        api_endpoint: api,
        sensor_id: sensorId,
        subsite_id: subsiteId,
      },
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-desigo-token": desigoToken,
      },
    });

    // ✅ Step 2: Trigger sub-site send to cloud
    await axios.post("http://localhost:5004/api/subsite/sensor-data/send", {
      sensor_id: sensorId,
      subsite_id: subsiteId,
    }, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    toast.success("✅ Sensor started sending sub-site data to cloud");

    // ✅ Step 3: Wait and refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    await fetchAllJobStatuses();
    await fetchSensorStatus();

  } catch (err) {
    console.error("❌ Error starting sub-site data send:", err.response?.data || err.message);
    toast.error("Failed to start sending sub-site data.");
  }
};


const stopSendingData = async (sensorId, subsiteId) => {
  try {
    const token = localStorage.getItem("adminToken");

    await axios.post("http://localhost:5004/api/subsite/sensor-data/stop", {
      sensor_id: sensorId,
      subsite_id: subsiteId,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });

    toast.info("🛑 Sub-site sensor data transmission fully stopped.");

    // ✅ Wait and refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    await fetchAllJobStatuses();
    await fetchSensorStatus();

  } catch (err) {
    console.error("❌ Failed to stop sub-site data:", err.response?.data || err.message);
    toast.error("Failed to stop sending sub-site data.");
  }


  return (
    <div className="active-sensor-bank">
      <h2>Active Sensors - Sub-Site</h2>
      <div className="sensor-grid">
        {loading ? (
          <p>Loading active sensors...</p>
        ) : sensors.length > 0 ? (
          sensors.map((sensor) => (
            <div key={sensor.id} className="sensor-card">
              <p><strong>Name:</strong> {sensor.name}</p>

              {jobStatusMap[sensor.bank_id]?.is_fetching === 1 || jobStatusMap[sensor.bank_id]?.is_sending === 1 ? (
                <div className="pulsating-dot" title="Fetching or Sending..."></div>
              ) : null}

              <p><strong>ID:</strong> {sensor.id}</p>
              <p><strong>Bank ID:</strong> {sensor.bank_id}</p>

              {/* ✅ Status Indicator */}
              {jobStatusMap[sensor.bank_id]?.is_fetching || jobStatusMap[sensor.bank_id]?.is_sending ? (
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

              {/* ✅ Activation Status */}
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

              {/* 🔽 Action Dropdown */}
              <div className="dropdown">
                <button className="dropdown-button">Options ▼</button>
                <div className="dropdown-content">
                  {/* Manage Data Sending */}
                  {sensor.is_active ? (
                    <button onClick={() => openSendDataModal(sensor)}>📡 Manage Data Sending</button>
                  ) : (
                    <button disabled style={{ color: "gray", cursor: "not-allowed" }}>📡 Manage Data Sending</button>
                  )}

                  {/* Deactivate */}
                  {sensor.is_active ? (
                    <button
                      onClick={() => deactivateSensor(sensor.bank_id)}
                      disabled={
                        jobStatusMap[sensor.bank_id]?.is_fetching ||
                        jobStatusMap[sensor.bank_id]?.is_sending
                      }
                      style={{
                        color:
                          jobStatusMap[sensor.bank_id]?.is_fetching ||
                            jobStatusMap[sensor.bank_id]?.is_sending
                            ? "gray"
                            : "inherit",
                        cursor:
                          jobStatusMap[sensor.bank_id]?.is_fetching ||
                            jobStatusMap[sensor.bank_id]?.is_sending
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

                  {/* Reactivate */}
                  {sensor.is_active ? (
                    <button disabled style={{ color: "gray", cursor: "not-allowed" }}>🔄 Reactivate</button>
                  ) : (
                    <button onClick={() => reactivateSensor(sensor.bank_id)}>🔄 Reactivate</button>
                  )}

                  {/* Edit */}
                  <button
                    onClick={() => {
                      setSelectedSensor(sensor);
                      setIsViewingInfo(false);
                      setIsShowingLogs(false);
                      setIsLogModalOpen(false);
                      fetchSensorLogs(sensor.bank_id);
                    }}
                  >
                    ✏️ Edit Sensor
                  </button>

                  {/* View Logs */}
                  <button
                    disabled={
                      !(
                        jobStatusMap[sensor.bank_id]?.is_fetching ||
                        jobStatusMap[sensor.bank_id]?.is_sending
                      )
                    }
                    onClick={() => {
                      setSelectedSensor(sensor);
                      fetchSensorLogs(sensor.bank_id);
                      setIsShowingLogs(true);
                      setIsLogModalOpen(true);
                    }}
                    style={{
                      color:
                        jobStatusMap[sensor.bank_id]?.is_fetching ||
                          jobStatusMap[sensor.bank_id]?.is_sending
                          ? "inherit"
                          : "gray",
                      cursor:
                        jobStatusMap[sensor.bank_id]?.is_fetching ||
                          jobStatusMap[sensor.bank_id]?.is_sending
                          ? "pointer"
                          : "not-allowed",
                    }}
                  >
                    🧾 View Logs
                  </button>

                  {/* Remove + Info */}
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

      {isViewingInfo && selectedSensor && (
        <div className="modal">
          <div className="modal-content">
            <h3>Sensor Information</h3>
            <p><strong>Name:</strong> {selectedSensor.name}</p>
            <p><strong>ID:</strong> {selectedSensor.id}</p>
            <p><strong>Bank ID:</strong> {selectedSensor.bank_id}</p>
            <p><strong>Type:</strong> {selectedSensor.type}</p>
            <p><strong>Location:</strong> {selectedSensor.location}</p>
            <p><strong>Interval:</strong> {selectedSensor.interval_seconds} sec</p>
            <p><strong>Batch Size:</strong> {selectedSensor.batch_size}</p>
            <p><strong>API Endpoint:</strong> {selectedSensor.api_endpoint}</p>
            <button onClick={() => setIsViewingInfo(false)}>Close</button>
          </div>
        </div>
      )}


      {editSensor && (
        <div className="modal">
          <div className="modal-content">
            <h3>Edit Sensor Settings</h3>
            <label>
              Interval Seconds:
              <input
                type="number"
                value={editValues.interval}
                onChange={(e) => setEditValues({ ...editValues, interval: e.target.value })}
              />
            </label>
            <label>
              Batch Size:
              <input
                type="number"
                value={editValues.batch}
                onChange={(e) => setEditValues({ ...editValues, batch: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => updateSensorSettings(editSensor.bank_id, editValues.interval, editValues.batch)}>
                Save
              </button>
              <button onClick={() => setEditSensor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}



      {isLogModalOpen && selectedSensor && (
        <div className="modal">
          <div className="modal-content logs-modal">
            <h3>Logs for Sensor {selectedSensor.bank_id}</h3>
            <div className="logs-container">
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <p key={index} style={{ fontSize: "14px", marginBottom: "6px" }}>
                    {log.timestamp}: {log.message}
                  </p>
                ))
              ) : (
                <p>No logs available.</p>
              )}
            </div>
            <button onClick={() => setIsLogModalOpen(false)}>Close</button>
          </div>
        </div>
      )}


      {showSendModal && selectedSensor && (
        <div className="modal">
          <div className="modal-content">
            <h3>Manage Sensor Data</h3>
            <p><strong>Bank ID:</strong> {selectedSensor.bank_id}</p>
            <p><strong>API:</strong> {selectedSensor.api_endpoint}</p>
            <div className="modal-actions">
              <button
                onClick={() => startSendingData(selectedSensor.bank_id, selectedSensor.api_endpoint, subsiteId)}
                disabled={
                  jobStatusMap[selectedSensor.bank_id]?.is_sending ||
                  jobStatusMap[selectedSensor.bank_id]?.is_fetching
                }
              >
                🚀 Start Sending
              </button>
              <button
                onClick={() => stopSendingData(selectedSensor.bank_id, subsiteId)}
                disabled={
                  !jobStatusMap[selectedSensor.bank_id]?.is_sending &&
                  !jobStatusMap[selectedSensor.bank_id]?.is_fetching
                }
              >
                🛑 Stop Sending
              </button>
              <button onClick={() => setShowSendModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}


    </div>  // ✅ properly close the root div
  );


};



export default SubsiteActiveSensor;