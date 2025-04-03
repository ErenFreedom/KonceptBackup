const axios = require("axios");
const db = require("../db/localDB"); // Import Local SQLite DB
require("dotenv").config();
const https = require("https");
const crypto = require("crypto");

/** ✅ Fetch Token from Desigo Server and Store in Local DB */
const saveDesigoToken = async (req, res) => {
    try {
        const { username, token } = req.body;

        if (!username || !token) {
            return res.status(400).json({ message: "Username and Token are required" });
        }

        const createdAt = new Date().toISOString(); 
        const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(); // +6h

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        console.log("📝 Saving Desigo Token for:", username);
        console.log("🔑 Token Length:", token.length);
        console.log("🔐 Token Hash:", tokenHash);

        // ✅ Serialize DB operations to prevent overlapping executions
        db.serialize(() => {
            db.run(`DELETE FROM DesigoAuthTokens`, function (err) {
                if (err) {
                    console.error("❌ Failed to delete old token:", err.message);
                    return res.status(500).json({ message: "DB error: Token delete" });
                }

                db.run(
                    `INSERT INTO DesigoAuthTokens (username, token, expires_at, created_at) VALUES (?, ?, ?, ?)`,
                    [username, token, expiresAt, createdAt],
                    function (err) {
                        if (err) {
                            console.error("❌ Failed to insert token:", err.message);
                            return res.status(500).json({ message: "DB error: Token insert", error: err.message });
                        }

                        // ✅ Read back for verification
                        db.get(`SELECT token FROM DesigoAuthTokens WHERE username = ?`, [username], (err, row) => {
                            if (err || !row) {
                                return res.status(500).json({ message: "Failed to fetch token for validation" });
                            }

                            const storedToken = row.token;
                            const storedTokenHash = crypto.createHash('sha256').update(storedToken).digest('hex');

                            console.log("📦 Stored Token Length:", storedToken.length);
                            console.log("📦 Stored Token Hash:", storedTokenHash);

                            if (storedToken === token) {
                                console.log("✅ Token matched exactly after DB insert!");
                            } else {
                                console.warn("❌ Token mismatch after DB insert!");
                            }

                            return res.status(200).json({ message: "Token stored and verified." });
                        });
                    }
                );
            });
        });

    } catch (error) {
        console.error("❌ Error saving token:", error.message);
        return res.status(500).json({ message: "Internal error", error: error.message });
    }
};




const getDesigoAuthToken = async (req, res) => {
    try {
        const { apiUrl, username, password } = req.body;

        if (!apiUrl || !username || !password) {
            return res.status(400).json({ message: "API URL, Username, and Password are required" });
        }

        console.log("🔍 Requesting token from Desigo Server:", apiUrl);

        // ✅ Ignore self-signed SSL certs (for local Desigo servers)
        const agent = new https.Agent({
            rejectUnauthorized: false
        });

        const formData = `grant_type=password&username=${username}&password=${password}`;

        const response = await axios.post(apiUrl, formData, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            httpsAgent: agent // ✅ Important!
        });

        if (!response.data || !response.data.access_token) {
            return res.status(500).json({ message: "Invalid response from Desigo server" });
        }

        const accessToken = response.data.access_token;
        console.log("✅ Desigo Token Received:", accessToken);

        res.status(200).json({ message: "Token retrieved successfully", accessToken });
    } catch (error) {
        console.error("❌ Error fetching Desigo token:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            message: "Failed to fetch token",
            error: error.response?.data || error.message
        });
    }
};

/** ✅ Retrieve the latest Desigo Token */
const getStoredDesigoToken = async (req, res) => {
    try {
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({ message: "Username is required" });
        }

        db.get(`SELECT token, expires_at FROM DesigoAuthTokens WHERE username = ?`, [username], (err, row) => {
            if (err) {
                console.error("❌ Error retrieving Desigo token:", err.message);
                return res.status(500).json({ message: "Database error", error: err.message });
            }
            if (!row) {
                return res.status(404).json({ message: "No token found for this user" });
            }

            res.status(200).json({ token: row.token, expiresAt: row.expires_at });
        });
    } catch (error) {
        console.error("❌ Error retrieving stored token:", error.message);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

/** ✅ Delete the stored Desigo Token */
const deleteDesigoToken = async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ message: "Username is required" });
        }

        db.run(`DELETE FROM DesigoAuthTokens WHERE username = ?`, [username], (err) => {
            if (err) {
                console.error("❌ Error deleting Desigo token:", err.message);
                return res.status(500).json({ message: "Database error", error: err.message });
            }
            res.status(200).json({ message: "Token deleted successfully" });
        });
    } catch (error) {
        console.error("❌ Error deleting token:", error.message);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

module.exports = {
    getDesigoAuthToken,
    getStoredDesigoToken,
    deleteDesigoToken,
    saveDesigoToken ,
};
