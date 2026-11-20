import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';

export const makeLead = (over = {}) => ({
  id: 1,
  user_id: 1,
  name: 'Priya Sharma',
  email: 'priya@acme.com',
  phone: '+91 98765 43210',
  company: 'Acme Inc',
  source: 'Referral',
  status: 'New',
  created_at: '2026-11-20 10:00:00',
  updated_at: '2026-11-20 10:00:00',
  ...over,
});

export const makeList = (items, over = {}) => ({
  items,
  pagination: { page: 1, limit: 10, total: items.length, totalPages: 1, ...over },
});

export const makeStats = (byStatus = {}) => {
  const full = { New: 0, Contacted: 0, Qualified: 0, Lost: 0, ...byStatus };
  return { total: Object.values(full).reduce((a, b) => a + b, 0), byStatus: full };
};

export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <AuthProvider>{ui}</AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}
