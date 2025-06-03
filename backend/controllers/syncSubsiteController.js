const { syncAllSubSites } = require("../utils/syncSubSiteLocal");

const triggerSubSiteSync = async (req, res) => {
    try {
        await syncAllSubSites();
        res.status(200).json({ message: "✅ Sub-site DB synced successfully" });
    } catch (err) {
        console.error("❌ Error in sub-site sync trigger:", err.message);
        res.status(500).json({ message: "Sub-site sync failed", error: err.message });
    }
};

module.exports = { triggerSubSiteSync };