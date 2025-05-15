const sqlite3 = require("sqlite3").verbose();
const dbPath = require("./dbPath"); // ✅ Import shared DB path

// ✅ Open or create the SQLite DB at AppData
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Error opening database:", err.message);
    } else {
        console.log("✅ Local database connected.");
    
        // ✅ Enable foreign keys
        db.run("PRAGMA foreign_keys = ON", (err) => {
            if (err) console.error("❌ Failed to enable foreign keys:", err.message);
            else console.log("🔗 Foreign key enforcement is ON");
        });
    }
});

const createSensorBankTable = `
    CREATE TABLE IF NOT EXISTS LocalSensorBank (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT NULL,
        object_id TEXT UNIQUE NOT NULL,
        property_name TEXT NOT NULL,
        data_type TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 0,
        room_id INTEGER DEFAULT NULL,  -- ✅ Purely informational
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

// ✅ Create `LocalActiveSensors` Table
const createActiveSensorsTable = `
    CREATE TABLE IF NOT EXISTS LocalActiveSensors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_id INTEGER NOT NULL UNIQUE,  -- ✅ Add UNIQUE here!
        mode TEXT CHECK( mode IN ('real_time', 'manual') ) NOT NULL,
        interval_seconds INTEGER CHECK( interval_seconds >= 5 AND interval_seconds <= 100 ),
        batch_size INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bank_id) REFERENCES LocalSensorBank(id) ON DELETE CASCADE
    );
`;

// ✅ Create `LocalSensorAPIs` Table (MODIFIED to include created_at)
const createSensorAPITable = `
    CREATE TABLE IF NOT EXISTS LocalSensorAPIs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id INTEGER NOT NULL,
        api_endpoint TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sensor_id) REFERENCES LocalSensorBank(id) ON DELETE CASCADE
    );
`;

// ✅ Create `DesigoAuthTokens` Table
const createDesigoAuthTable = `
    CREATE TABLE IF NOT EXISTS DesigoAuthTokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

// ✅ Create `SensorLogs` Table
const createSensorLogsTable = `
    CREATE TABLE IF NOT EXISTS SensorLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id INTEGER NOT NULL,
        log TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sensor_id) REFERENCES LocalActiveSensors(bank_id) ON DELETE CASCADE
    );
`;


// ✅ Create Trigger for `updated_at` Column
const createUpdateTrigger = `
    CREATE TRIGGER IF NOT EXISTS update_timestamp
    AFTER UPDATE ON LocalSensorBank
    FOR EACH ROW
    BEGIN
        UPDATE LocalSensorBank SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
`;

const createUpdateTriggerActive = `
    CREATE TRIGGER IF NOT EXISTS update_timestamp_active
    AFTER UPDATE ON LocalActiveSensors
    FOR EACH ROW
    BEGIN
        UPDATE LocalActiveSensors SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
`;

// ✅ Execute Table Creation
db.serialize(() => {
    db.run(createSensorBankTable, (err) => {
        if (err) console.error("❌ Error creating LocalSensorBank:", err.message);
        else console.log("✅ LocalSensorBank table created (or already exists).");
    });

    db.run(createActiveSensorsTable, (err) => {
        if (err) console.error("❌ Error creating LocalActiveSensors:", err.message);
        else console.log("✅ LocalActiveSensors table created (or already exists).");
    });

    db.run(createSensorAPITable, (err) => {
        if (err) console.error("❌ Error creating LocalSensorAPIs:", err.message);
        else console.log("✅ LocalSensorAPIs table created (or already exists).");
    });

    db.run(createUpdateTrigger, (err) => {
        if (err) console.error("❌ Error creating update trigger:", err.message);
        else console.log("✅ Update trigger for LocalSensorBank created.");
    });

    db.run(createUpdateTriggerActive, (err) => {
        if (err) console.error("❌ Error creating update trigger:", err.message);
        else console.log("✅ Update trigger for LocalActiveSensors created.");
    });

    db.run(createDesigoAuthTable, (err) => {
        if (err) console.error("❌ Error creating DesigoAuthTokens:", err.message);
        else console.log("✅ DesigoAuthTokens table created (or already exists).");
    });

    db.run(createSensorLogsTable, (err) => {
        if (err) console.error("❌ Error creating SensorLogs:", err.message);
        else console.log("✅ SensorLogs table created (or already exists).");
    });

});

// ✅ Function to Create `SensorData_<SensorID>` Table Dynamically
const createSensorDataTable = async (companyId, sensorId) => {
    return new Promise((resolve, reject) => {
        const tableName = `SensorData_${companyId}_${sensorId}`;
        console.log(`📌 Creating local sensor data table: ${tableName}`);

        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sensor_id INTEGER NOT NULL,
                value TEXT NOT NULL,
                quality TEXT NOT NULL,
                quality_good BOOLEAN NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                sent_to_cloud BOOLEAN DEFAULT 0,
                FOREIGN KEY (sensor_id) REFERENCES LocalActiveSensors(id) ON DELETE CASCADE
            );
        `;

        db.run(createTableSQL, (err) => {
            if (err) {
                console.error(`❌ Error creating ${tableName}:`, err.message);
                reject(err);
            } else {
                console.log(`✅ Table ${tableName} created.`);
                resolve();
            }
        });
    });
};


// ✅ Export the Database Instance & Function
module.exports = {
    db,
    createSensorDataTable,
};
