import { SOURCES, STATUSES } from './constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

// Mirrors the backend rules so users get instant feedback.
export function validateLead(values) {
  const v = Object.fromEntries(Object.entries(values).map(([k, val]) => [k, typeof val === 'string' ? val.trim() : val]));
  const errors = {};

  if (!v.name) errors.name = 'Name is required';
  else if (v.name.length > 100) errors.name = 'Max 100 characters';

  if (!v.email) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(v.email)) errors.email = 'Enter a valid email address';

  if (!v.phone) errors.phone = 'Phone is required';
  else if (!PHONE_RE.test(v.phone)) errors.phone = 'Enter a valid phone number (7-20 digits)';

  if (!v.company) errors.company = 'Company is required';
  else if (v.company.length > 100) errors.company = 'Max 100 characters';

  if (!v.source) errors.source = 'Please choose a source';
  else if (!SOURCES.includes(v.source)) errors.source = 'Invalid source';

  if (!STATUSES.includes(v.status)) errors.status = 'Invalid status';

  return errors;
}

export function validateSignup({ name, email, password }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Name is required';
  if (!email.trim()) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  else if (password.length < 8) errors.password = 'Use at least 8 characters';
  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  return errors;
}
