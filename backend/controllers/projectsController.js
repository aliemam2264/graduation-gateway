const Project = require("../models/Project");

// GET /api/projects
exports.getProjects = async (req, res) => {
  try {
    const { status, field, search, sort = "-createdAt" } = req.query;
    const filter = { user: req.user._id };

    if (status) filter.status = status;
    if (field) filter.field = field;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const projects = await Project.find(filter)
      .sort(sort)
      .select("-fullProposal -roadmap");

    res.json({ projects, count: projects.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/projects/:id
exports.getProject = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, user: req.user._id });
    if (!project) return res.status(404).json({ error: "Project not found." });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/projects
exports.createProject = async (req, res) => {
  try {
    const project = await Project.create({ ...req.body, user: req.user._id });
    res.status(201).json({ project });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PATCH /api/projects/:id
exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ error: "Project not found." });
    res.json({ project });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/projects/:id
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!project) return res.status(404).json({ error: "Project not found." });
    res.json({ message: "Project deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/projects/:id/favorite
exports.toggleFavorite = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, user: req.user._id });
    if (!project) return res.status(404).json({ error: "Project not found." });
    project.isFavorite = !project.isFavorite;
    await project.save();
    res.json({ isFavorite: project.isFavorite });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
