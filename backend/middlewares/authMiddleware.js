
require("dotenv").config();

const  db  = require("../db/localDB"); // or sensorDB if that's where AuthTokens is

/** ✅ Function to Fetch Latest Token from Local DB */
const getStoredToken = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1", [], (err, row) => {
            if (err) {
                console.error("❌ Error fetching token:", err.message);
                return reject("Database Error");
            }
            if (!row || !row.token) {
                console.error("❌ No stored token found.");
                return reject("No stored token found.");
            }
            resolve(row.token);
        });
    });
};

/** ✅ Middleware: Only Check if Token Exists */
/** ✅ Middleware: Check if provided token matches stored token */
const verifyAuthToken = async (req, res, next) => {
    try {
        const rawAuthHeader = req.headers.authorization;

        if (!rawAuthHeader) {
            console.error("❌ No Authorization header received.");
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        // ✅ Accept either "Bearer <token>" or raw token
        const token = rawAuthHeader.startsWith("Bearer ")
            ? rawAuthHeader.split(" ")[1]
            : rawAuthHeader;

        if (!token) {
            console.error("❌ Token extraction failed from Authorization header.");
            return res.status(401).json({ message: "Unauthorized: Invalid token format" });
        }

        // ✅ Fetch latest stored token from local DB
        let storedToken;
        try {
            storedToken = await getStoredToken();
        } catch (err) {
            console.error("❌ Could not retrieve stored token from DB:", err);
            return res.status(500).json({ message: "Server error while verifying token" });
        }

        if (storedToken !== token) {
            console.warn("❌ Provided token does not match stored token.");
            return res.status(401).json({ message: "Unauthorized: Token mismatch" });
        }

        // ✅ Token matches DB, continue
        req.user = { token }; // attach raw token if needed later
        next();
    } catch (error) {
        console.error("❌ Token verification failed:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { verifyAuthToken };
