const jwt = require("jsonwebtoken");
const Supervisor = require("../models/Supervisor");
const User = require("../models/User");
const Project = require("../models/Project");

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const formatSupervisor = (sup) => ({
  id: sup._id,
  name: sup.name,
  email: sup.email,
  department: sup.department,
  university: sup.university,
  title: sup.title,
  initials: sup.getInitials(),
  studentCount: sup.students?.length ?? 0,
  createdAt: sup.createdAt,
  role: "supervisor",
});

// POST /api/supervisor/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, department, university, title } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ error: "Name, email, and password are required." });

    const exists = await Supervisor.findOne({ email });
    if (exists)
      return res.status(409).json({ error: "Email already registered." });

    const sup = await Supervisor.create({
      name,
      email,
      password,
      department,
      university,
      title,
    });
    res.status(201).json({
      token: signToken(sup._id, "supervisor"),
      user: formatSupervisor(sup),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/supervisor/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ error: "Email and password are required." });

    const sup = await Supervisor.findOne({ email }).select("+password");
    if (!sup || !(await sup.comparePassword(password)))
      return res.status(401).json({ error: "Invalid email or password." });

    res.json({
      token: signToken(sup._id, "supervisor"),
      user: formatSupervisor(sup),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/supervisor/me
exports.getMe = async (req, res) => {
  res.json({ user: formatSupervisor(req.supervisor) });
};

// GET /api/supervisor/students
exports.getStudents = async (req, res) => {
  try {
    const sup = await Supervisor.findById(req.supervisor._id).populate(
      "students",
      "name email major university plan generationsUsed generationsLimit supervisor createdAt",
    );
    res.json({ students: sup.students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/supervisor/students/assign
exports.assignStudent = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ error: "Student email required." });

    const student = await User.findOne({ email });
    if (!student) return res.status(404).json({ error: "Student not found." });

    const sup = await Supervisor.findById(req.supervisor._id);
    if (sup.students.map(String).includes(String(student._id)))
      return res.status(409).json({ error: "Student already assigned." });

    sup.students.push(student._id);
    await sup.save();

    // Also set the student's supervisor field
    await User.findByIdAndUpdate(student._id, { supervisor: sup._id });

    res.json({
      message: "Student assigned successfully.",
      student: { id: student._id, name: student.name, email: student.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/supervisor/students/:studentId
exports.removeStudent = async (req, res) => {
  try {
    const sup = await Supervisor.findById(req.supervisor._id);

    sup.students = sup.students.filter(
      (s) => String(s) !== req.params.studentId,
    );

    const studentProjects = await Project.find({
      user: req.params.studentId,
    }).select("_id");

    const projectIds = studentProjects.map((p) => String(p._id));

    sup.reviewedProjects = sup.reviewedProjects.filter(
      (r) => !projectIds.includes(String(r.project)),
    );

    await sup.save();

    await User.findByIdAndUpdate(req.params.studentId, { supervisor: null });

    res.json({ message: "Student removed." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/supervisor/students/:studentId/projects
// Returns projects WITH their review data already merged in
exports.getStudentProjects = async (req, res) => {
  try {
    const sup = await Supervisor.findById(req.supervisor._id);
    const isAssigned = sup.students.map(String).includes(req.params.studentId);
    if (!isAssigned)
      return res
        .status(403)
        .json({ error: "This student is not assigned to you." });

    const projects = await Project.find({ user: req.params.studentId })
      .sort("-createdAt")
      .lean();
    const student = await User.findById(req.params.studentId)
      .select("name email major university")
      .lean();

    // Build a lookup map: projectId → review
    const reviewMap = {};
    sup.reviewedProjects.forEach((r) => {
      reviewMap[String(r.project)] = {
        grade: r.grade,
        feedback: r.feedback,
        reviewedAt: r.reviewedAt,
      };
    });

    // Attach review to each project
    const projectsWithReviews = projects.map((p) => ({
      ...p,
      review: reviewMap[String(p._id)] || null,
    }));

    res.json({ student, projects: projectsWithReviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/supervisor/projects/:projectId/review
exports.reviewProject = async (req, res) => {
  try {
    const { feedback, grade } = req.body;
    if (!grade) return res.status(400).json({ error: "Grade is required." });

    const sup = await Supervisor.findById(req.supervisor._id);

    const existing = sup.reviewedProjects.find(
      (r) => String(r.project) === req.params.projectId,
    );
    if (existing) {
      existing.feedback = feedback ?? existing.feedback;
      existing.grade = grade;
      existing.reviewedAt = Date.now();
    } else {
      sup.reviewedProjects.push({
        project: req.params.projectId,
        feedback: feedback || "",
        grade: grade,
        reviewedAt: Date.now(),
      });
    }
    await sup.save();
    await Project.findByIdAndUpdate(req.params.projectId, {
      review: {
        grade,
        feedback: feedback || "",
        reviewedAt: Date.now(),
      },
    });

    const savedReview =
      existing || sup.reviewedProjects[sup.reviewedProjects.length - 1];
    res.json({ message: "Review saved.", review: savedReview });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/supervisor/projects/:projectId/review
exports.getProjectReview = async (req, res) => {
  try {
    const sup = await Supervisor.findById(req.supervisor._id);
    const review = sup.reviewedProjects.find(
      (r) => String(r.project) === req.params.projectId,
    );
    res.json({ review: review || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/supervisor/stats
exports.getStats = async (req, res) => {
  try {
    const sup = await Supervisor.findById(req.supervisor._id);
    const studentIds = sup.students;

    const totalProjects = await Project.countDocuments({
      user: { $in: studentIds },
    });
    const doneProjects = await Project.countDocuments({
      user: { $in: studentIds },
      status: "done",
    });
    const activeProjects = await Project.countDocuments({
      user: { $in: studentIds },
      status: "active",
    });

    // Only count reviews that are NOT Pending
    const reviewedCount = sup.reviewedProjects.filter(
      (r) => r.grade && r.grade !== "Pending",
    ).length;
    const pendingReviews = Math.max(0, totalProjects - reviewedCount);

    const recentProjects = await Project.find({ user: { $in: studentIds } })
      .sort("-createdAt")
      .limit(5)
      .populate("user", "name")
      .lean();

    // Attach review grade to recent projects
    const reviewMap = {};
    sup.reviewedProjects.forEach((r) => {
      reviewMap[String(r.project)] = r.grade;
    });
    const recentWithGrade = recentProjects.map((p) => ({
      ...p,
      reviewGrade: reviewMap[String(p._id)] || null,
    }));

    res.json({
      stats: {
        students: studentIds.length,
        totalProjects,
        doneProjects,
        activeProjects,
        reviewedCount,
        pendingReviews,
      },
      recentProjects: recentWithGrade,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/supervisor/update-profile
exports.updateProfile = async (req, res) => {
  try {
    const allowed = ["name", "department", "university", "title"];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const sup = await Supervisor.findByIdAndUpdate(
      req.supervisor._id,
      updates,
      {
        new: true,
        runValidators: true,
      },
    );
    res.json({ user: formatSupervisor(sup) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
