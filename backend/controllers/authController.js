const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Supervisor = require("../models/Supervisor");

const signToken = (id) =>
  jwt.sign({ id, role: "student" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  major: user.major,
  university: user.university,
  plan: user.plan,
  initials: user.getInitials(),
  generationsUsed: user.generationsUsed,
  generationsLimit: user.generationsLimit,

  supervisor: user.supervisor && typeof user.supervisor === "object" && user.supervisor.name ? user.supervisor.name : null,

  createdAt: user.createdAt,
  role: "student",
});

// GET /api/auth/supervisors — list all supervisors for student dropdown
exports.getSupervisors = async (req, res) => {
  try {
    const sups = await Supervisor.find({}, "name title department university");
    res.json({ supervisors: sups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, major, university, supervisorId } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required." });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email already registered." });

    // Validate supervisorId if provided
    if (supervisorId) {
      const supExists = await Supervisor.findById(supervisorId);
      if (!supExists) return res.status(404).json({ error: "Selected supervisor not found." });
    }

    const user = await User.create({
      name,
      email,
      password,
      major,
      university,
      supervisor: supervisorId || null,
    });

    await user.populate("supervisor", "name");

    // Auto-add student to supervisor's students list
    if (supervisorId) {
      await Supervisor.findByIdAndUpdate(supervisorId, {
        $addToSet: { students: user._id }, // addToSet prevents duplicates
      });
    }

    res.status(201).json({ token: signToken(user._id), user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const user = await User.findOne({ email }).select("+password").populate("supervisor", "name");
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ error: "Invalid email or password." });

    res.json({ token: signToken(user._id), user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("supervisor", "name");

    res.json({ user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/auth/update-profile
exports.updateProfile = async (req, res) => {
  try {
    const allowed = ["name", "major", "university"];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).populate("supervisor", "name");
    res.json({ user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
