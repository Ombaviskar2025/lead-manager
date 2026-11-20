const STATUSES = ['New', 'Contacted', 'Qualified', 'Lost'];
const SOURCES = ['Website', 'Referral', 'LinkedIn', 'Cold Call', 'Email Campaign', 'Event', 'Other'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Validate lead payload. Returns { errors, data }.
 * errors is an object keyed by field name (empty when valid).
 */
function validateLead(body = {}) {
  const data = {
    name: str(body.name),
    email: str(body.email).toLowerCase(),
    phone: str(body.phone),
    company: str(body.company),
    source: str(body.source),
    status: str(body.status) || 'New',
  };
  const errors = {};

  if (!data.name) errors.name = 'Name is required';
  else if (data.name.length > 100) errors.name = 'Name must be 100 characters or fewer';

  if (!data.email) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(data.email)) errors.email = 'Enter a valid email address';
  else if (data.email.length > 254) errors.email = 'Email is too long';

  if (!data.phone) errors.phone = 'Phone is required';
  else if (!PHONE_RE.test(data.phone)) errors.phone = 'Enter a valid phone number (7-20 digits)';

  if (!data.company) errors.company = 'Company is required';
  else if (data.company.length > 100) errors.company = 'Company must be 100 characters or fewer';

  if (!data.source) errors.source = 'Source is required';
  else if (!SOURCES.includes(data.source)) errors.source = `Source must be one of: ${SOURCES.join(', ')}`;

  if (!STATUSES.includes(data.status)) errors.status = `Status must be one of: ${STATUSES.join(', ')}`;

  return { errors, data };
}

function validateSignup(body = {}) {
  const data = { name: str(body.name), email: str(body.email).toLowerCase(), password: typeof body.password === 'string' ? body.password : '' };
  const errors = {};
  if (!data.name) errors.name = 'Name is required';
  else if (data.name.length > 100) errors.name = 'Name must be 100 characters or fewer';
  if (!data.email) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(data.email)) errors.email = 'Enter a valid email address';
  if (!data.password) errors.password = 'Password is required';
  else if (data.password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (data.password.length > 72) errors.password = 'Password must be 72 characters or fewer';
  return { errors, data };
}

function validateLogin(body = {}) {
  const data = { email: str(body.email).toLowerCase(), password: typeof body.password === 'string' ? body.password : '' };
  const errors = {};
  if (!data.email) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(data.email)) errors.email = 'Enter a valid email address';
  if (!data.password) errors.password = 'Password is required';
  return { errors, data };
}

module.exports = { STATUSES, SOURCES, validateLead, validateSignup, validateLogin };
