const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    field: {
      type: String,
      required: true,
    },
    degreeLevel: {
      type: String,
      enum: [
        "Undergraduate (Bachelor)",
        "Postgraduate (Master)",
        "PhD Research",
      ],
      default: "Undergraduate (Bachelor)",
    },
    description: {
      type: String,
      required: true,
    },
    objectives: [String],
    technologies: [String],
    timeline: String,
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
      default: "Intermediate",
    },
    status: {
      type: String,
      enum: ["draft", "active", "done"],
      default: "draft",
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },
    // User prompt/parameters used to generate
    generationParams: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    tags: [String],
    review: {
      grade: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Needs Revision", "Rejected"],
        default: null,
      },
      feedback: { type: String, default: "" },
      reviewedAt: { type: Date },
    },
  },
  { timestamps: true },
);

// Index for fast user queries
projectSchema.index({ user: 1, createdAt: -1 });
projectSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("Project", projectSchema);
