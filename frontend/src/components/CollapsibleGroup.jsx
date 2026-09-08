import { ChevronDown } from "lucide-react";

/**
 * A section that shares the column with its siblings: it takes only the height
 * its rows need and gives the rest away, so a collapsed group hands its space to
 * the open one and two long groups split the column between them.
 *
 * Written by hand rather than with <details> because recent Chrome wraps details
 * content in a ::details-content box, which breaks that height sharing.
 */
const CollapsibleGroup = ({ title, count, open, onToggle, children }) => (
  <section
    className={`flex min-h-0 flex-col border-b border-base-300 last:border-b-0 ${
      open ? "flex-[0_1_auto]" : "flex-none"
    }`}
  >
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex flex-none items-center gap-2 px-3 py-3 text-xs font-bold uppercase tracking-wider text-base-content/50 hover:text-base-content/70"
    >
      <ChevronDown
        className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
      />
      {title}
      <span className="ml-auto tabular-nums">{count}</span>
    </button>

    {open && (
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">{children}</div>
    )}
  </section>
);

export default CollapsibleGroup;
