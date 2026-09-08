import { useEffect, useState } from "react";
import { Ban, Check, Users, X } from "lucide-react";

import CollapsibleGroup from "./CollapsibleGroup";
import PersonRow from "./PersonRow";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";

const Sidebar = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const {
    friends,
    incoming,
    blocked,
    isFriendsLoading,
    getFriends,
    getManageLists,
    acceptRequest,
    declineRequest,
    removeFriend,
    blockUser,
    unblockUser,
  } = useFriendStore();

  const [tab, setTab] = useState("friends");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [openGroup, setOpenGroup] = useState({ invites: true, blocked: true });

  useEffect(() => {
    getFriends();
    getManageLists();
  }, [getFriends, getManageLists]);

  const visibleFriends = showOnlineOnly
    ? friends.filter((friend) => onlineUsers.includes(friend._id))
    : friends;

  const onlineCount = friends.filter((friend) =>
    onlineUsers.includes(friend._id),
  ).length;

  if (isFriendsLoading) return <SidebarSkeleton />;

  return (
    <aside className="flex h-full w-20 flex-col border-r border-base-300 transition-all duration-200 lg:w-72">
      <div className="w-full p-5 pb-3">
        <div className="flex items-center gap-2 text-primary">
          <Users className="size-6" />
          <span className="hidden font-medium lg:block">Contacts</span>
        </div>

        <div className="mt-3 hidden items-center gap-2 lg:flex">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(event) => setShowOnlineOnly(event.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-base-content/50">
            ({onlineCount} online)
          </span>
        </div>
      </div>

      <div className="hidden border-b border-base-300 px-2 lg:flex">
        <button
          className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-2.5 font-medium transition-colors ${
            tab === "friends"
              ? "border-primary text-primary"
              : "border-transparent text-base-content/60 hover:text-base-content"
          }`}
          onClick={() => setTab("friends")}
        >
          Friends
          <span className="text-base-content/50 tabular-nums">
            {friends.length}
          </span>
        </button>

        <button
          className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-2.5 font-medium transition-colors ${
            tab === "manage"
              ? "border-primary text-primary"
              : "border-transparent text-base-content/60 hover:text-base-content"
          }`}
          onClick={() => setTab("manage")}
        >
          Manage
          {incoming.length > 0 && (
            <span className="badge badge-primary badge-sm tabular-nums">
              {incoming.length > 99 ? "99+" : incoming.length}
            </span>
          )}
        </button>
      </div>

      {tab === "friends" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {visibleFriends.map((friend) => (
            <PersonRow
              key={friend._id}
              user={friend}
              online={onlineUsers.includes(friend._id)}
              subtitle={
                onlineUsers.includes(friend._id) ? "Online" : "Offline"
              }
              active={selectedUser?._id === friend._id}
              onClick={() => setSelectedUser(friend)}
              actions={
                <>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => removeFriend(friend._id)}
                    aria-label={`Remove ${friend.username} from friends`}
                    title="Unfriend"
                  >
                    <X className="size-4" />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => blockUser(friend._id)}
                    aria-label={`Block ${friend.username}`}
                    title="Block"
                  >
                    <Ban className="size-4" />
                  </button>
                </>
              }
            />
          ))}

          {visibleFriends.length === 0 && (
            <p className="py-4 text-center text-sm text-base-content/50">
              {friends.length === 0
                ? "No friends yet. Use Add Friend to find people."
                : "No friends online."}
            </p>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CollapsibleGroup
            title="Friend invites"
            count={incoming.length}
            open={openGroup.invites}
            onToggle={() =>
              setOpenGroup((state) => ({ ...state, invites: !state.invites }))
            }
          >
            {incoming.map((row) => (
              <PersonRow
                key={row._id}
                user={row.user}
                subtitle={new Date(row.createdAt).toLocaleDateString()}
                actions={
                  <>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => acceptRequest(row._id)}
                      aria-label={`Accept request from ${row.user.username}`}
                      title="Accept"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => declineRequest(row._id)}
                      aria-label={`Decline request from ${row.user.username}`}
                      title="Decline"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                }
              />
            ))}

            {incoming.length === 0 && (
              <p className="px-2 pb-2 text-sm text-base-content/50">
                No pending invites.
              </p>
            )}
          </CollapsibleGroup>

          <CollapsibleGroup
            title="Blocked"
            count={blocked.length}
            open={openGroup.blocked}
            onToggle={() =>
              setOpenGroup((state) => ({ ...state, blocked: !state.blocked }))
            }
          >
            {blocked.map((user) => (
              <PersonRow
                key={user._id}
                user={user}
                actions={
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => unblockUser(user._id)}
                    aria-label={`Unblock ${user.username}`}
                    title="Unblock"
                  >
                    <Ban className="size-4" />
                  </button>
                }
              />
            ))}

            {blocked.length === 0 && (
              <p className="px-2 pb-2 text-sm text-base-content/50">
                You have not blocked anyone.
              </p>
            )}
          </CollapsibleGroup>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
