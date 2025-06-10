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
import SubsiteSensorBank from "../../components/Dashboard/SubsiteSensorBank";
import SubsiteActiveSensor from "../../components/Dashboard/SubsiteActiveSensor";

const Dashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [subSites, setSubSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState({ name: "Main Site", id: null });
  const [activeTab, setActiveTab] = useState("sensor-bank");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const [desigoHealth, setDesigoHealth] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");

    if (!token) {
      toast.error("Session expired. Please log in again.");
      navigate("/login");
      return;
    }

    try {
      const decoded = jwtDecode(token);

      if (decoded.adminId.toString() !== id.toString()) {
        toast.error("Unauthorized access!");
        localStorage.removeItem("adminToken");
        navigate("/login");
        return;
      }

      setAdmin({
        id: decoded.adminId,
        firstName: decoded.firstName,
        companyName: decoded.companyName,
      });

      setSubSites(decoded.subSites || []);
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
        setDesigoHealth(res.status === 200);
      } catch {
        setDesigoHealth(false);
      }
    };

    checkDesigoHealth();
    const interval = setInterval(checkDesigoHealth, 10000);
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

        {/* ✅ Site Switcher */}
        <div className="site-dropdown-container">
          <button className="site-dropdown-button" onClick={() => setShowSiteDropdown(prev => !prev)}>
            📍 {selectedSite.name}
          </button>
          {showSiteDropdown && (
            <div className="site-dropdown-list">
              <button onClick={() => setSelectedSite({ name: "Main Site", id: null })}>
                🌐 Main Site ({admin.companyName})
              </button>
              {subSites.map(site => (
                <button
                  key={site.subSiteId}
                  onClick={() => setSelectedSite({ name: site.subSiteName, id: site.subSiteId })}
                >
                  🏢 {site.subSiteName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ✅ Right Side - Profile & Health */}
        <div className="dashboard-button-container">
          <div className="dashboard-profile-wrapper">
            <FaUserCircle className="dashboard-profile-icon" onClick={() => setShowDropdown(prev => !prev)} />
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
                <button className="dashboard-dropdown-item" onClick={() => toast.info("Edit Info coming soon.")}>
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
            selectedSite.id
              ? <SubsiteSensorBank selectedSite={selectedSite} />
              : <SensorBank selectedSite={selectedSite} />
          ) : (
            selectedSite.id
              ? <SubsiteActiveSensor subsiteId={selectedSite.id} />
              : <ActiveSensor selectedSite={selectedSite} />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Dashboard;
