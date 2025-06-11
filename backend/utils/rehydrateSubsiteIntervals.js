const { db } = require("../db/sensorDB");
const intervalManager = require("./intervalManagerSubSite");
const { insertSubsiteLog } = require("./logHelpersSubSite");

const getAllCompanySubsitePairs = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Sensor_%_%'`,
      [],
      (err, rows) => {
        if (err) return reject(err);

        // Extract companyId and subsiteId from table name
        const pairs = rows.map(row => {
          const parts = row.name.split("_"); // ['Sensor', '123', 'alpha']
          return {
            companyId: parts[1],
            subsiteId: parts[2]
          };
        });

        resolve(pairs);
      }
    );
  });
};

const rehydrateSubsiteIntervals = async (companyId, subsiteId) => {
  const sensorTable = `Sensor_${companyId}_${subsiteId}`;
  const controlTable = `IntervalControl_${companyId}_${subsiteId}`;

  db.all(
    `SELECT s.bank_id, s.interval_seconds, s.batch_size 
     FROM ${sensorTable} s
     JOIN ${controlTable} c ON s.id = c.sensor_id
     WHERE s.is_active = 1 AND (c.is_fetching = 1 OR c.is_sending = 1)`,
    [],
    (err, rows) => {
      if (err) {
        console.error(`❌ Failed to rehydrate for ${companyId}-${subsiteId}:`, err.message);
        return;
      }

      rows.forEach(sensor => {
        const { bank_id, interval_seconds } = sensor;

        db.get(`SELECT is_fetching, is_sending FROM ${controlTable} c JOIN ${sensorTable} s ON c.sensor_id = s.id WHERE s.bank_id = ?`, [bank_id], (err2, row) => {
          if (err2 || !row) return;

          if (row.is_fetching === 1) {
            intervalManager.startFetch(bank_id, interval_seconds * 1000, companyId, subsiteId);
            insertSubsiteLog(bank_id, "♻️ Rehydrated fetching job", companyId, subsiteId);
          }

          if (row.is_sending === 1) {
            intervalManager.startSend(bank_id, companyId, subsiteId, interval_seconds * 1000);
            insertSubsiteLog(bank_id, "♻️ Rehydrated sending job", companyId, subsiteId);
          }
        });
      });
    }
  );
};

module.exports = {
  rehydrateSubsiteIntervals,
  getAllCompanySubsitePairs // 👈 export this
};