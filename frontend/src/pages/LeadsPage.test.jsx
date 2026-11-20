import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/client', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    api: {
      session: vi.fn(), logout: vi.fn(), listLeads: vi.fn(), leadStats: vi.fn(),
      createLead: vi.fn(), updateLead: vi.fn(), deleteLead: vi.fn(),
    },
    setUnauthorizedHandler: vi.fn(),
  };
});

import { api, ApiError } from '../api/client';
import LeadsPage from './LeadsPage';
import { makeLead, makeList, makeStats, renderWithProviders } from '../test/utils';

const priya = makeLead();
const rahul = makeLead({ id: 2, name: 'Rahul Verma', email: 'rahul@globex.com', company: 'Globex', status: 'Contacted' });

beforeEach(() => {
  vi.resetAllMocks();
  api.session.mockResolvedValue({ user: { id: 1, name: 'Demo', email: 'demo@example.com' } });
  api.listLeads.mockResolvedValue(makeList([priya, rahul]));
  api.leadStats.mockResolvedValue(makeStats({ New: 1, Contacted: 1 }));
});

const renderPage = () => renderWithProviders(<LeadsPage />);
const rows = () => screen.getAllByRole('row').slice(1); // drop header

describe('LeadsPage', () => {
  it('lists leads with their status shown clearly', async () => {
    renderPage();
    expect(await screen.findByText('Priya Sharma')).toBeInTheDocument();
    const [r1, r2] = rows();
    expect(within(r1).getByText('New')).toHaveClass('badge');
    expect(within(r2).getByText('Contacted')).toHaveClass('badge-contacted');
  });

  it('shows per-status counts in the dashboard cards', async () => {
    renderPage();
    await screen.findByText('Priya Sharma');
    expect(screen.getByRole('button', { name: /total leads\s*2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^contacted\s*1/i })).toBeInTheDocument();
  });

  it('shows the empty state with a call to action', async () => {
    api.listLeads.mockResolvedValue(makeList([]));
    renderPage();
    expect(await screen.findByText('No leads yet')).toBeInTheDocument();
  });

  it('shows an error with a retry button when the API is down', async () => {
    api.listLeads.mockRejectedValueOnce(new ApiError('Cannot reach the server. Check your connection and try again.', { network: true }));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Priya Sharma')).toBeInTheDocument();
  });

  it('adds a lead, then refreshes the list and shows a confirmation', async () => {
    api.createLead.mockResolvedValue(makeLead({ id: 3 }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Priya Sharma');

    await user.click(screen.getByRole('button', { name: '+ Add lead' }));
    const dialog = screen.getByRole('dialog', { name: 'Add new lead' });
    await user.type(within(dialog).getByLabelText('Full name'), 'Sara Khan');
    await user.type(within(dialog).getByLabelText('Company'), 'Initech');
    await user.type(within(dialog).getByLabelText('Email'), 'sara@initech.com');
    await user.type(within(dialog).getByLabelText('Phone'), '9876543210');
    await user.selectOptions(within(dialog).getByLabelText('Source'), 'Website');
    await user.click(within(dialog).getByRole('button', { name: 'Add lead' }));

    await waitFor(() => expect(api.createLead).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sara Khan', status: 'New' })));
    expect(await screen.findByText('Lead added')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.listLeads.mock.calls.length).toBeGreaterThan(1); // list was reloaded
  });

  it('edits a lead and updates its status', async () => {
    api.updateLead.mockResolvedValue({ ...priya, status: 'Qualified' });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Priya Sharma');

    await user.click(screen.getByRole('button', { name: 'Edit Priya Sharma' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit lead' });
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'Qualified');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.updateLead).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'Qualified' })));
    expect(await screen.findByText('Lead updated')).toBeInTheDocument();
  });

  it('asks for confirmation before deleting, and cancelling deletes nothing', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Priya Sharma');

    await user.click(screen.getByRole('button', { name: 'Delete Priya Sharma' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete lead?' });
    expect(dialog).toHaveTextContent('Priya Sharma');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.deleteLead).not.toHaveBeenCalled();
  });

  it('deletes after the user confirms', async () => {
    api.deleteLead.mockResolvedValue(null);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Priya Sharma');

    await user.click(screen.getByRole('button', { name: 'Delete Priya Sharma' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.deleteLead).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Lead deleted')).toBeInTheDocument();
  });

  it('keeps the confirmation open and shows an error if delete fails', async () => {
    api.deleteLead.mockRejectedValue(new ApiError('Lead not found', { status: 404 }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Priya Sharma');

    await user.click(screen.getByRole('button', { name: 'Delete Priya Sharma' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Lead not found')).toBeInTheDocument();
  });

  it('searches by name (debounced) and sends the term to the API', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Priya Sharma');

    await user.type(screen.getByRole('searchbox', { name: 'Search leads' }), 'rahul');
    await waitFor(() => expect(api.listLeads).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'rahul', page: 1 })));
  });

  it('filters by status from the dropdown and from a dashboard card', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Priya Sharma');

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'Lost');
    await waitFor(() => expect(api.listLeads).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Lost' })));

    await user.click(screen.getByRole('button', { name: /^qualified/i }));
    await waitFor(() => expect(api.listLeads).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Qualified' })));
  });

  it('shows a no-matches state with a way to clear filters', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Priya Sharma');

    api.listLeads.mockResolvedValue(makeList([]));
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'Lost');
    expect(await screen.findByText('No leads match your filters')).toBeInTheDocument();

    api.listLeads.mockResolvedValue(makeList([priya, rahul]));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(api.listLeads).toHaveBeenLastCalledWith(expect.objectContaining({ status: '' })));
  });

  it('sorts when a column header is clicked, toggling direction', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Priya Sharma');

    await user.click(screen.getByRole('button', { name: /^Company/ }));
    await waitFor(() => expect(api.listLeads).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'company', order: 'asc' })));
    await user.click(screen.getByRole('button', { name: /^Company/ }));
    await waitFor(() => expect(api.listLeads).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'company', order: 'desc' })));
  });

  it('paginates with Next / Prev', async () => {
    api.listLeads.mockResolvedValue(makeList([priya], { total: 25, totalPages: 3 }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Priya Sharma');

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(api.listLeads).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });
});
