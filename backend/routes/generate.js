const router = require("express").Router();
const { protect } = require("../middleware/auth");
const { generateProject } = require("../controllers/generateController");

router.use(protect);
router.post("/", generateProject);

module.exports = router;
