const axios = require("axios");
const db = require("../db/localDB"); // Import Local DB
require("dotenv").config();

/** ✅ Send OTP for Staff Login via Cloud API */
const sendStaffAppLoginOtp = async (req, res) => {
    try {
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/staff/app/auth/send-otp`;
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

/** ✅ Authenticate Staff via Cloud API & Store Token Locally */
const verifyStaffAppLoginOtp = async (req, res) => {
    try {
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/staff/app/auth/verify-otp`;
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

/** ✅ Refresh Staff Access Token via Cloud API */
const refreshStaffAppToken = async (req, res) => {
    try {
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/staff/app/auth/refresh-token`;
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

/** ✅ Logout Staff via Cloud API */
const logoutStaffApp = async (req, res) => {
    try {
        const cloudApiUrl = `${process.env.CLOUD_API_URL}/api/staff/app/auth/logout`;
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
    sendStaffAppLoginOtp,
    verifyStaffAppLoginOtp,
    refreshStaffAppToken,
    logoutStaffApp
};
