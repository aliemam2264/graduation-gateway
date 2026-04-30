const Project = require("../models/Project");

// GET /api/stats
exports.getStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const [total, done, active, allProjects] = await Promise.all([
      Project.countDocuments({ user: userId }),
      Project.countDocuments({ user: userId, status: "done" }),
      Project.countDocuments({ user: userId, status: "active" }),
      Project.find({ user: userId }).select("qualityScore field createdAt"),
    ]);

    const scored = allProjects.filter((p) => p.qualityScore != null);
    const avgScore =
      scored.length > 0
        ? (scored.reduce((s, p) => s + p.qualityScore, 0) / scored.length).toFixed(1)
        : null;

    const fieldMap = {};
    allProjects.forEach((p) => {
      fieldMap[p.field] = (fieldMap[p.field] || 0) + 1;
    });
    const fieldBreakdown = Object.entries(fieldMap)
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count);

    const recent = await Project.find({ user: userId })
      .sort("-createdAt")
      .limit(5)
      .select("title field status createdAt qualityScore");

    res.json({
      stats: {
        generated: total,
        approved: done,
        active,
        avgQualityScore: avgScore,
        generationsUsed: req.user.generationsUsed,
        generationsLimit: req.user.generationsLimit,
      },
      fieldBreakdown,
      recentProjects: recent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
