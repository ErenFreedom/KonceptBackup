import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { FiActivity } from "react-icons/fi"; // ✅ Add heartbeat icon
import axios from "axios"; // ✅ We'll ping server
import "./Dashboard.css";
import logo from "../../assets/logo.png";
import Footer from "../../components/Footer/Footer";
import { FaUserCircle } from "react-icons/fa";
import SensorBank from "../../components/Dashboard/Sensorbank"; // ✅ Importing SensorBank
import ActiveSensor from "../../components/Dashboard/ActiveSensor"; // ✅ Importing ActiveSensor

const Dashboard = () => {
  const { id } = useParams(); // ✅ Extract Admin ID from URL
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [activeTab, setActiveTab] = useState("sensor-bank"); // ✅ Default to Sensor Bank view
  const [showDropdown, setShowDropdown] = useState(false);
  const [desigoHealth, setDesigoHealth] = useState(null); // ✅ null = unknown, true = healthy, false = disconnected

  useEffect(() => {
    const token = localStorage.getItem("adminToken");

    if (!token) {
      toast.error("Session expired. Please log in again.");
      navigate("/login");
      return;
    }

    try {
      const decoded = jwtDecode(token);

      console.log("🔍 Decoded Token Data:", decoded);
      console.log("🔍 URL Admin ID:", id);

      if (decoded.adminId.toString() !== id.toString()) {
        console.error("❌ Unauthorized access! Token ID does not match URL ID.");
        toast.error("Unauthorized access!");
        localStorage.removeItem("adminToken");
        navigate("/login");
        return;
      }


      setAdmin({
        id: decoded.adminId,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
      });

    } catch (error) {
      console.error("❌ Error decoding token:", error);
      toast.error("Invalid session. Please log in again.");
      localStorage.removeItem("adminToken");
      navigate("/login");
    }
  }, [id, navigate]);

  useEffect(() => {
    const checkDesigoHealth = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/desigo/heartbeat`);
        if (res.status === 200) {
          setDesigoHealth(true); // ✅ Trust 200 regardless of body
        } else {
          setDesigoHealth(false);
        }
      } catch (error) {
        console.error("Failed to check Desigo health:", error.message);
        setDesigoHealth(false);
      }
    };

    checkDesigoHealth(); // Initial
    const interval = setInterval(checkDesigoHealth, 10000); // every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (!admin) return <p>Loading Dashboard...</p>;

  return (
    <div className="dashboard-page">
      {/* ✅ Header Section */}
      <header className="dashboard-header">
        <div className="dashboard-logo-container">
          <img src={logo} alt="Logo" className="dashboard-logo" />
        </div>

        {/* ✅ Right Side - Profile Icon & Home */}
        <div className="dashboard-button-container">
          <div className="dashboard-profile-wrapper">
            <FaUserCircle
              className="dashboard-profile-icon"
              onClick={() => setShowDropdown(prev => !prev)}
            />

            {showDropdown && (
              <div className="dashboard-dropdown">
                <button
                  className="dashboard-dropdown-item"
                  onClick={() => {
                    localStorage.removeItem("adminToken");
                    localStorage.removeItem("desigoToken");
                    toast.success("Logged out successfully.");
                    navigate("/login");
                  }}
                >
                  🚪 Logout
                </button>
                <button
                  className="dashboard-dropdown-item"
                  onClick={() => toast.info("Edit Info coming soon.")}
                >
                  ✏️ Edit Info
                </button>
              </div>
            )}


          </div>

          <div className="dashboard-health-indicator" title="Desigo Server Health">
            <FiActivity
              className={`heartbeat-icon ${desigoHealth === true ? "healthy" : desigoHealth === false ? "unhealthy" : ""}`}
            />
          </div>
          <button className="dashboard-button" onClick={() => navigate("/")}>Home</button>
        </div>
      </header>

      {/* ✅ Welcome Text */}
      <div className="dashboard-content">
        <h2 className="dashboard-title">Welcome, {admin.firstName}!</h2>

        {/* ✅ Navigation Buttons */}
        <div className="dashboard-nav">
          <button
            className={`dashboard-nav-button ${activeTab === "sensor-bank" ? "active" : ""}`}
            onClick={() => setActiveTab("sensor-bank")}
          >
            Sensor Bank
          </button>
          <button
            className={`dashboard-nav-button ${activeTab === "active-sensors" ? "active" : ""}`}
            onClick={() => setActiveTab("active-sensors")}
          >
            Active Sensors
          </button>
        </div>

        {/* ✅ Page Content Switching */}
        <div className="dashboard-page-content">
          {activeTab === "sensor-bank" ? (
            <SensorBank /> // ✅ Display SensorBank component when active
          ) : (
            <ActiveSensor /> // ✅ Display ActiveSensor component when active
          )}
        </div>
      </div>

      {/* ✅ Footer Section */}
      <Footer />
    </div>
  );
};

export default Dashboard;
