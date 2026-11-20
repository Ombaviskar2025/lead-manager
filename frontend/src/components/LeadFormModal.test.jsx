import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadFormModal from './LeadFormModal';
import { ApiError } from '../api/client';
import { makeLead } from '../test/utils';

async function fillValid(user) {
  await user.type(screen.getByLabelText('Full name'), 'Jane Doe');
  await user.type(screen.getByLabelText('Company'), 'Acme');
  await user.type(screen.getByLabelText('Email'), 'jane@acme.com');
  await user.type(screen.getByLabelText('Phone'), '+91 98765 43210');
  await user.selectOptions(screen.getByLabelText('Source'), 'LinkedIn');
}

describe('LeadFormModal (add)', () => {
  it('shows inline errors and does not submit when fields are empty', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LeadFormModal onSubmit={onSubmit} onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Phone is required')).toBeInTheDocument();
    expect(screen.getByText('Company is required')).toBeInTheDocument();
    expect(screen.getByText('Please choose a source')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('flags an invalid email', async () => {
    const user = userEvent.setup();
    render(<LeadFormModal onSubmit={vi.fn()} onClose={() => {}} />);
    await fillValid(user);
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('clears a field error as soon as the user edits that field', async () => {
    const user = userEvent.setup();
    render(<LeadFormModal onSubmit={vi.fn()} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Full name'), 'J');
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  });

  it('submits the entered values, defaulting status to New', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    const user = userEvent.setup();
    render(<LeadFormModal onSubmit={onSubmit} onClose={() => {}} />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Jane Doe', company: 'Acme', email: 'jane@acme.com',
      phone: '+91 98765 43210', source: 'LinkedIn', status: 'New',
    });
  });

  it('maps server-side field errors onto the form', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError('Validation failed', { status: 400, details: { email: 'An account with this email already exists' } }));
    const user = userEvent.setup();
    render(<LeadFormModal onSubmit={onSubmit} onClose={() => {}} />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Add lead' }));

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted fields.');
    expect(screen.getByRole('button', { name: 'Add lead' })).toBeEnabled(); // user can retry
  });

  it('shows a banner when the server is unreachable', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError('Cannot reach the server. Check your connection and try again.', { network: true }));
    const user = userEvent.setup();
    render(<LeadFormModal onSubmit={onSubmit} onClose={() => {}} />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Add lead' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });

  it('closes with Escape and with Cancel', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<LeadFormModal onSubmit={vi.fn()} onClose={onClose} />);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('LeadFormModal (edit)', () => {
  it('pre-fills the lead and submits an updated status', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    const user = userEvent.setup();
    render(<LeadFormModal lead={makeLead({ status: 'New' })} onSubmit={onSubmit} onClose={() => {}} />);

    expect(screen.getByLabelText('Full name')).toHaveValue('Priya Sharma');
    expect(screen.getByLabelText('Status')).toHaveValue('New');

    await user.selectOptions(screen.getByLabelText('Status'), 'Qualified');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: 'Priya Sharma', status: 'Qualified' });
  });
});
