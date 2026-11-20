const BASE = import.meta.env.VITE_API_URL || '/api';
const CROSS_ORIGIN = /^https?:\/\//.test(BASE);
export class ApiError extends Error {
  constructor(message, { status = 0, details = null, network = false } = {}) {
    super(message);
    this.status = status;
    this.details = details;
    this.network = network;
  }
}

// Called when a request outside /auth comes back 401 (session expired or revoked).
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) url.searchParams.set(k, v);
    });
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    // The session lives in an HttpOnly cookie, so the browser attaches it automatically
    // and JavaScript (including any injected script) never sees the token.
    res = await fetch(url, {
      method,
      headers,
      credentials: CROSS_ORIGIN ? 'include' : 'same-origin',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', { network: true });
  }

  if (res.status === 204) return null;

  let data = null;
  try { data = await res.json(); } catch { /* non-JSON response */ }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    const message = data?.error || (res.status >= 500 ? 'The server ran into a problem. Please try again.' : `Request failed (${res.status})`);
    throw new ApiError(message, { status: res.status, details: data?.details || null });
  }
  return data;
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  session: () => request('/auth/session'),
  listLeads: (params) => request('/leads', { params }),
  leadStats: () => request('/leads/stats'),
  createLead: (body) => request('/leads', { method: 'POST', body }),
  updateLead: (id, body) => request(`/leads/${id}`, { method: 'PUT', body }),
  deleteLead: (id) => request(`/leads/${id}`, { method: 'DELETE' }),
};
