const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

// ──────────────── Middleware ────────────────
app.use(express.json());
app.use(morgan("dev"));
app.use(
  cors({
    origin: ["http://localhost:5500", "http://127.0.0.1:5500"],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// AI routes get stricter limit (API calls are expensive)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: "AI rate limit exceeded, slow down a bit!" },
});
app.use("/api/generate", aiLimiter);
app.use("/api/advisor", aiLimiter);
app.use("/api/roadmap", aiLimiter);

// ──────────────── Routes ────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/supervisor", require("./routes/supervisor"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/generate", require("./routes/generate"));
app.use("/api/advisor", require("./routes/advisor"));
app.use("/api/roadmap", require("./routes/roadmap"));
app.use("/api/stats", require("./routes/stats"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// ──────────────── MongoDB + Start ────────────────
mongoose
  .connect(process.env.MONGO_URI, {
    tls: true,
    tlsAllowInvalidCertificates: false,
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    console.log("MongoDB connected");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 GradAI server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
