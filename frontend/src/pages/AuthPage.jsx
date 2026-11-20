import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateLogin, validateSignup } from '../utils/validation';
import Field from '../components/Field';
import { Logo } from '../components/Navbar';

export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const { user, login, signup } = useAuth();
  const location = useLocation();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const found = isSignup ? validateSignup(values) : validateLogin(values);
    if (Object.keys(found).length) { setErrors(found); return; }

    setBusy(true);
    try {
      if (isSignup) await signup({ name: values.name, email: values.email, password: values.password });
      else await login({ email: values.email, password: values.password });
    } catch (err) {
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      setFormError(err.details ? '' : err.message);
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Logo />
        <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">{isSignup ? 'Start capturing and tracking your leads.' : 'Log in to manage your leads.'}</p>

        <form onSubmit={submit} noValidate>
          {formError && <div className="alert alert-error" role="alert">{formError}</div>}
          {isSignup && (
            <Field label="Full name" id="auth-name" error={errors.name}>
              <input id="auth-name" value={values.name} onChange={set('name')} autoComplete="name" placeholder="Jane Doe" />
            </Field>
          )}
          <Field label="Email" id="auth-email" error={errors.email}>
            <input id="auth-email" type="email" value={values.email} onChange={set('email')} autoComplete="email" placeholder="you@company.com" />
          </Field>
          <Field label="Password" id="auth-password" error={errors.password}>
            <input
              id="auth-password"
              type="password"
              value={values.password}
              onChange={set('password')}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
            />
          </Field>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Log in' : 'Create an account'}</Link>
        </p>
      </div>
    </main>
  );
}
