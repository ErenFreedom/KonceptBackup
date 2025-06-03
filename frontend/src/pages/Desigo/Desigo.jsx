import React, { useState } from "react";
import "./Desigo.css";
import logo from "../../assets/logo.png";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle } from "react-icons/fa";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import Footer from "../../components/Footer/Footer";


const Desigo = () => {
    const navigate = useNavigate();
    const [apiUrl, setApiUrl] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [dbSynced, setDbSynced] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [subsiteSyncing, setSubsiteSyncing] = useState(false);
    const [subsiteSynced, setSubsiteSynced] = useState(false); // ✅ NEW STATE

    /** ✅ Function to store token in local DB */
    const storeTokenInDB = async (token, usernameToStore) => {
        try {
            console.log("📤 Attempting to store token in local DB...");
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/desigo/auth/save-token`, {
                username: usernameToStore,
                token
            });
            console.log("✅ Token stored in local DB successfully!", response.data);
        } catch (error) {
            console.error("❌ Failed to store token in DB:", error.response?.data || error.message);
        }
    };

    /** ✅ Sync Local DB from Cloud */
    const syncLocalDB = async () => {
        const adminToken = localStorage.getItem("adminToken");
        if (!adminToken) return toast.error("No admin token found.");

        setSyncing(true);

        try {
            const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/local-db/sync/from-cloud`, {
                headers: {
                    Authorization: `Bearer ${adminToken}`
                }
            });

            console.log("✅ Cloud Sync Response:", response.data);
            toast.success("Local DB Synced Successfully ✅");
            setDbSynced(true);
        } catch (error) {
            console.error("❌ Sync failed:", error.response?.data || error.message);
            toast.error("DB Sync Failed ❌");
        } finally {
            setSyncing(false);
        }
    };

    /** ✅ Sync All Sub-site DBs */
    const syncSubsiteDBs = async () => {
        setSubsiteSyncing(true);
        try {
            const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/subsite/sync-all`);
            console.log("✅ Sub-site sync response:", response.data);
            toast.success("Sub-site DBs synced successfully ✅");
            setSubsiteSynced(true); // ✅ mark synced
        } catch (error) {
            console.error("❌ Sub-site sync failed:", error.response?.data || error.message);
            toast.error("Sub-site DB sync failed ❌");
        } finally {
            setSubsiteSyncing(false);
        }
    };

    const handleAuthenticate = async () => {
        if (!apiUrl || !username || !password) {
            setErrorMessage("Please enter all fields.");
            return;
        }

        setLoading(true);
        setErrorMessage("");
        console.log("🚀 Starting authentication process...");

        try {
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/desigo/auth/get-token`, {
                apiUrl,
                username,
                password
            });

            const token = response.data.accessToken || response.data.access_token;
            localStorage.setItem("desigoToken", token);
            localStorage.setItem("desigoUsername", username);

            await storeTokenInDB(token, username);

            setAuthenticated(true);
            setLoading(false);

            const storedToken = localStorage.getItem("adminToken");
            if (storedToken) {
                const decoded = jwtDecode(storedToken);
                navigate(`/dashboard/${decoded.adminId}`);
            }
        } catch (error) {
            console.error("❌ Authentication Failed:", error.response?.data || error.message);
            setErrorMessage(error.response?.data?.error || "Authentication failed");
            setLoading(false);
        }
    };

    return (
        <div className="desigo-page">
            <header className="desigo-header">
                <div className="desigo-logo-container">
                    <img src={logo} alt="Logo" className="desigo-logo" />
                </div>
                <div className="desigo-button-container">
                    <button className="desigo-button" onClick={() => navigate("/")}>Home</button>
                </div>
            </header>

            <div className="desigo-content">
                <h2 className="desigo-title">Authenticate Desigo CC</h2>
                <p className="desigo-subtext">Enter your API URL and credentials to request a token.</p>

                <div className="desigo-auth-form">
                    {/* ✅ Sync Local DB Button */}
                    <button
                        className="desigo-sync-button"
                        onClick={syncLocalDB}
                        disabled={syncing || dbSynced}
                    >
                        {syncing ? "Syncing..." : dbSynced ? "✔️ DB Synced" : "🔄 Sync Local DB"}
                    </button>

                    {/* ✅ Sync Sub-site DBs Button */}
                    <button
                        className="desigo-sync-button"
                        onClick={syncSubsiteDBs}
                        disabled={subsiteSyncing || subsiteSynced || !dbSynced}
                    >
                        {subsiteSyncing
                            ? "Syncing Sub-sites..."
                            : subsiteSynced
                                ? "✔️ Sub-sites Synced"
                                : "🔁 Sync Sub-site DBs"}
                    </button>

                    {(syncing || subsiteSyncing) && <div className="loading-spinner"></div>}

                    {/* ✅ Inputs are disabled until both syncs done */}
                    <input
                        type="text"
                        placeholder="Desigo CC API URL"
                        className="desigo-input"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        disabled={!dbSynced || !subsiteSynced}
                    />
                    <input
                        type="text"
                        placeholder="Desigo CC Username"
                        className="desigo-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={!dbSynced || !subsiteSynced}
                    />
                    <input
                        type="password"
                        placeholder="Desigo CC Password"
                        className="desigo-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={!dbSynced || !subsiteSynced}
                    />

                    {errorMessage && <p className="error-text">{errorMessage}</p>}

                    {authenticated ? (
                        <button className="desigo-auth-button" onClick={() => navigate("/dashboard")}>Proceed to Dashboard</button>
                    ) : (
                        <button
                            className="desigo-auth-button"
                            onClick={handleAuthenticate}
                            disabled={loading || !dbSynced || !subsiteSynced}
                        >
                            {loading ? "Authenticating..." : "Authenticate"}
                        </button>
                    )}

                    {loading && <div className="loading-spinner"></div>}
                    {authenticated && (
                        <div className="success-container">
                            <FaCheckCircle className="success-icon" />
                            <p className="success-text">Authentication Successful</p>
                        </div>
                    )}
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default Desigo;