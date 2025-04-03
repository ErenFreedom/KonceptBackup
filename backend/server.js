const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
require('./AppDb');


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5004;

/** ✅ Proper CORS Middleware Setup */
const corsOptions = {
  origin: '*', // ⚠️ Use specific origins in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-desigo-token',
    'Desigo-Authorization' // ✅ This is the missing header that caused the issue
  ],
  credentials: true,
  optionsSuccessStatus: 204
};

// ✅ Apply CORS middleware before all routes
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // ✅ Handle all preflight OPTIONS requests

// ✅ Parse JSON
app.use(express.json());

/** ✅ Import Routes */
const cloudAdminAuthRoutes = require("./routes/cloudAdminAuthRoutes");
const cloudStaffAuthRoutes = require("./routes/cloudStaffAuthRoutes");
const sensorRoutes = require("./routes/sensorRoutes");
const activateSensorRoutes = require("./routes/activateSensorRoutes");
const syncSensorIdsRoutes = require("./routes/syncSensorIdsRoutes");
const sensorDataRoutes = require("./routes/sensorDataRoutes");
const fetchSensorDataRoutes = require("./routes/fetchSensorDataRoutes");
const sendSensorDataRoutes = require("./routes/sendSensorDataRoutes");
const desigoAuthRoutes = require("./routes/desigoAuthRoutes");
const logRoutes = require("./routes/logRoutes");
const intervalStatusRoutes = require("./routes/intervalStatusRoutes");

/** ✅ Use Routes */
app.use("/api/admin/auth", cloudAdminAuthRoutes);
app.use("/api/staff/auth", cloudStaffAuthRoutes);
app.use("/api/sensor", sensorRoutes);
app.use("/api/sensors", activateSensorRoutes);
app.use("/api", syncSensorIdsRoutes);
app.use("/api/local", sensorDataRoutes);
app.use("/api/local", fetchSensorDataRoutes);
app.use("/api/connector-data", sendSensorDataRoutes);
app.use("/api/desigo/auth", desigoAuthRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/connector-data", intervalStatusRoutes);

/** ✅ Health Check */
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Connector App Backend is running!' });
});

/** ✅ Start Server */
app.listen(PORT, () => {
  console.log(`✅ Connector App Backend is running on http://localhost:${PORT}`);
});
