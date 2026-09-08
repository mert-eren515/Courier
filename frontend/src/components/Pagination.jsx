import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

// At most five page numbers at a time, with the current page kept in the middle.
const PAGE_WINDOW = 5;

const Pagination = ({ total, page, pageSize, onChange }) => {
  const pages = Math.ceil(total / pageSize);

  // A single page of results needs no controls at all.
  if (pages <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const end = Math.min(
    pages,
    Math.max(1, page - Math.floor(PAGE_WINDOW / 2)) + PAGE_WINDOW - 1,
  );
  const start = Math.max(1, end - PAGE_WINDOW + 1);

  const numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-base-300 pt-4">
      <span className="text-sm text-base-content/60 tabular-nums">
        Showing {first}–{last} of {total}
      </span>

      <div className="flex items-center gap-1">
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => onChange(1)}
          disabled={page === 1}
          aria-label="First page"
        >
          <ChevronsLeft className="size-4" />
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>

        {start > 1 && <span className="px-1 text-base-content/40">…</span>}

        {numbers.map((number) => (
          <button
            key={number}
            className={`btn btn-sm tabular-nums ${
              number === page ? "btn-primary" : "btn-ghost"
            }`}
            onClick={() => onChange(number)}
            aria-current={number === page ? "page" : undefined}
          >
            {number}
          </button>
        ))}

        {end < pages && <span className="px-1 text-base-content/40">…</span>}

        <button
          className="btn btn-sm btn-ghost"
          onClick={() => onChange(page + 1)}
          disabled={page === pages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => onChange(pages)}
          disabled={page === pages}
          aria-label="Last page"
        >
          <ChevronsRight className="size-4" />
        </button>
      </div>

      <span />
    </div>
  );
};

export default Pagination;
