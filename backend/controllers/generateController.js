const { complete } = require("../middleware/groq");
const Project = require("../models/Project");
const User = require("../models/User");

// POST /api/generate
exports.generateProject = async (req, res) => {
  try {
    const user = req.user;

    if (user.plan === "free" && user.generationsUsed >= user.generationsLimit) {
      return res.status(403).json({
        error: "Generation limit reached. Upgrade to Pro for unlimited generations.",
      });
    }

    const {
      field = "Computer Science",
      degreeLevel = "Undergraduate (Bachelor)",
      timeline = "6 months",
      difficulty = "Intermediate",
      interests = "",
      teamSize = "1",
      keywords = "",
    } = req.body;

    const systemPrompt = `You are GradAI, an expert academic advisor specializing in graduation project ideas for engineering and computer science students.
You generate detailed, innovative, and supervisor-ready project proposals.
Always respond with a valid JSON object. No markdown, no explanation outside JSON.`;

    const userMessage = `Generate a graduation project idea with these parameters:
- Field: ${field}
- Degree Level: ${degreeLevel}
- Timeline: ${timeline}
- Difficulty: ${difficulty}
- Team Size: ${teamSize} person(s)
- Student Interests: ${interests || "Not specified"}
- Keywords to include: ${keywords || "None"}

Return a JSON object with this exact structure:
{
  "title": "Project title",
  "description": "2-3 sentence project overview",
  "problem": "The problem this project solves",
  "objectives": ["objective 1", "objective 2", "objective 3", "objective 4"],
  "technologies": ["tech1", "tech2", "tech3", "tech4", "tech5"],
  "methodology": "Brief methodology description",
  "expectedOutcome": "What the final product looks like",
  "novelty": "What makes this project unique",
  "challenges": ["challenge 1", "challenge 2", "challenge 3"],
  // "qualityScore": ,
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const raw = await complete(systemPrompt, userMessage, 1500);

    let generated;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      generated = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return res.status(500).json({ error: "AI returned invalid format. Please try again." });
    }

    const project = await Project.create({
      user: user._id,
      title: generated.title,
      field,
      degreeLevel,
      description: generated.description,
      objectives: generated.objectives || [],
      technologies: generated.technologies || [],
      timeline,
      difficulty,
      qualityScore: generated.qualityScore || null,
      status: "draft",
      tags: generated.tags || [],
      generationParams: req.body,
      fullProposal: JSON.stringify(generated),
    });

    await User.findByIdAndUpdate(user._id, { $inc: { generationsUsed: 1 } });

    res.status(201).json({ project, generated });
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ error: "Generation failed: " + err.message });
  }
};
