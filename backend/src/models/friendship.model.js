import mongoose from "mongoose";

const friendshipSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
    },
    acceptedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// One row per pair, whichever direction the request went. The controllers always
// look a pair up with an $or on both orderings, so this also serves those reads.
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ recipient: 1, status: 1 });

const Friendship = mongoose.model("Friendship", friendshipSchema);

export default Friendship;
