import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import "./HomePage.css";
import logo from "../../assets/logo.png";
import logo1 from "../../assets/logo1.png";
import logo2 from "../../assets/logo2.png";
import logo3 from "../../assets/logo3.png";
import Footer from "../../components/Footer/Footer";

const HomePage = () => {
  const navigate = useNavigate(); // Initialize navigate function

  const images = [logo1, logo2, logo3]; // Slideshow images
  const texts = [
    "Secure Connection Between Desigo CC and Cloud WebApp",
    "Automated Data Synchronization in Real-time",
    "Seamless and Reliable Data Transfer Middleware",
  ]; // Slideshow texts

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000); // Change every 3 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="home-container">
      {/* Header Section */}
      <header className="header">
        <div className="logo-container">
          <img src={logo} alt="Logo" className="logo" />
        </div>

        <div className="button-container">
          <button className="button-81" onClick={() => navigate("/login")}>Login</button>
          <button className="button-81">Sign Up</button>
        </div>
      </header>

      {/* Main Content - Slideshow */}
      <div className="content">
        {/* Left Side - Text Slideshow */}
        <div className="text-slideshow">
          <h2>{texts[currentIndex]}</h2>
        </div>

        {/* Right Side - Image Slideshow */}
        <div className="image-slideshow">
          <img src={images[currentIndex]} alt="Slideshow" className="slideshow-image" />
        </div>
      </div>

      {/* Footer Section */}
      <Footer />
    </div>
  );
};

export default HomePage;
