import { STATUSES } from '../utils/constants';

export default function StatsCards({ stats, activeStatus, onSelect }) {
  const total = stats?.total ?? 0;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <section className="stats" aria-label="Lead summary">
      <button type="button" className={`stat-card stat-total${activeStatus === '' ? ' active' : ''}`} onClick={() => onSelect('')}>
        <span className="stat-label">Total leads</span>
        <span className="stat-value">{stats ? total : '–'}</span>
        <span className="stat-meta">All statuses</span>
      </button>
      {STATUSES.map((s) => {
        const n = stats?.byStatus?.[s] ?? 0;
        return (
          <button
            key={s}
            type="button"
            className={`stat-card stat-${s.toLowerCase()}${activeStatus === s ? ' active' : ''}`}
            onClick={() => onSelect(activeStatus === s ? '' : s)}
          >
            <span className="stat-label">{s}</span>
            <span className="stat-value">{stats ? n : '–'}</span>
            <span className="stat-bar" aria-hidden="true"><span style={{ width: `${pct(n)}%` }} /></span>
          </button>
        );
      })}
    </section>
  );
}
