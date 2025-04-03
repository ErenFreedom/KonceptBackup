import React from "react";
import "./Footer.css";
import { FaTwitter, FaInstagram, FaEnvelope } from "react-icons/fa"; // Importing icons

const Footer = () => {
  return (
    <footer className="footer">
      <h2>Contact Us</h2>
      <div className="social-icons">
        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
          <FaTwitter className="icon" />
        </a>
        <a href="mailto:your-email@example.com">
          <FaEnvelope className="icon" />
        </a>
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
          <FaInstagram className="icon" />
        </a>
      </div>
    </footer>
  );
};

export default Footer;
