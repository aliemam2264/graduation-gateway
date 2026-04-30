const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Supervisor = require("../models/Supervisor");

// ── protects student-only routes ──
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer ")) token = req.headers.authorization.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Not authenticated. Please log in." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === "supervisor") return res.status(403).json({ error: "Supervisor token cannot access student routes." });

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "User no longer exists." });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

// ── protects supervisor-only routes ──
const protectSupervisor = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer ")) token = req.headers.authorization.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Not authenticated. Please log in." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "supervisor") return res.status(403).json({ error: "Access denied. Supervisor role required." });

    const sup = await Supervisor.findById(decoded.id);
    if (!sup) return res.status(401).json({ error: "Supervisor no longer exists." });

    req.supervisor = sup;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

module.exports = { protect, protectSupervisor };
