import {ChevronLeft, ChevronRight} from "lucide-react";

export default function Pagination({
  page,
  total,
  pageSize,
  onChange,
                                     onPageSizeChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(total, page * pageSize);

  return (
    <div className="admin-pagination">
      <span>
        {firstItem}–{lastItem} of {total}
      </span>

      <div className="admin-pagination-actions">
        <label className="admin-pagination-size">
          Per page:
          <input
            type="number"
            min={1}
            value={pageSize}
            disabled={!onPageSizeChange}
            aria-label="Items per page"
            onChange={(event) => {
              const next = Number(event.target.value);
              if (onPageSizeChange && Number.isFinite(next) && next >= 1) {
                onPageSizeChange(Math.floor(next));
              }
            }}
          />
        </label>

        <button
          type="button"
          className="admin-icon-button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>

        <span>
          Page {page} / {pageCount}
        </span>

        <button
          type="button"
          className="admin-icon-button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
