import { PAGE_SIZES } from '../utils/constants';

export default function Pagination({ pagination, onPage, onLimit }) {
  const { page, limit, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span className="muted">Showing {from}–{to} of {total}</span>
      <div className="pagination-controls">
        <label className="page-size">
          <span className="sr-only">Rows per page</span>
          <select value={limit} onChange={(e) => onLimit(Number(e.target.value))} aria-label="Rows per page">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
        <span className="page-indicator">Page {page} of {totalPages}</span>
        <button type="button" className="btn btn-sm btn-outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next →</button>
      </div>
    </div>
  );
}
