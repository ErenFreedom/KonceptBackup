const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config();

// ✅ Correct database path
const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
console.log(`📌 Using database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Error opening database:", err.message);
});

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
const verifyAuthToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token

        if (!token) {
            console.error("❌ Token missing in request");
            return res.status(401).json({ message: "Unauthorized: Token missing" });
        }

        //console.log(`🔍 Received Token from Request: ${token}`); // Debugging

        // ✅ Fetch stored JWT from localDB
        let storedToken;
        try {
            storedToken = await getStoredToken();
        } catch (error) {
            return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
        }

        // ✅ Allow access if a token exists
        //console.log(`✅ Token exists in DB. Allowing request.`);
        req.user = { token: storedToken }; // Just attach token reference (no verification)
        next();
    } catch (error) {
        console.error("❌ Authentication failed:", error.message);
        res.status(403).json({ message: "Forbidden: Invalid or expired token" });
    }
};

module.exports = { verifyAuthToken };
