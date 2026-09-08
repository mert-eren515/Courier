import express from "express";

import {
  acceptRequest,
  blockUser,
  getBlockedUsers,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  removeFriend,
  removeRequest,
  searchUsers,
  sendRequest,
  unblockUser,
} from "../controllers/friend.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, getFriends);
router.get("/search", protectRoute, searchUsers);
router.get("/blocked", protectRoute, getBlockedUsers);
router.get("/requests/incoming", protectRoute, getIncomingRequests);
router.get("/requests/outgoing", protectRoute, getOutgoingRequests);

router.post("/requests", protectRoute, sendRequest);
router.post("/requests/:id/accept", protectRoute, acceptRequest);
router.delete("/requests/:id", protectRoute, removeRequest);

router.post("/block/:id", protectRoute, blockUser);
router.delete("/block/:id", protectRoute, unblockUser);

router.delete("/:id", protectRoute, removeFriend);

export default router;
