import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./SubsiteSensorBank.css";

const SubsiteSensorBank = ({ selectedSite }) => {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sensorApi, setSensorApi] = useState("");
  const [sensorName, setSensorName] = useState("");
  const [rateLimit, setRateLimit] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activateInterval, setActivateInterval] = useState("");
  const [activateBatch, setActivateBatch] = useState("");
  const [activeSensorIds, setActiveSensorIds] = useState([]);

  // ✅ Fetch All Sensors
  useEffect(() => {
    const fetchSubsiteSensors = async () => {
      try {
        const token = localStorage.getItem("adminToken");

        if (!token || !selectedSite?.id) return;

        const response = await axios.get("http://localhost:5004/api/subsite/sensor/all", {
          params: { subsiteId: selectedSite.id },
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = response.data?.sensors || [];
        setSensors(data);
      } catch (error) {
        console.error("❌ Error fetching sub-site sensors:", error);
        toast.error("Failed to load sub-site sensors.");
      } finally {
        setLoading(false);
      }
    };

    fetchSubsiteSensors();
  }, [selectedSite]);

  // ✅ Fetch Active Sensor IDs
  useEffect(() => {
    const fetchActiveSubsiteSensors = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        if (!token || !selectedSite?.id) return;

        const response = await axios.get("http://localhost:5004/api/subsite/sensor/active", {
          params: { subsiteId: selectedSite.id },
          headers: { Authorization: `Bearer ${token}` },
        });

        const ids = response.data?.sensors?.map(sensor => sensor.bank_id) || [];
        setActiveSensorIds(ids);
      } catch (error) {
        console.error("❌ Error fetching active sensors:", error);
      }
    };

    fetchActiveSubsiteSensors();
  }, [selectedSite]);

  // ✅ Activate Sub-site Sensor
  const activateSensor = async () => {
    if (!selectedSensor || activeSensorIds.includes(selectedSensor.id)) {
      toast.error("Sensor is already activated.");
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");

      const payload = {
        sensorId: selectedSensor.id,
        interval_seconds: parseInt(activateInterval, 10),
        batch_size: parseInt(activateBatch, 10),
        subsiteId: selectedSite.id,
      };

      await axios.post("http://localhost:5004/api/subsite/sensor/activate", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Sensor activated successfully!");
      setActiveSensorIds(prev => [...prev, selectedSensor.id]);
      setShowActivateModal(false);
    } catch (error) {
      console.error("❌ Activation error:", error);
      toast.error("Failed to activate sensor.");
    }
  };

  // ✅ Add New Sensor to Sub-site
  const addSensor = async () => {
    if (!sensorApi || !sensorName || !rateLimit) {
      toast.error("All fields are required!");
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");

      const payload = {
        sensorApi,
        sensorName,
        rateLimit: parseInt(rateLimit, 10),
        subsiteId: selectedSite.id,
      };

      await axios.post("http://localhost:5004/api/subsite/sensor/add", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Sensor added successfully!");
      setSensorApi("");
      setSensorName("");
      setRateLimit("");
      setShowAddModal(false);

      // Refresh sensor list
      const refreshed = await axios.get("http://localhost:5004/api/subsite/sensor/all", {
        params: { subsiteId: selectedSite.id },
        headers: { Authorization: `Bearer ${token}` },
      });

      setSensors(refreshed.data?.sensors || []);
    } catch (error) {
      console.error("❌ Add sensor error:", error);
      toast.error("Failed to add sub-site sensor.");
    }
  };

  // ✅ Delete Sub-site Sensor
  const deleteSensor = async (sensor) => {
    try {
      const token = localStorage.getItem("adminToken");

      await axios.delete(`http://localhost:5004/api/subsite/sensor/delete/${sensor.id}`, {
        data: { subsiteId: selectedSite.id },
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Sensor deleted successfully!");
      setSensors(prev => prev.filter(s => s.id !== sensor.id));
    } catch (error) {
      console.error("❌ Delete error:", error);
      toast.error("Failed to delete sub-site sensor.");
    }
  };

  const showInfo = (sensor) => {
    setSelectedSensor(sensor);
    setShowInfoModal(true);
  };

  const openActivateModal = (sensor) => {
    setSelectedSensor(sensor);
    setShowActivateModal(true);
  };

  // 🧠 UI/return section comes next
  return (
  <div className="subsite-sensor-bank">
    <h2>Sub-site Sensor Bank: {selectedSite?.name}</h2>
    <div className="subsite-sensor-grid">
      {loading ? (
        <p>Loading sensors...</p>
      ) : sensors.length > 0 ? (
        sensors.map((sensor, index) => {
          if (!sensor) return null;

          return (
            <div key={sensor?.id || index} className="subsite-sensor-card">
              <p>
                <strong>Name:</strong> {sensor?.name || "Unknown Sensor"}{" "}
                {activeSensorIds.includes(sensor.id) && (
                  <span className="subsite-active-indicator" title="Sensor is active">✅</span>
                )}
              </p>

              <p><strong>ID:</strong> {sensor?.id || "N/A"}</p>

              <div className="subsite-dropdown">
                <button className="subsite-dropdown-button">Options ▼</button>
                <div className="subsite-dropdown-content">
                  <button onClick={() => showInfo(sensor)}>ℹ️ Show Info</button>

                  {activeSensorIds.includes(sensor.id) ? (
                    <button disabled title="Already activated" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                      🚫 Activate
                    </button>
                  ) : (
                    <button onClick={() => openActivateModal(sensor)}>⚡ Activate</button>
                  )}

                  <button onClick={() => deleteSensor(sensor)}>🗑 Delete</button>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <p>No sensors available.</p>
      )}

      {/* ➕ "Add Sensor" Card */}
      <div className="subsite-sensor-card add-sensor" onClick={() => setShowAddModal(true)}>
        <span className="plus-sign">+</span>
        <p className="add-text">Add Sensor</p>
      </div>
    </div>

    {/* ➕ Add Sensor Modal */}
    {showAddModal && (
      <div className="subsite-modal">
        <div className="subsite-modal-content">
          <h3>Add New Sub-site Sensor</h3>

          <input
            type="text"
            placeholder="Sensor API URL"
            value={sensorApi}
            onChange={(e) => setSensorApi(e.target.value)}
          />
          <input
            type="text"
            placeholder="Sensor Name"
            value={sensorName}
            onChange={(e) => setSensorName(e.target.value)}
          />
          <input
            type="number"
            placeholder="Rate Limit"
            value={rateLimit}
            onChange={(e) => setRateLimit(e.target.value)}
          />

          <button className="confirm-button" onClick={addSensor}>Add Sensor</button>
          <button className="close-button" onClick={() => setShowAddModal(false)}>Close</button>
        </div>
      </div>
    )}

    {/* ℹ️ Info Modal */}
    {showInfoModal && selectedSensor && (
      <div className="subsite-modal">
        <div className="subsite-modal-content">
          <h3>Sensor Info</h3>
          <p><strong>Name:</strong> {selectedSensor.name}</p>
          <p><strong>ID:</strong> {selectedSensor.id}</p>
          <p><strong>Description:</strong> {selectedSensor.description || "No description provided"}</p>
          <p><strong>Created At:</strong> {selectedSensor.created_at || "N/A"}</p>
          <p>
            <strong>Sensor API:</strong> {selectedSensor.api_endpoint}
            <button
              onClick={() => navigator.clipboard.writeText(selectedSensor.api_endpoint)}
              style={{ marginLeft: "10px" }}
              title="Copy to clipboard"
            >
              📋
            </button>
          </p>
          <button className="close-button" onClick={() => setShowInfoModal(false)}>Close</button>
        </div>
      </div>
    )}

    {/* ⚡ Activate Modal */}
    {showActivateModal && selectedSensor && (
      <div className="subsite-modal">
        <div className="subsite-modal-content">
          <h3>Activate Sensor</h3>
          <p><strong>Sensor:</strong> {selectedSensor.name}</p>

          <input
            type="number"
            placeholder="Interval Seconds"
            value={activateInterval}
            onChange={(e) => setActivateInterval(e.target.value)}
          />
          <input
            type="number"
            placeholder="Batch Size"
            value={activateBatch}
            onChange={(e) => setActivateBatch(e.target.value)}
          />

          <button className="confirm-button" onClick={activateSensor}>Confirm Activation</button>
          <button className="close-button" onClick={() => setShowActivateModal(false)}>Cancel</button>
        </div>
      </div>
    )}
  </div>
);


};



export default SubsiteSensorBank;