import { useEffect, useState } from "react";
import { Clock, Loader2, Search, UserPlus, X } from "lucide-react";

import Pagination from "../components/Pagination";
import PersonRow from "../components/PersonRow";
import { useFriendStore } from "../store/useFriendStore";

const PAGE_SIZE = 20;

const relationLabel = {
  outgoing: "Requested",
  incoming: "Wants to add you",
  friends: "Friends",
};

const AddFriendPage = () => {
  const {
    searchResults,
    outgoing,
    isSearching,
    isOutgoingLoading,
    searchUsers,
    getOutgoingRequests,
    sendRequest,
    cancelRequest,
  } = useFriendStore();

  const [view, setView] = useState("add");
  const [term, setTerm] = useState("");

  useEffect(() => {
    getOutgoingRequests(1);
  }, [getOutgoingRequests]);

  // Wait for a pause in typing instead of firing a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => searchUsers(term, 1), 300);

    return () => clearTimeout(timer);
  }, [term, searchUsers]);

  return (
    <div className="h-screen pt-16">
      <div className="grid h-full grid-cols-1 md:grid-cols-[16rem_1fr]">
        <nav className="flex gap-1 border-b border-base-300 p-3 md:flex-col md:border-b-0 md:border-r">
          <div className="hidden px-3 pb-2 text-xs font-bold uppercase tracking-wider text-base-content/40 md:block">
            Friends
          </div>

          <button
            className={`btn justify-start gap-2 ${
              view === "add" ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => setView("add")}
          >
            <UserPlus className="size-4" />
            Add Friends
          </button>

          <button
            className={`btn justify-start gap-2 ${
              view === "sent" ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => setView("sent")}
          >
            <Clock className="size-4" />
            See Requests
            {outgoing.total > 0 && (
              <span className="badge badge-sm ml-auto tabular-nums">
                {outgoing.total > 99 ? "99+" : outgoing.total}
              </span>
            )}
          </button>
        </nav>

        <main className="overflow-y-auto p-6">
          {view === "add" ? (
            <div className="flex max-w-2xl flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold">Add friends</h1>
                <p className="text-base-content/60">
                  Search by username to send a friend request.
                </p>
              </div>

              <label className="input input-bordered flex items-center gap-2">
                {isSearching ? (
                  <Loader2 className="size-4 animate-spin opacity-60" />
                ) : (
                  <Search className="size-4 opacity-60" />
                )}
                <input
                  type="text"
                  className="grow"
                  placeholder="Enter username"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                />
              </label>

              {searchResults.total > 0 && (
                <div className="text-xs font-bold uppercase tracking-wider text-base-content/40">
                  {searchResults.total} results
                </div>
              )}

              <div className="flex flex-col gap-2">
                {searchResults.items.map((user) => (
                  <div
                    key={user._id}
                    className="rounded-lg border border-base-300 bg-base-200 px-2"
                  >
                    <PersonRow
                      user={user}
                      actions={
                        user.relation === "none" ? (
                          <button
                            className="btn btn-sm btn-primary gap-2"
                            onClick={() => sendRequest(user.username)}
                          >
                            <UserPlus className="size-4" />
                            Add
                          </button>
                        ) : (
                          <span className="rounded px-3 py-1 text-sm font-medium text-base-content/50">
                            {relationLabel[user.relation]}
                          </span>
                        )
                      }
                    />
                  </div>
                ))}
              </div>

              {term.trim() && !isSearching && searchResults.total === 0 && (
                <p className="text-base-content/50">
                  No user found with that username.
                </p>
              )}

              <Pagination
                total={searchResults.total}
                page={searchResults.page}
                pageSize={PAGE_SIZE}
                onChange={(page) => searchUsers(term, page)}
              />
            </div>
          ) : (
            <div className="flex max-w-2xl flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold">Sent requests</h1>
                <p className="text-base-content/60">
                  Waiting for a reply. Cancel any request you no longer want to
                  send.
                </p>
              </div>

              {isOutgoingLoading ? (
                <Loader2 className="size-5 animate-spin opacity-60" />
              ) : outgoing.total === 0 ? (
                <p className="text-base-content/50">
                  You have no pending requests.
                </p>
              ) : (
                <>
                  <div className="text-xs font-bold uppercase tracking-wider text-base-content/40">
                    {outgoing.total} pending
                  </div>

                  <div className="flex flex-col gap-2">
                    {outgoing.items.map((row) => (
                      <div
                        key={row._id}
                        className="rounded-lg border border-base-300 bg-base-200 px-2"
                      >
                        <PersonRow
                          user={row.user}
                          subtitle={`Sent ${new Date(
                            row.createdAt,
                          ).toLocaleDateString()}`}
                          actions={
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => cancelRequest(row._id)}
                              aria-label={`Cancel request to ${row.user.username}`}
                            >
                              <X className="size-4" />
                            </button>
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <Pagination
                    total={outgoing.total}
                    page={outgoing.page}
                    pageSize={PAGE_SIZE}
                    onChange={(page) => getOutgoingRequests(page)}
                  />
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AddFriendPage;
