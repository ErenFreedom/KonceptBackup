const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");

const app = express();
const PORT = 8085;
const SECRET_KEY = "desigo_secret"; // Must match token verification

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })); // ✅ Accept x-www-form-urlencoded

// ✅ Connect to SQLite
const db = new sqlite3.Database("./desigo_sensors.db", sqlite3.OPEN_READONLY, (err) => {
  if (err) console.error("❌ Failed to connect to DB:", err.message);
  else console.log("✅ Connected to desigo_sensors.db");
});

// ✅ Login route — x-www-form-urlencoded input, returns { access_token }
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  console.log("🧾 Received Login Form:", req.body);

  if (username === "admin" && password === "passwd") {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "6h" });
    console.log("✅ Dummy Desigo Token Issued:", token);
    return res.json({ access_token: token });
  }

  console.warn("❌ Invalid login attempt", { username, password });
  return res.status(401).json({ error: "Invalid credentials" });
});

// ✅ Middleware to validate token from Authorization header
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized: Token missing" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// ✅ Sensor API: Fetch latest sensor data by object path
app.get("/WSI/api/values/:objectPath", authenticateToken, (req, res) => {
  const objectPath = req.params.objectPath;
  const dotIndex = objectPath.lastIndexOf(".");
  if (dotIndex === -1) {
    return res.status(400).json({ error: "Invalid object path format" });
  }

  const objectId = "System1:" + objectPath.substring(0, dotIndex);
  const propertyName = objectPath.substring(dotIndex + 1);

  const query = `
    SELECT * FROM sensor_data
    WHERE object_id = ? AND property_name = ?
    ORDER BY timestamp DESC
    LIMIT 1;
  `;

  db.get(query, [objectId, propertyName], (err, row) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!row) return res.status(404).json({ error: "Sensor not found" });

    const response = [
      {
        DataType: row.data_type,
        Value: {
          Value: row.value,
          Quality: row.quality,
          QualityGood: !!row.quality_good,
          Timestamp: row.timestamp
        },
        OriginalObjectPropertyId: row.original_object_property_id,
        ObjectId: row.object_id,
        PropertyName: row.property_name,
        AttributeId: row.attribute_id,
        ErrorCode: row.error_code,
        IsArray: !!row.is_array
      }
    ];

    res.json(response);
  });
});

// ✅ Heartbeat API: Dummy responds with 200 OK
app.post("/WSI/api/Heartbeat", authenticateToken, (req, res) => {
  console.log("🔁 Heartbeat received from client.");
  res.status(200).send(); // No body needed, just OK
});

// ✅ Dev route: Inspect latest sensor rows
app.get("/api/dev/inspect", authenticateToken, (req, res) => {
  db.all(`SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 20`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Dummy Desigo Server running at http://localhost:${PORT}`);
});