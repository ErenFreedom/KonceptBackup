const express = require("express");
const {
    sendAdminAppLoginOtp,
    verifyAdminAppLoginOtp,
    refreshAdminAppToken,
    logoutAdminApp
} = require("../controllers/cloudAdminAuthController");

const router = express.Router();

router.post("/send-otp", sendAdminAppLoginOtp);
router.post("/verify-otp", verifyAdminAppLoginOtp);
router.post("/refresh-token", refreshAdminAppToken);
router.post("/logout", logoutAdminApp);

module.exports = router;
