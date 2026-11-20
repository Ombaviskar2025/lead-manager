import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api/client', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    api: { session: vi.fn(), login: vi.fn(), signup: vi.fn(), logout: vi.fn() },
    setUnauthorizedHandler: vi.fn(),
  };
});

import { api, ApiError } from '../api/client';
import AuthPage from './AuthPage';
import { renderWithProviders } from '../test/utils';

const renderAuth = (mode) =>
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/" element={<h1>Signed-in home</h1>} />
    </Routes>,
    { route: `/${mode}` }
  );

beforeEach(() => {
  vi.resetAllMocks();
  api.session.mockResolvedValue({ user: null }); // not signed in
});

describe('Login', () => {
  it('validates email and password before calling the API', async () => {
    const user = userEvent.setup();
    renderAuth('login');
    await user.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it('logs in and navigates to the app', async () => {
    api.login.mockResolvedValue({ user: { id: 1, name: 'Demo', email: 'demo@example.com' } });
    const user = userEvent.setup();
    renderAuth('login');

    await user.type(await screen.findByLabelText('Email'), 'demo@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Signed-in home')).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith({ email: 'demo@example.com', password: 'password123' });
  });

  it('shows the server message for wrong credentials and stays on the page', async () => {
    api.login.mockRejectedValue(new ApiError('Invalid email or password', { status: 401 }));
    const user = userEvent.setup();
    renderAuth('login');

    await user.type(await screen.findByLabelText('Email'), 'demo@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongwrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });

  it('links to signup', async () => {
    renderAuth('login');
    expect(await screen.findByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup');
  });
});

describe('Signup', () => {
  it('validates name, email and password length', async () => {
    const user = userEvent.setup();
    renderAuth('signup');
    await user.type(await screen.findByLabelText('Email'), 'nope');
    await user.type(screen.getByLabelText('Password'), '123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument();
    expect(api.signup).not.toHaveBeenCalled();
  });

  it('creates the account and signs the user in', async () => {
    api.signup.mockResolvedValue({ user: { id: 2, name: 'New User', email: 'new@example.com' } });
    const user = userEvent.setup();
    renderAuth('signup');

    await user.type(await screen.findByLabelText('Full name'), 'New User');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Signed-in home')).toBeInTheDocument();
    expect(api.signup).toHaveBeenCalledWith({ name: 'New User', email: 'new@example.com', password: 'password123' });
  });

  it('shows the duplicate-email error from the server on the email field', async () => {
    api.signup.mockRejectedValue(new ApiError('Validation failed', { status: 409, details: { email: 'An account with this email already exists' } }));
    const user = userEvent.setup();
    renderAuth('signup');

    await user.type(await screen.findByLabelText('Full name'), 'New User');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
  });
});

describe('Session restore', () => {
  it('redirects an already signed-in user away from the login page', async () => {
    api.session.mockResolvedValue({ user: { id: 1, name: 'Demo', email: 'demo@example.com' } });
    renderAuth('login');
    expect(await screen.findByText('Signed-in home')).toBeInTheDocument();
  });
});
