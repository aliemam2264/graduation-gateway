const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const supervisorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    department: {
      type: String,
      default: "",
    },
    university: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      enum: ["Dr.", "Prof.", "Eng.", "Mr.", "Ms."],
      default: "Dr.",
    },
    // Students this supervisor is assigned to
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Projects the supervisor has reviewed / commented on
    reviewedProjects: [
      {
        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
        feedback: { type: String, default: "" },
        grade: {
          type: String,
          enum: ["Excellent", "Very Good", "Good", "Needs Revision", "Rejected", "Pending"],
          default: "Pending",
        },
        reviewedAt: { type: Date, default: Date.now },
      },
    ],
    avatar: { type: String, default: "" },
  },
  { timestamps: true }
);

// Hash password before save
supervisorSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

supervisorSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

supervisorSchema.methods.getInitials = function () {
  return this.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

module.exports = mongoose.model("Supervisor", supervisorSchema);
