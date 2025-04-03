import React, { useState, useEffect } from "react";
import "./Login.css";
import logo from "../../assets/logo.png";
import Login1 from "../../assets/Login1.jpeg";
import Login2 from "../../assets/Login2.jpg";
import Login3 from "../../assets/Login3.png";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle } from "react-icons/fa";
import axios from "axios";
import Footer from "../../components/Footer/Footer";

const Login = () => {
    const navigate = useNavigate();
    const images = [Login1, Login2, Login3];
    const texts = [
        "AI-Powered Secure Authentication",
        "Seamless Multi-Factor Login Experience",
        "Fast & Encrypted Data Processing"
    ];
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [buttonText, setButtonText] = useState("Login");

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    /** ✅ Handle Login (Send OTP) */
    const handleLogin = async () => {
        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }

        setLoading(true);
        setButtonText("Processing...");

        try {
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/admin/auth/send-otp`, {
                identifier: email,
                password
            });

            console.log("✅ OTP Sent Successfully:", response.data);
            setLoading(false);
            setSuccess(true);
            setButtonText("Proceed to Verify OTP");

            // ✅ Store email temporarily
            localStorage.setItem("identifier", email);

            // ✅ Store the received token in localStorage
            if (response.data.token) {
                localStorage.setItem("adminToken", response.data.token);
                console.log("🔐 Admin Token Stored:", response.data.token);
            }

            // ✅ Redirect to OTP Verification Page
            setTimeout(() => {
                navigate("/otp-verification");
            }, 1500);
        } catch (error) {
            console.error("❌ Error Sending OTP:", error.response?.data || error.message);
            setLoading(false);
            setButtonText("Login");
            alert(error.response?.data?.message || "Failed to send OTP. Try again.");
        }
    };

    return (
        <div className="login-container">
            <header className="header">
                <div className="logo-container">
                    <img src={logo} alt="Logo" className="logo" />
                </div>
                <div className="button-container">
                    <button className="button-81" onClick={() => navigate("/")}>Home Page</button>
                    <button className="button-81">Sign Up</button>
                </div>
            </header>

            <div className="content">
                <div className="login-form">
                    <h2>Login</h2>
                    <div className="input-group">
                        <input 
                            type="email" 
                            placeholder="Enter Email" 
                            className="input-field" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <input 
                            type="password" 
                            placeholder="Enter Password" 
                            className="input-field" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button 
                        className="button-81" 
                        onClick={handleLogin}
                        disabled={loading}
                    >
                        {buttonText}
                    </button>

                    <div className="loading-success-container">
                        {loading && <div className="loading-spinner"></div>}
                        {success && (
                            <div className="success-container">
                                <FaCheckCircle className="success-icon" />
                                <span className="success-text">OTP Sent! Proceed to Verification</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="image-slideshow">
                    <img src={images[currentIndex]} alt="Slideshow" className="slideshow-image" />
                    <p className="slideshow-text">{texts[currentIndex]}</p>
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default Login;
