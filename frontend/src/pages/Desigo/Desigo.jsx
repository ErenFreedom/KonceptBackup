import React, { useState } from "react";
import "./Desigo.css";
import logo from "../../assets/logo.png";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle } from "react-icons/fa";
import axios from "axios";
import { jwtDecode } from "jwt-decode"; // ✅ Import JWT Decoder
import Footer from "../../components/Footer/Footer";

const Desigo = () => {
    const navigate = useNavigate();
    const [apiUrl, setApiUrl] = useState(""); // ✅ API URL Field
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);
    const [errorMessage, setErrorMessage] = useState(""); // ✅ Error Handling

    /** ✅ Function to store token in local DB */
    const storeTokenInDB = async (token, usernameToStore) => {
        try {
            console.log("📤 Attempting to store token in local DB...");
            console.log("🔐 Token length:", token.length);
            console.log("👤 Username being sent:", usernameToStore);
    
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/desigo/auth/save-token`, {
                username: usernameToStore,
                token
            });
    
            console.log("✅ Token stored in local DB successfully!", response.data);
        } catch (error) {
            console.error("❌ Failed to store token in DB:", error.response?.data || error.message);
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
            console.log("🌐 Sending token request to API URL:", apiUrl);
    
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/desigo/auth/get-token`, {
                apiUrl,
                username,
                password
            });
    
            console.log("✅ Authentication Successful:", response.data);
    
            const token = response.data.accessToken || response.data.access_token;
            console.log("🔐 Received Token:", token);
    
            localStorage.setItem("desigoToken", token);
            localStorage.setItem("desigoUsername", username);
    
            // ✅ Explicitly pass username
            await storeTokenInDB(token, username);
    
            setAuthenticated(true);
            setLoading(false);
    
            const storedToken = localStorage.getItem("adminToken");
            if (storedToken) {
                const decoded = jwtDecode(storedToken);
                console.log("🔓 Decoded Admin Token:", decoded);
                console.log("📍 Navigating to dashboard with Admin ID:", decoded.adminId);
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
                    <input
                        type="text"
                        placeholder="Desigo CC API URL"
                        className="desigo-input"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Desigo CC Username"
                        className="desigo-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Desigo CC Password"
                        className="desigo-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    {errorMessage && <p className="error-text">{errorMessage}</p>}

                    {authenticated ? (
                        <button className="desigo-auth-button" onClick={() => navigate("/dashboard")}>Proceed to Dashboard</button>
                    ) : (
                        <button className="desigo-auth-button" onClick={handleAuthenticate} disabled={loading}>
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
