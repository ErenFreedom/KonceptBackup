import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
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
          <FaUserCircle className="dashboard-profile-icon" />
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
