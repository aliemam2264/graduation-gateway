const { chat } = require("../middleware/groq");
const ChatSession = require("../models/ChatSession");

const ADVISOR_SYSTEM = `You are GradAI Advisor, an expert academic mentor for university students working on graduation projects.
You help with:
- Project idea brainstorming and refinement
- Technical guidance on implementation
- Research direction and literature review tips
- Proposal writing advice
- Timeline planning and project management
- Supervisor communication tips

Be concise, practical, and encouraging. Use bullet points when listing items.
Keep responses under 300 words unless the student asks for detailed explanation.
Always stay focused on graduation project topics.`;

// GET /api/advisor/sessions
exports.getSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ user: req.user._id }).sort("-createdAt").select("title createdAt updatedAt").limit(20);
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/advisor/sessions/:id
exports.getSession = async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!session) return res.status(404).json({ error: "Session not found." });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/advisor/chat
exports.sendMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: "Message is required." });

    let session = sessionId ? await ChatSession.findOne({ _id: sessionId, user: req.user._id }) : null;

    if (!session) {
      session = new ChatSession({
        user: req.user._id,
        title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
        messages: [],
      });
    }

    session.messages.push({ role: "user", content: message });

    const history = session.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const reply = await chat(ADVISOR_SYSTEM, history, 800);

    session.messages.push({ role: "assistant", content: reply });
    await session.save();

    res.json({ reply, sessionId: session._id, sessionTitle: session.title });
  } catch (err) {
    console.error("Advisor chat error:", err);
    res.status(500).json({ error: "Failed to get AI response: " + err.message });
  }
};

// DELETE /api/advisor/sessions/:id
exports.deleteSession = async (req, res) => {
  try {
    await ChatSession.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    res.json({ message: "Session deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
