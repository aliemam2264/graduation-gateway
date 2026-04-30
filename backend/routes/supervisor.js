const router = require("express").Router();
const { protectSupervisor } = require("../middleware/auth");
const c = require("../controllers/supervisorController");

// Public
router.post("/register", c.register);
router.post("/login", c.login);

// Protected — supervisor only
router.use(protectSupervisor);

router.get("/me", c.getMe);
router.patch("/update-profile", c.updateProfile);
router.get("/stats", c.getStats);

// Students management
router.get("/students", c.getStudents);
router.post("/students/assign", c.assignStudent);
router.delete("/students/:studentId", c.removeStudent);
router.get("/students/:studentId/projects", c.getStudentProjects);

// Project reviews
router.post("/projects/:projectId/review", c.reviewProject);
router.get("/projects/:projectId/review", c.getProjectReview);

module.exports = router;
