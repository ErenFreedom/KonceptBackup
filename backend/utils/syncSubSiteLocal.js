const axios = require("axios");
const jwt = require("jsonwebtoken");
const { db } = require("../db/sensorDB");
require("dotenv").config();

const CLOUD_API_URL = process.env.CLOUD_API_URL;

const syncAllSubSites = async () => {
    try {
        db.get(`SELECT token FROM AuthTokens ORDER BY id DESC LIMIT 1`, async (err, row) => {
            if (err || !row) {
                console.error("❌ No valid token found in AuthTokens");
                return;
            }

            const accessToken = row.token;

            let decoded;
            try {
                decoded = jwt.verify(accessToken, process.env.JWT_SECRET_APP);
            } catch (verifyErr) {
                console.error("❌ JWT verification failed:", verifyErr.message);
                return;
            }

            const companyId = decoded.companyId || decoded.company_id;

            const response = await axios.get(`${CLOUD_API_URL}/api/subsite/cloud/sync/subsite-db`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            for (const subsite of response.data.result) {
                const { subsiteId, sensorBank, activeSensors, sensorApis, sensorDataBankIds } = subsite;

                const bankTable = `SensorBank_${companyId}_${subsiteId}`;
                const sensorTable = `Sensor_${companyId}_${subsiteId}`;
                const apiTable = `SensorAPI_${companyId}_${subsiteId}`;

                db.serialize(() => {
                    // Create main 3 tables
                    db.run(`CREATE TABLE IF NOT EXISTS ${bankTable} (
                        id INTEGER PRIMARY KEY,
                        name TEXT,
                        description TEXT,
                        object_id TEXT UNIQUE,
                        property_name TEXT,
                        data_type TEXT,
                        is_active BOOLEAN,
                        room_id INTEGER,
                        created_at TEXT,
                        updated_at TEXT,
                        subsite_id INTEGER
                    );`);

                    db.run(`CREATE TABLE IF NOT EXISTS ${sensorTable} (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        bank_id INTEGER NOT NULL UNIQUE,
                        mode TEXT CHECK( mode IN ('real_time', 'manual') ) DEFAULT 'manual',
                        interval_seconds INTEGER CHECK( interval_seconds >= 5 AND interval_seconds <= 100 ) DEFAULT 5,
                        batch_size INTEGER DEFAULT 5,
                        is_active BOOLEAN DEFAULT 1,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (bank_id) REFERENCES ${bankTable}(id) ON DELETE CASCADE
                    );`);

                    db.run(`CREATE TABLE IF NOT EXISTS ${apiTable} (
                        id INTEGER PRIMARY KEY,
                        sensor_id INTEGER,
                        api_endpoint TEXT,
                        created_at TEXT,
                        FOREIGN KEY (sensor_id) REFERENCES ${bankTable}(id) ON DELETE CASCADE
                    );`);

                    // Create IntervalControl table per subsite
                    const intervalControlTable = `IntervalControl_${companyId}_${subsiteId}`;
                    db.run(`
                      CREATE TABLE IF NOT EXISTS ${intervalControlTable} (
                        sensor_id INTEGER PRIMARY KEY,
                        is_fetching INTEGER DEFAULT 0,
                        is_sending INTEGER DEFAULT 0,
                        FOREIGN KEY (sensor_id) REFERENCES ${sensorTable}(id) ON DELETE CASCADE
                      );
                    `, (err) => {
                        if (err) console.error(`❌ Failed to create ${intervalControlTable}:`, err.message);
                    });



                    // Insert into SensorBank table
                    for (const row of sensorBank) {
                        db.run(`INSERT OR IGNORE INTO ${bankTable} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [row.id, row.name, row.description, row.object_id, row.property_name, row.data_type, row.is_active, row.room_id, row.created_at, row.updated_at, subsiteId],
                            (err) => {
                                if (err) console.error(`❌ Insert failed [SensorBank ${subsiteId}]:`, err.message);
                            });
                    }

                    // Insert into Sensor table
                    for (const row of activeSensors) {
                        db.run(
                            `INSERT OR IGNORE INTO ${sensorTable} 
                            (id, bank_id, is_active, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?)`,
                            [row.id, row.bank_id, row.is_active, row.created_at, row.updated_at],
                            (err) => {
                                if (err) console.error(`❌ Insert failed [Sensor ${subsiteId}]:`, err.message);
                            }
                        );
                    }

                    // Insert into SensorAPI table
                    for (const row of sensorApis) {
                        db.run(`INSERT OR IGNORE INTO ${apiTable} VALUES (?, ?, ?, ?)`,
                            [row.id, row.sensor_id, row.api_endpoint, row.created_at],
                            (err) => {
                                if (err) console.error(`❌ Insert failed [SensorAPI ${subsiteId}]:`, err.message);
                            });
                    }
                });

                // Create SensorData tables (empty rows)
                for (const bankId of sensorDataBankIds) {
                    const tableName = `SensorData_${companyId}_${subsiteId}_${bankId}`;
                    db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        sensor_id INTEGER NOT NULL,
                        value TEXT,
                        quality TEXT,
                        quality_good BOOLEAN,
                        timestamp TEXT NOT NULL,
                        FOREIGN KEY (sensor_id) REFERENCES ${sensorTable}(bank_id) ON DELETE CASCADE
                    );`, (err) => {
                        if (err) console.error(`❌ Failed to create table ${tableName}:`, err.message);
                    });
                }

                console.log(`✅ Synced sub-site ${subsiteId} (SensorBank: ${sensorBank.length}, ActiveSensors: ${activeSensors.length}, APIs: ${sensorApis.length})`);
            }
        });
    } catch (err) {
        console.error("❌ Sub-site sync failed:", err.message);
    }
};

module.exports = { syncAllSubSites };