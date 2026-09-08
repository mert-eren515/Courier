import { create } from "zustand";
import toast from "react-hot-toast";

import { axiosInstance } from "../lib/axios";

const reportError = (error, fallback) =>
  toast.error(error.response?.data?.message || fallback);

export const useFriendStore = create((set, get) => ({
  friends: [],
  incoming: [],
  blocked: [],

  searchResults: { items: [], total: 0, page: 1 },
  outgoing: { items: [], total: 0, page: 1 },

  isFriendsLoading: false,
  isManageLoading: false,
  isSearching: false,
  isOutgoingLoading: false,

  getFriends: async () => {
    set({ isFriendsLoading: true });
    try {
      const res = await axiosInstance.get("/friends");
      set({ friends: res.data });
    } catch (error) {
      reportError(error, "Could not load your friends");
    } finally {
      set({ isFriendsLoading: false });
    }
  },

  // Incoming requests and blocked users are always shown together, so they load
  // together too.
  getManageLists: async () => {
    set({ isManageLoading: true });
    try {
      const [incoming, blocked] = await Promise.all([
        axiosInstance.get("/friends/requests/incoming"),
        axiosInstance.get("/friends/blocked"),
      ]);

      set({ incoming: incoming.data, blocked: blocked.data });
    } catch (error) {
      reportError(error, "Could not load your requests");
    } finally {
      set({ isManageLoading: false });
    }
  },

  searchUsers: async (term, page = 1) => {
    if (!term.trim()) {
      set({ searchResults: { items: [], total: 0, page: 1 } });
      return;
    }

    set({ isSearching: true });
    try {
      const res = await axiosInstance.get("/friends/search", {
        params: { q: term, page },
      });
      set({ searchResults: res.data });
    } catch (error) {
      reportError(error, "Search failed");
    } finally {
      set({ isSearching: false });
    }
  },

  getOutgoingRequests: async (page = 1) => {
    set({ isOutgoingLoading: true });
    try {
      const res = await axiosInstance.get("/friends/requests/outgoing", {
        params: { page },
      });
      set({ outgoing: res.data });
    } catch (error) {
      reportError(error, "Could not load your sent requests");
    } finally {
      set({ isOutgoingLoading: false });
    }
  },

  sendRequest: async (username) => {
    try {
      await axiosInstance.post("/friends/requests", { username });
      toast.success(`Request sent to ${username}`);

      // Flip the row to "Requested" without refetching the whole page.
      const { searchResults } = get();
      set({
        searchResults: {
          ...searchResults,
          items: searchResults.items.map((user) =>
            user.username === username ? { ...user, relation: "outgoing" } : user,
          ),
        },
      });

      // The sent-requests view and its counter have to reflect this too.
      await get().getOutgoingRequests(1);
    } catch (error) {
      reportError(error, "Could not send the request");
    }
  },

  acceptRequest: async (requestId) => {
    try {
      await axiosInstance.post(`/friends/requests/${requestId}/accept`);

      set({ incoming: get().incoming.filter((row) => row._id !== requestId) });
      await get().getFriends();
    } catch (error) {
      reportError(error, "Could not accept the request");
    }
  },

  declineRequest: async (requestId) => {
    try {
      await axiosInstance.delete(`/friends/requests/${requestId}`);
      set({ incoming: get().incoming.filter((row) => row._id !== requestId) });
    } catch (error) {
      reportError(error, "Could not decline the request");
    }
  },

  cancelRequest: async (requestId) => {
    try {
      await axiosInstance.delete(`/friends/requests/${requestId}`);
      await get().getOutgoingRequests(get().outgoing.page);
    } catch (error) {
      reportError(error, "Could not cancel the request");
    }
  },

  removeFriend: async (userId) => {
    try {
      await axiosInstance.delete(`/friends/${userId}`);
      set({ friends: get().friends.filter((friend) => friend._id !== userId) });
    } catch (error) {
      reportError(error, "Could not remove this friend");
    }
  },

  blockUser: async (userId) => {
    try {
      await axiosInstance.post(`/friends/block/${userId}`);

      // Blocking also ends the friendship and any pending request.
      set({
        friends: get().friends.filter((friend) => friend._id !== userId),
        incoming: get().incoming.filter((row) => row.user._id !== userId),
      });
      await get().getManageLists();
    } catch (error) {
      reportError(error, "Could not block this user");
    }
  },

  unblockUser: async (userId) => {
    try {
      await axiosInstance.delete(`/friends/block/${userId}`);
      set({ blocked: get().blocked.filter((user) => user._id !== userId) });
    } catch (error) {
      reportError(error, "Could not unblock this user");
    }
  },
}));
