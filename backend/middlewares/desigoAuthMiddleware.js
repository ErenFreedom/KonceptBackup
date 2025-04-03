const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// ✅ Load Local Database
const dbPath = path.resolve(__dirname, "../db/localDB.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Error opening database:", err.message);
});

// ✅ Middleware to Verify Desigo Auth Token
const verifyDesigoAuthToken = (req, res, next) => {
    const desigoAuthHeader = req.headers["desigo-authorization"];
    const token = desigoAuthHeader && desigoAuthHeader.split(" ")[1];

    if (!token) {
        console.error("❌ No Desigo token provided in the request.");
        return res.status(401).json({ error: "Unauthorized: No Desigo Token Provided" });
    }

    console.log(`🔍 Received Desigo Token from Request: ${token}`);

    db.get("SELECT token, expires_at FROM DesigoAuthTokens WHERE token = ?", [token], (err, row) => {
        if (err) {
            console.error("❌ Database error:", err.message);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        if (!row) {
            console.error("❌ Token not found in database. Possible mismatch or expired login.");
            return res.status(403).json({ error: "Forbidden: Invalid Token" });
        }

        const tokenExpirationUTC = Date.parse(row.expires_at);
        const nowUTC = Date.now();

        console.log(`🕒 Current UTC Time: ${new Date().toISOString()}`);
        console.log(`🔍 Expiration Check: ${tokenExpirationUTC} vs ${nowUTC}`);

        if (isNaN(tokenExpirationUTC) || nowUTC >= tokenExpirationUTC) {
            console.error("❌ Token expired.");
            return res.status(403).json({ error: "Forbidden: Token Expired" });
        }

        // ✅ Valid token, attach it to the request
        req.desigoToken = token;
        next();
    });
};

module.exports = { verifyDesigoAuthToken };
