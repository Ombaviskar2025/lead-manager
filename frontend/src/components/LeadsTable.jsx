import StatusBadge from './StatusBadge';

const COLUMNS = [
  { key: 'name', label: 'Lead', sortable: true },
  { key: 'company', label: 'Company', sortable: true },
  { key: 'source', label: 'Source', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'created_at', label: 'Added', sortable: true },
];

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS"
const formatDate = (s) => {
  const d = new Date(`${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function LeadsTable({ leads, sortBy, order, onSort, onEdit, onDelete }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                aria-sort={sortBy === c.key ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <button type="button" className="th-btn" onClick={() => onSort(c.key)}>
                  {c.label}
                  <span className={`sort-icon${sortBy === c.key ? ' on' : ''}`} aria-hidden="true">
                    {sortBy === c.key ? (order === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </button>
              </th>
            ))}
            <th className="th-actions"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td data-label="Lead">
                <div className="lead-cell">
                  <span className="avatar" aria-hidden="true">{initials(lead.name)}</span>
                  <div className="lead-info">
                    <span className="lead-name">{lead.name}</span>
                    <a className="lead-sub" href={`mailto:${lead.email}`}>{lead.email}</a>
                    <span className="lead-sub">{lead.phone}</span>
                  </div>
                </div>
              </td>
              <td data-label="Company">{lead.company}</td>
              <td data-label="Source">{lead.source}</td>
              <td data-label="Status"><StatusBadge status={lead.status} /></td>
              <td data-label="Added" className="muted">{formatDate(lead.created_at)}</td>
              <td className="td-actions">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => onEdit(lead)} aria-label={`Edit ${lead.name}`}>Edit</button>
                <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => onDelete(lead)} aria-label={`Delete ${lead.name}`}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
