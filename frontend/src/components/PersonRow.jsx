// One row shape for every list that shows a person: search results, friends,
// requests and blocked users. Actions are passed in by the caller.
const PersonRow = ({ user, subtitle, online, actions, onClick, active }) => {
  const content = (
    <>
      <div className="relative shrink-0">
        <img
          src={user.profilePic || "/avatar.png"}
          alt=""
          className="size-10 rounded-full object-cover"
        />
        {online !== undefined && (
          <span
            className={`absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-base-100 ${
              online ? "bg-success" : "bg-base-content/30"
            }`}
          />
        )}
      </div>

      <div className="min-w-0 text-left">
        <div className="truncate font-medium">{user.username}</div>
        {subtitle && (
          <div className="text-xs text-base-content/50">{subtitle}</div>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-base-300 ${
          active ? "bg-base-300" : ""
        }`}
      >
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {content}
        </button>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-base-300">
      {content}
      {actions && (
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      )}
    </div>
  );
};

export default PersonRow;
