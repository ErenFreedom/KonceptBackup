const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");

const db = new sqlite3.Database("./desigo_sensors.db", (err) => {
  if (err) console.error("❌ Error opening database:", err.message);
  else console.log("✅ Connected to SQLite database.");
});

const SECRET_KEY = "desigo_secret"; // Must match server.js

// ✅ Define 15 Desigo-style sensors
const sensors = Array.from({ length: 15 }, (_, i) => {
  const index = i + 1;
  const name = `AI${index}`;
  const objectId = `ApplicationView_Logics_VirtualObjects_${name}`;
  return {
    id: index,
    name,
    objectId,
    propertyName: "Value"
  };
});

const generateSensorValue = (sensor) => ({
  sensor_id: sensor.id,
  data_type: "BasicFloat",
  value: (Math.random() * 100).toFixed(2),
  quality: Math.floor(Math.random() * 1e18).toString(),
  quality_good: Math.random() > 0.2,
  timestamp: new Date().toISOString(),
  original_object_property_id: `${sensor.objectId}.${sensor.propertyName}`,
  object_id: `System1:${sensor.objectId}`,
  property_name: sensor.propertyName,
  attribute_id: `System1:${sensor.objectId}.${sensor.propertyName}:_online.._value`,
  error_code: 0,
  is_array: false
});

db.serialize(() => {
  db.run("DROP TABLE IF EXISTS sensor_data");
  db.run("DROP TABLE IF EXISTS DesigoAuthTokens");

  db.run(`CREATE TABLE sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id INTEGER,
    data_type TEXT,
    value TEXT,
    quality TEXT,
    quality_good BOOLEAN,
    timestamp TEXT,
    original_object_property_id TEXT,
    object_id TEXT,
    property_name TEXT,
    attribute_id TEXT,
    error_code INTEGER,
    is_array BOOLEAN
  );`);

  db.run(`CREATE TABLE DesigoAuthTokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);

  const insertDataSQL = `INSERT INTO sensor_data (
    sensor_id, data_type, value, quality, quality_good, timestamp,
    original_object_property_id, object_id, property_name,
    attribute_id, error_code, is_array
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

  const stmt = db.prepare(insertDataSQL);
  sensors.forEach(sensor => {
    for (let i = 0; i < 100; i++) {
      const data = generateSensorValue(sensor);
      stmt.run(
        data.sensor_id, data.data_type, data.value, data.quality, data.quality_good,
        data.timestamp, data.original_object_property_id, data.object_id,
        data.property_name, data.attribute_id, data.error_code, data.is_array
      );
    }
  });
  stmt.finalize(() => console.log("✅ Sensor data inserted."));

  // ✅ Insert valid JWT token for testing
  const token = jwt.sign({ username: "admin" }, SECRET_KEY, { expiresIn: "6h" });
  db.run(
    `INSERT INTO DesigoAuthTokens (token, expires_at) VALUES (?, DATETIME('now', '+6 hours'))`,
    [token],
    (err) => {
      if (err) console.error("❌ Error inserting token:", err.message);
      else console.log("✅ Token inserted into DesigoAuthTokens.");
    }
  );

  db.close();
});