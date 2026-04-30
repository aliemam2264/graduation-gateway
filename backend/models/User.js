const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
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
      select: false, // never return password in queries by default
    },
    major: {
      type: String,
      default: "Computer Science",
    },
    university: {
      type: String,
      default: "",
    },
    plan: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },
    avatar: {
      type: String,
      default: "",
    },
    generationsUsed: {
      type: Number,
      default: 0,
    },
    generationsLimit: {
      type: Number,
      default: 10, // free plan limit
    },
    // The supervisor this student is registered under
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supervisor",
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance method: compare passwords
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Instance method: get initials for avatar
userSchema.methods.getInitials = function () {
  return this.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

module.exports = mongoose.model("User", userSchema);
