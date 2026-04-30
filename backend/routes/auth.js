const router = require("express").Router();
const { protect } = require("../middleware/auth");
const authController = require("../controllers/authController");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", protect, authController.getMe);
router.patch("/update-profile", protect, authController.updateProfile);
router.get("/supervisors", authController.getSupervisors);

module.exports = router;
