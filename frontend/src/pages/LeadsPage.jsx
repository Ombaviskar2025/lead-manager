import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import StatsCards from '../components/StatsCards';
import LeadsTable from '../components/LeadsTable';
import LeadFormModal from '../components/LeadFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import { STATUSES } from '../utils/constants';

const DEFAULT_QUERY = { q: '', status: '', sortBy: 'created_at', order: 'desc', page: 1, limit: 10 };

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function LeadsPage() {
  const toast = useToast();
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);

  const [data, setData] = useState({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [formLead, setFormLead] = useState(undefined); // undefined = closed, null = new, object = edit
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const requestId = useRef(0);

  // Apply debounced search to the query (and reset to page 1)
  useEffect(() => {
    setQuery((q) => (q.q === debouncedSearch ? q : { ...q, q: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  const loadStats = useCallback(async () => {
    try { setStats(await api.leadStats()); } catch { /* non-critical */ }
  }, []);

  const loadLeads = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.listLeads(query);
      if (id !== requestId.current) return; // a newer request superseded this one
      // If the current page vanished (e.g. last item deleted), step back
      if (res.items.length === 0 && res.pagination.page > 1) {
        setQuery((q) => ({ ...q, page: res.pagination.totalPages }));
        return;
      }
      setData(res);
    } catch (err) {
      if (id === requestId.current) setLoadError(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const refresh = () => Promise.all([loadLeads(), loadStats()]);

  const handleSave = async (values) => {
    if (formLead) {
      await api.updateLead(formLead.id, values);
      toast.success('Lead updated');
    } else {
      await api.createLead(values);
      toast.success('Lead added');
    }
    setFormLead(undefined);
    await refresh();
  };

  const handleDelete = async () => {
    setDeleteBusy(true);
    try {
      await api.deleteLead(deleting.id);
      toast.success('Lead deleted');
      setDeleting(null);
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleSort = (key) =>
    setQuery((q) => ({
      ...q,
      sortBy: key,
      order: q.sortBy === key && q.order === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));

  const hasFilters = Boolean(query.q || query.status);
  const clearFilters = () => { setSearch(''); setQuery((q) => ({ ...q, q: '', status: '', page: 1 })); };

  return (
    <>
      <Navbar />
      <main className="container page">
        <div className="page-head">
          <div>
            <h1>Leads</h1>
            <p className="muted">Capture, track and follow up on every opportunity.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setFormLead(null)}>+ Add lead</button>
        </div>

        <StatsCards stats={stats} activeStatus={query.status} onSelect={(s) => setQuery((q) => ({ ...q, status: s, page: 1 }))} />

        <section className="card">
          <div className="toolbar">
            <div className="search">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or company…"
                aria-label="Search leads"
              />
            </div>
            <select
              value={query.status}
              onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {hasFilters && <button type="button" className="btn btn-ghost" onClick={clearFilters}>Clear</button>}
          </div>

          {loadError ? (
            <div className="state state-error" role="alert">
              <p>{loadError}</p>
              <button type="button" className="btn btn-outline" onClick={loadLeads}>Try again</button>
            </div>
          ) : loading && data.items.length === 0 ? (
            <div className="state"><span className="spinner" aria-hidden="true" /><p className="muted">Loading leads…</p></div>
          ) : data.items.length === 0 ? (
            <div className="state">
              <div className="empty-icon" aria-hidden="true">☰</div>
              <h3>{hasFilters ? 'No leads match your filters' : 'No leads yet'}</h3>
              <p className="muted">{hasFilters ? 'Try a different search or clear the filters.' : 'Add your first lead to get started.'}</p>
              {hasFilters
                ? <button type="button" className="btn btn-outline" onClick={clearFilters}>Clear filters</button>
                : <button type="button" className="btn btn-primary" onClick={() => setFormLead(null)}>+ Add lead</button>}
            </div>
          ) : (
            <div className={loading ? 'is-loading' : ''}>
              <LeadsTable
                leads={data.items}
                sortBy={query.sortBy}
                order={query.order}
                onSort={handleSort}
                onEdit={setFormLead}
                onDelete={setDeleting}
              />
              <Pagination
                pagination={data.pagination}
                onPage={(page) => setQuery((q) => ({ ...q, page }))}
                onLimit={(limit) => setQuery((q) => ({ ...q, limit, page: 1 }))}
              />
            </div>
          )}
        </section>
      </main>

      {formLead !== undefined && (
        <LeadFormModal lead={formLead} onSubmit={handleSave} onClose={() => setFormLead(undefined)} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete lead?"
          message={`“${deleting.name}” from ${deleting.company} will be permanently removed. This can't be undone.`}
          busy={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
