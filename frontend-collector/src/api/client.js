// ===== API client =====
// Wraps fetch with: base URL, auto auth header, error handling, JSON parsing.

const API_BASE = '/api';

// Token getter — reads from localStorage so it picks up changes after login
function getToken() {
  return localStorage.getItem('kupot_token');
}

// 401 handler — clear auth and force back to login page
function handleUnauthorized() {
  localStorage.removeItem('kupot_token');
  localStorage.removeItem('kupot_user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

/**
 * Generic API request.
 * @param {string} path  — e.g. '/cards' (will be prefixed with API_BASE)
 * @param {object} opts  — { method, body, query }
 * @returns {Promise<any>} parsed JSON response (or null for 204)
 * @throws {Error} on non-2xx with message from server when available
 */
export async function apiRequest(path, opts = {}) {
  const { method = 'GET', body, query, headers = {} } = opts;

  // Build URL with query params if provided
  let url = API_BASE + path;
  if (query && typeof query === 'object') {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    }
    const qsStr = qs.toString();
    if (qsStr) url += '?' + qsStr;
  }

  // Auth header
  const token = getToken();
  const finalHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Network error
    throw new Error('שגיאת רשת — לא הצלחנו להתחבר לשרת');
  }

  // 401 → log out
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('לא מאומת — נא להתחבר מחדש');
  }

  // 204 No Content
  if (res.status === 204) return null;

  // Parse JSON safely
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { raw: text }; }
  }

  if (!res.ok) {
    const msg = (data && data.error) || `שגיאת שרת (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// Convenience wrappers
export const api = {
  get:    (path, query)        => apiRequest(path, { method: 'GET', query }),
  post:   (path, body)         => apiRequest(path, { method: 'POST', body }),
  put:    (path, body)         => apiRequest(path, { method: 'PUT', body }),
  patch:  (path, body)         => apiRequest(path, { method: 'PATCH', body }),
  delete: (path)               => apiRequest(path, { method: 'DELETE' }),
};
