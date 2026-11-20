import { describe, expect, it } from 'vitest';
import { validateLead, validateLogin, validateSignup } from './validation';

const valid = { name: 'Jane', email: 'jane@acme.com', phone: '+91 98765 43210', company: 'Acme', source: 'Website', status: 'New' };

describe('validateLead', () => {
  it('accepts a valid lead', () => {
    expect(validateLead(valid)).toEqual({});
  });

  it('requires every field', () => {
    const errors = validateLead({ name: '', email: '', phone: '', company: '', source: '', status: 'New' });
    expect(Object.keys(errors).sort()).toEqual(['company', 'email', 'name', 'phone', 'source']);
  });

  it.each(['plain', 'a@b', '@acme.com', 'a b@acme.com', 'a@acme'])('rejects invalid email %s', (email) => {
    expect(validateLead({ ...valid, email }).email).toBeTruthy();
  });

  it.each(['12', 'abc', '98765-abc'])('rejects invalid phone %s', (phone) => {
    expect(validateLead({ ...valid, phone }).phone).toBeTruthy();
  });

  it.each(['+91 98765 43210', '(555) 123-4567', '9876543210'])('accepts phone %s', (phone) => {
    expect(validateLead({ ...valid, phone }).phone).toBeUndefined();
  });

  it('treats whitespace-only values as empty', () => {
    expect(validateLead({ ...valid, name: '   ' }).name).toBe('Name is required');
  });

  it('rejects unknown source and status', () => {
    expect(validateLead({ ...valid, source: 'Pigeon' }).source).toBeTruthy();
    expect(validateLead({ ...valid, status: 'Won' }).status).toBeTruthy();
  });
});

describe('validateSignup / validateLogin', () => {
  it('requires name, valid email and an 8+ character password', () => {
    expect(Object.keys(validateSignup({ name: '', email: 'x', password: '123' })).sort()).toEqual(['email', 'name', 'password']);
    expect(validateSignup({ name: 'A', email: 'a@b.co', password: '12345678' })).toEqual({});
  });

  it('login requires email and password but not a minimum length', () => {
    expect(Object.keys(validateLogin({ email: '', password: '' })).sort()).toEqual(['email', 'password']);
    expect(validateLogin({ email: 'a@b.co', password: 'x' })).toEqual({});
  });
});
