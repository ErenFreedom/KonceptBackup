const axios = require("axios");
const db = require("../db/localDB"); // Import Local DB
require("dotenv").config();

/** ✅ Send OTP for Admin Login via Cloud API */
const sendAdminAppLoginOtp = async (req, res) => {
    try {
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/app/auth/send-otp`;
        const response = await axios.post(cloudApiUrl, req.body);

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("❌ Error sending OTP:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            message: "Failed to send OTP",
            error: error.response?.data || error.message
        });
    }
};

/** ✅ Authenticate Admin via Cloud API & Store Token Locally */
const verifyAdminAppLoginOtp = async (req, res) => {
    try {
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/app/auth/verify-otp`;
        const response = await axios.post(cloudApiUrl, req.body);

        const accessToken = response.data.accessToken;

        // ✅ Save token in local database
        db.run(`DELETE FROM AuthTokens`); // Remove old token
        db.run(`INSERT INTO AuthTokens (token) VALUES (?)`, [accessToken]);

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("❌ Error verifying OTP:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            message: "Failed to verify OTP",
            error: error.response?.data || error.message
        });
    }
};

/** ✅ Refresh Admin Access Token via Cloud API */
const refreshAdminAppToken = async (req, res) => {
    try {
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/app/auth/refresh-token`;
        const response = await axios.post(cloudApiUrl, req.body);

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("❌ Error refreshing token:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            message: "Failed to refresh token",
            error: error.response?.data || error.message
        });
    }
};

/** ✅ Logout Admin via Cloud API */
const logoutAdminApp = async (req, res) => {
    try {
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/app/auth/logout`;
        const response = await axios.post(cloudApiUrl, req.body);

        // ✅ Remove token from local database
        db.run(`DELETE FROM AuthTokens`);

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("❌ Error logging out:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            message: "Failed to logout",
            error: error.response?.data || error.message
        });
    }
};

module.exports = {
    sendAdminAppLoginOtp,
    verifyAdminAppLoginOtp,
    refreshAdminAppToken,
    logoutAdminApp
};
