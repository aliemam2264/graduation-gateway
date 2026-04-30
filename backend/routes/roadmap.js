const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { generateRoadmap } = require("../controllers/roadmapController");

router.use(protect);
router.post("/generate", generateRoadmap);

module.exports = router;
