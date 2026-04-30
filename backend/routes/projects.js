const router = require("express").Router();
const { protect } = require("../middleware/auth");
const c = require("../controllers/projectsController");

router.use(protect);

router.get("/",           c.getProjects);
router.get("/:id",        c.getProject);
router.post("/",          c.createProject);
router.patch("/:id",      c.updateProject);
router.delete("/:id",     c.deleteProject);
router.patch("/:id/favorite", c.toggleFavorite);

module.exports = router;
