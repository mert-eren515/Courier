import mongoose from "mongoose";

import Friendship from "../models/friendship.model.js";
import User from "../models/user.model.js";

export const PAGE_SIZE = 20;

// A pair has one row whichever way the request went, so every lookup checks
// both orderings.
const betweenUsers = (a, b) => ({
  $or: [
    { requester: a, recipient: b },
    { requester: b, recipient: a },
  ],
});

// The search term goes into a regex, so anything with meaning there has to be
// neutralised first.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readPage = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);

  return { page, skip: (page - 1) * PAGE_SIZE };
};

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

export const getFriends = async (req, res) => {
  try {
    const myId = req.user._id;

    const friendships = await Friendship.find({
      status: "accepted",
      $or: [{ requester: myId }, { recipient: myId }],
    })
      .sort({ acceptedAt: -1 })
      .populate("requester recipient", "username profilePic");

    const friends = friendships.map((friendship) =>
      friendship.requester._id.equals(myId)
        ? friendship.recipient
        : friendship.requester,
    );

    res.status(200).json(friends);
  } catch (error) {
    console.log("Error in getFriends controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getIncomingRequests = async (req, res) => {
  try {
    const requests = await Friendship.find({
      recipient: req.user._id,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .populate("requester", "username profilePic");

    res.status(200).json(
      requests.map((request) => ({
        _id: request._id,
        user: request.requester,
        createdAt: request.createdAt,
      })),
    );
  } catch (error) {
    console.log("Error in getIncomingRequests controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getOutgoingRequests = async (req, res) => {
  try {
    const { page, skip } = readPage(req.query);
    const filter = { requester: req.user._id, status: "pending" };

    const [requests, total] = await Promise.all([
      Friendship.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate("recipient", "username profilePic"),
      Friendship.countDocuments(filter),
    ]);

    res.status(200).json({
      items: requests.map((request) => ({
        _id: request._id,
        user: request.recipient,
        createdAt: request.createdAt,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.log("Error in getOutgoingRequests controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).populate(
      "blocked",
      "username profilePic",
    );

    res.status(200).json(me.blocked);
  } catch (error) {
    console.log("Error in getBlockedUsers controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const term = (req.query.q || "").trim();

    // An empty term would otherwise list every account in the database.
    if (!term) {
      return res
        .status(200)
        .json({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
    }

    const myId = req.user._id;
    const { page, skip } = readPage(req.query);

    // Hide people I blocked, and people who blocked me.
    const blockedByOthers = await User.find({ blocked: myId }).select("_id");

    const filter = {
      _id: {
        $nin: [
          myId,
          ...req.user.blocked,
          ...blockedByOthers.map((user) => user._id),
        ],
      },
      username: { $regex: escapeRegex(term), $options: "i" },
    };

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ username: 1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .select("username profilePic"),
      User.countDocuments(filter),
    ]);

    // One query for the whole page instead of one per row.
    const related = await Friendship.find({
      $or: [
        { requester: myId, recipient: { $in: users.map((user) => user._id) } },
        { recipient: myId, requester: { $in: users.map((user) => user._id) } },
      ],
    });

    const relationFor = (userId) => {
      const friendship = related.find(
        (row) => row.requester.equals(userId) || row.recipient.equals(userId),
      );

      if (!friendship) return "none";
      if (friendship.status === "accepted") return "friends";

      return friendship.requester.equals(myId) ? "outgoing" : "incoming";
    };

    res.status(200).json({
      items: users.map((user) => ({
        _id: user._id,
        username: user.username,
        profilePic: user.profilePic,
        relation: relationFor(user._id),
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.log("Error in searchUsers controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendRequest = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const recipient = await User.findOne({ username });

    if (!recipient) {
      return res.status(404).json({ message: "User not found" });
    }

    const myId = req.user._id;

    if (recipient._id.equals(myId)) {
      return res
        .status(400)
        .json({ message: "You cannot add yourself as a friend" });
    }

    if (req.user.blocked.some((id) => id.equals(recipient._id))) {
      return res
        .status(400)
        .json({ message: "Unblock this user before sending a request" });
    }

    if (recipient.blocked.some((id) => id.equals(myId))) {
      // Saying "you are blocked" would leak the other user's decision.
      return res.status(404).json({ message: "User not found" });
    }

    const existing = await Friendship.findOne(
      betweenUsers(myId, recipient._id),
    );

    if (existing) {
      const message =
        existing.status === "accepted"
          ? "You are already friends"
          : "There is already a pending request";

      return res.status(400).json({ message });
    }

    const friendship = await Friendship.create({
      requester: myId,
      recipient: recipient._id,
    });

    res.status(201).json({
      _id: friendship._id,
      user: { _id: recipient._id, username: recipient.username },
      createdAt: friendship.createdAt,
    });
  } catch (error) {
    console.log("Error in sendRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(404).json({ message: "Request not found" });
    }

    const friendship = await Friendship.findOne({
      _id: id,
      recipient: req.user._id,
      status: "pending",
    });

    if (!friendship) {
      return res.status(404).json({ message: "Request not found" });
    }

    friendship.status = "accepted";
    friendship.acceptedAt = new Date();
    await friendship.save();

    res.status(200).json({ message: "Request accepted" });
  } catch (error) {
    console.log("Error in acceptRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Covers both directions: declining one sent to me, and cancelling one I sent.
export const removeRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(404).json({ message: "Request not found" });
    }

    const myId = req.user._id;

    const friendship = await Friendship.findOneAndDelete({
      _id: id,
      status: "pending",
      $or: [{ requester: myId }, { recipient: myId }],
    });

    if (!friendship) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.status(200).json({ message: "Request removed" });
  } catch (error) {
    console.log("Error in removeRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(404).json({ message: "Friend not found" });
    }

    const friendship = await Friendship.findOneAndDelete({
      status: "accepted",
      ...betweenUsers(req.user._id, id),
    });

    if (!friendship) {
      return res.status(404).json({ message: "Friend not found" });
    }

    res.status(200).json({ message: "Friend removed" });
  } catch (error) {
    console.log("Error in removeFriend controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(404).json({ message: "User not found" });
    }

    const myId = req.user._id;

    if (myId.equals(id)) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    const target = await User.findById(id);

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    // Blocking also ends whatever relationship exists, in either direction.
    await Friendship.deleteOne(betweenUsers(myId, target._id));
    await User.findByIdAndUpdate(myId, { $addToSet: { blocked: target._id } });

    res.status(200).json({ message: "User blocked" });
  } catch (error) {
    console.log("Error in blockUser controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndUpdate(req.user._id, { $pull: { blocked: id } });

    res.status(200).json({ message: "User unblocked" });
  } catch (error) {
    console.log("Error in unblockUser controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
