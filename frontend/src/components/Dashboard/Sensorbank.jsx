import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./SensorBank.css"; // ✅ Ensure styling

const SensorBank = () => {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState(null); // Stores selected sensor info
  const [showAddModal, setShowAddModal] = useState(false); // ✅ Controls Add Sensor Modal
  const [sensorApi, setSensorApi] = useState("");
  const [sensorName, setSensorName] = useState("");
  const [rateLimit, setRateLimit] = useState("");
  const [desigoToken, setDesigoToken] = useState(""); // ✅ Store Desigo Token
  const [showInfoModal, setShowInfoModal] = useState(false); // 👁️ Controls info modal
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activateInterval, setActivateInterval] = useState("");
  const [activateBatch, setActivateBatch] = useState("");
  const [activeSensorIds, setActiveSensorIds] = useState([]);
  const [localSensorsWithAPI, setLocalSensorsWithAPI] = useState([]);





  // ✅ Fetch Desigo Token (Same as adminToken)


  const activateSensor = async () => {
    if (activeSensorIds.includes(selectedSensor.id)) {
      toast.error(`Sensor ${selectedSensor.name} is already activated.`);
      setShowActivateModal(false);
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");

      const payload = {
        sensorId: selectedSensor.id,
        interval_seconds: parseInt(activateInterval, 10),
        batch_size: parseInt(activateBatch, 10),
      };

      const response = await axios.post("http://localhost:5004/api/sensors/activate", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      toast.success(`Sensor ${selectedSensor.name} activated!`);

      // ✅ Update UI State
      setActiveSensorIds([...activeSensorIds, selectedSensor.id]);
      setShowActivateModal(false);
      setActivateInterval("");
      setActivateBatch("");
      setSelectedSensor(null);
    } catch (error) {
      console.error("❌ Activation error:", error.response?.data || error.message);
      toast.error("Failed to activate sensor.");
    }
  };



  const deleteSensor = async (sensor) => {
    try {
      const token = localStorage.getItem("adminToken");

      await axios.delete(`http://localhost:5004/api/sensor/${sensor.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      toast.success(`Sensor ${sensor.name} deleted!`);
      setSensors((prev) => prev.filter((s) => s.id !== sensor.id));
    } catch (error) {
      console.error("❌ Delete error:", error.response?.data || error.message);
      toast.error("Failed to delete sensor.");
    }
  };

  useEffect(() => {
    const fetchDesigoToken = async () => {
      try {
        const token = localStorage.getItem("adminToken");

        if (!token) {
          toast.error("Session expired. Please log in again.");
          return;
        }

        const response = await axios.get("http://localhost:5004/api/sensor/desigo-token", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data && response.data.desigoToken) {
          setDesigoToken(response.data.desigoToken);
        } else {
          console.error("❌ Desigo Token Fetch Failed");
          toast.error("Failed to fetch Desigo Token.");
        }
      } catch (error) {
        console.error("❌ Error fetching Desigo Token:", error.response?.data || error.message);
      }
    };

    fetchDesigoToken();
  }, []);

  // ✅ Fetch Sensors
  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const token = localStorage.getItem("adminToken");

        if (!token) {
          toast.error("Session expired. Please log in again.");
          return;
        }

        const response = await axios.get("http://localhost:5004/api/sensor/", {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("✅ Raw API Response:", response.data);

        let extractedSensors = [];
        if (response.data.sensors) {
          if (Array.isArray(response.data.sensors)) {
            extractedSensors = response.data.sensors;
          } else if (Array.isArray(response.data.sensors.sensors)) {
            extractedSensors = response.data.sensors.sensors;
          }
        }

        if (extractedSensors.length > 0) {
          setSensors(extractedSensors);
        } else {
          console.error("❌ Unexpected API Response Format:", response.data);
          toast.error("Failed to load sensors.");
        }
      } catch (error) {
        console.error("❌ Error fetching sensors:", error.response?.data || error.message);
        toast.error("Failed to load sensors.");
      } finally {
        setLoading(false);
      }
    };

    fetchSensors();
  }, []);

  useEffect(() => {
    const fetchActiveSensors = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        const response = await axios.get("http://localhost:5004/api/sensors/active", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const ids = response.data?.sensors?.map(sensor => sensor.bank_id) || [];

        setActiveSensorIds(ids);
      } catch (error) {
        console.error("❌ Failed to fetch active sensors:", error.response?.data || error.message);
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


  // ✅ Add Sensor (with Desigo Token)
  const addSensor = async () => {
    if (!sensorApi || !sensorName || !rateLimit) {
      toast.error("All fields are required!");
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");

      const response = await axios.post(
        "http://localhost:5004/api/sensor/add",
        {
          sensorApi,
          sensorName,
          rateLimit: parseInt(rateLimit, 10),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Desigo-Authorization": `Bearer ${desigoToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ Sensor Add Response:", response.data);

      if (response.data?.message?.includes("successfully")) {
        toast.success("Sensor added successfully!");

        // ✅ Clear modal inputs and close
        setSensorApi("");
        setSensorName("");
        setRateLimit("");
        setShowAddModal(false);

        // ✅ Re-fetch updated sensor list
        const fetchUpdatedSensors = async () => {
          const updated = await axios.get("http://localhost:5004/api/sensor/", {
            headers: { Authorization: `Bearer ${token}` },
          });

          const updatedList = updated.data?.sensors?.sensors || updated.data?.sensors || [];
          setSensors(updatedList);
        };

        await fetchUpdatedSensors();
      } else {
        toast.error("Sensor added but UI update failed.");
      }
    } catch (error) {
      console.error("❌ Add Sensor Error:", error.response?.data || error.message);
      toast.error("Failed to add sensor.");
    }
  };



  // ✅ Show Sensor Info
  const showInfo = (sensor) => {
    // 🔍 Try to find the matching API using sensor.id
    const localMatch = localSensorsWithAPI.find((s) => s.id === sensor.id);

    // 🧠 Merge the API into the selected sensor object
    setSelectedSensor({ ...sensor, api_endpoint: localMatch?.api_endpoint || "Not Available" });

    // 👁️ Show the modal
    setShowInfoModal(true);
  };


  const openActivateModal = (sensor) => {
    setSelectedSensor(sensor);
    setShowActivateModal(true);
  };



  return (
    <div className="sensor-bank">
      <h2>Sensor Bank</h2>
      <div className="sensor-grid">
        {loading ? (
          <p>Loading sensors...</p>
        ) : sensors.length > 0 ? (
          sensors.map((sensor, index) => {
            if (!sensor) return null; // ✅ Skip if sensor is undefined

            return (
              <div key={sensor?.id || index} className="sensor-card">
                <p>
                  <strong>Name:</strong> {sensor?.name || "Unknown Sensor"}{" "}
                  {activeSensorIds.includes(sensor.id) && (
                    <span className="active-indicator" title="Sensor is active">✅</span>
                  )}
                </p>

                <p><strong>ID:</strong> {sensor?.id || "N/A"}</p>

                {/* ✅ Dropdown for actions */}
                <div className="dropdown">
                  <button className="dropdown-button">Options ▼</button>
                  <div className="dropdown-content">
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

        {/* ✅ "Add Sensor" Button - Opens Modal */}
        <div className="sensor-card add-sensor" onClick={() => setShowAddModal(true)}>
          <span className="plus-sign">+</span>
          <p className="add-text">Add Sensor</p>
        </div>
      </div>

      {/* ✅ Modal for adding new sensor */}
      {showAddModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Add New Sensor</h3>

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

      {showInfoModal && selectedSensor && (
        <div className="modal">
          <div className="modal-content">
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

      {showActivateModal && selectedSensor && (
        <div className="modal">
          <div className="modal-content">
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

export default SensorBank;
