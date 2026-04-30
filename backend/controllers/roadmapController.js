const { complete } = require("../middleware/groq");
const Project = require("../models/Project");

// POST /api/roadmap/generate
exports.generateRoadmap = async (req, res) => {
  try {
    const { projectId, timeline = "6 months", teamSize = "1" } = req.body;

    let project;
    if (projectId) {
      project = await Project.findOne({ _id: projectId, user: req.user._id });
      if (!project) return res.status(404).json({ error: "Project not found." });
    } else {
      project = req.body;
    }

    const systemPrompt = `You are a project management expert specializing in academic graduation projects.
Generate detailed, realistic roadmaps. Always respond with valid JSON only. No markdown.`;

    const userMessage = `Create a detailed project roadmap for:

Title: ${project.title}
Field: ${project.field}
Description: ${project.description}
Timeline: ${timeline}
Team Size: ${teamSize}
Technologies: ${(project.technologies || []).join(", ")}

Return JSON with this structure:
{
  "totalWeeks": 24,
  "phases": [
    {
      "phase": 1,
      "name": "Phase name",
      "weeks": "Week 1-3",
      "status": "todo",
      "tasks": [
        { "task": "Task description", "duration": "3 days", "priority": "high" }
      ],
      "deliverable": "What is delivered at end of phase",
      "milestone": true
    }
  ],
  "keyMilestones": [
    { "week": 4, "milestone": "Milestone name", "description": "Details" }
  ],
  "riskFactors": [
    { "risk": "Risk description", "mitigation": "How to handle it", "probability": "medium" }
  ]
}`;

    const raw = await complete(systemPrompt, userMessage, 2000);

    let roadmap;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      roadmap = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return res.status(500).json({ error: "AI returned invalid format. Try again." });
    }

    if (projectId && project._id) {
      await Project.findByIdAndUpdate(projectId, { roadmap });
    }

    res.json({ roadmap });
  } catch (err) {
    console.error("Roadmap error:", err);
    res.status(500).json({ error: "Failed to generate roadmap: " + err.message });
  }
};
