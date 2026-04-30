const router = require("express").Router();
const { protect } = require("../middleware/auth");
const c = require("../controllers/advisorController");

router.use(protect);

router.get("/sessions",       c.getSessions);
router.get("/sessions/:id",   c.getSession);
router.post("/chat",          c.sendMessage);
router.delete("/sessions/:id",c.deleteSession);

module.exports = router;
