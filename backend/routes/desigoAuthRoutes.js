const express = require("express");
const {
    getDesigoAuthToken,
    getStoredDesigoToken,
    deleteDesigoToken,
    saveDesigoToken
} = require("../controllers/desigoAuthController");

const router = express.Router();

// ✅ Fetch & Store Desigo Token (No Middleware Required)
router.post("/get-token", getDesigoAuthToken);

router.post("/save-token", saveDesigoToken);


// ✅ Retrieve Stored Token (No Middleware Required)
router.get("/stored-token", getStoredDesigoToken);

// ✅ Delete Token (No Middleware Required)
router.delete("/delete-token", deleteDesigoToken);

module.exports = router;
