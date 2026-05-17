// ===== API endpoints =====
// Grouped by resource. Each function returns a promise.

import { api, API_BASE } from '@shared/api/client';

// ---- UPLOADS ----
// The shared `api` wrapper forces JSON; multipart uploads need a raw fetch
// with the auth token. Returns { path, filename, size, mimetype }.
export const uploads = {
  image: async (file) => {
    if (!file) throw new Error('יש לבחור קובץ');
    const fd = new FormData();
    fd.append('image', file);
    const token = localStorage.getItem('kupot_token');
    const res = await fetch(`${API_BASE}/uploads/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }
    if (!res.ok) {
      const msg = (data && data.error) || `שגיאת העלאה (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  },
};

// ---- AUTH ----
export const auth = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
  me: () =>
    api.get('/auth/me'),
  changePassword: (current_password, new_password) =>
    api.post('/auth/change-password', { current_password, new_password }),
};

// ---- USERS ----
export const users = {
  getAll: (filters)      => api.get('/users', filters),
  get: (id)              => api.get(`/users/${id}`),
  create: (data)         => api.post('/users', data),
  update: (id, data)     => api.put(`/users/${id}`, data),
  remove: (id)           => api.delete(`/users/${id}`),
};

// ---- BOXES ----
export const boxes = {
  getAll: (filters)      => api.get('/boxes', filters),
  get: (id)              => api.get(`/boxes/${id}`),
  create: (data)         => api.post('/boxes', data),
  update: (id, data)     => api.put(`/boxes/${id}`, data),
  remove: (id)           => api.delete(`/boxes/${id}`),
  // Change box.status. Backend will auto-close the active card (if any) when
  // moving to 'inactive' / 'uninstalled' / 'unusable'. `reason` is optional.
  setStatus: (id, status, reason) =>
    api.patch(`/boxes/${id}/status`, { status, reason }),
};

// ---- CARDS ----
export const cards = {
  getAll: (filters)      => api.get('/cards', filters),
  get: (id)              => api.get(`/cards/${id}`),
  create: (data)         => api.post('/cards', data),
  update: (id, data)     => api.put(`/cards/${id}`, data),
  close: (id, reason)    => api.post(`/cards/${id}/close`, { reason }),
  reopen: (id, reason)   => api.post(`/cards/${id}/reopen`, { reason }),
  history: (id)          => api.get(`/cards/${id}/history`),
  // Distinct location values for autocomplete combobox (task 26).
  // params: { level: 'city'|'neighborhood'|'street', city?, neighborhood? }
  locations: (params)    => api.get('/cards/locations', params),
  // Resolve a box by iron_number to its active card. Throws an error whose
  // .data.error is one of: 'box_not_found' | 'not_assigned' | 'card_closed'.
  lookupByIron: (ironNumber) =>
    api.get(`/cards/lookup-by-iron/${encodeURIComponent(ironNumber)}`),
  // Task 58: server compares the device's GPS to the card's geocoded address.
  // Body: { lat, lng }. Response: { within_radius, distance_meters, radius_meters, card_geocoded }.
  verifyLocation: (id, lat, lng) =>
    api.post(`/cards/${id}/verify-location`, { lat, lng }),
};

// ---- LOCATION OVERRIDES (task 58) ----
// Audit record: a collector continued a collection even though their GPS was
// outside the radius from the card's geocoded address.
export const locationOverrides = {
  create: (data) => api.post('/location-overrides', data),
};

// ---- ENVELOPES ----
export const envelopes = {
  getAll: (filters)      => api.get('/envelopes', filters),
  get: (id)              => api.get(`/envelopes/${id}`),
  create: (data)         => api.post('/envelopes', data),
  update: (id, data)     => api.put(`/envelopes/${id}`, data),
  // Edit amount of an envelope that was already entered. Creates an audit event.
  updateAmount: (id, amount, reason) =>
    api.patch(`/envelopes/${id}/amount`, { amount, reason: reason || null }),
  getPending: ()         => api.get('/envelopes/pending'),
  // Task 37: most-recent entered envelopes (for cashroom recent-envelopes panel)
  getRecentEntered: (limit) => api.get('/envelopes/entered-recent', limit ? { limit } : undefined),
  byNumber: (number)     => api.get(`/envelopes/by-number/${encodeURIComponent(number)}`),
};

// ---- EVENTS ----
export const events = {
  getByCard: (cardId)    => api.get(`/events/by-card/${cardId}`),
  create: (data)         => api.post('/events', data),
};

// ---- TASKS ----
export const tasks = {
  getAll: (filters)      => api.get('/tasks', filters),
  get: (id)              => api.get(`/tasks/${id}`),
  create: (data)         => api.post('/tasks', data),
  update: (id, data)     => api.put(`/tasks/${id}`, data),
  // Full lifecycle: opens/closes cards, creates events. Body see cardLogic.completeTask.
  complete: (id, data)   => api.post(`/tasks/${id}/complete`, data),
  // Admin-only override: marks done WITHOUT lifecycle (no card open/close, no event).
  markDoneNoLifecycle: (id, data) => api.post(`/tasks/${id}/mark-done-no-lifecycle`, data),
  // Admin-only: cancel a non-final task. Logs a `task_cancelled` event when card_id exists.
  cancel: (id, reason)   => api.post(`/tasks/${id}/cancel`, { reason: reason || null }),
  // Collector-only: report that the task could not be executed (mandatory reason).
  // No card lifecycle changes; logs a `task_not_executed` event on the relevant card.
  reportNotExecuted: (id, reason) => api.post(`/tasks/${id}/not-executed`, { reason }),
  remove: (id)           => api.delete(`/tasks/${id}`),
  // Helper: get tasks for a specific card.
  // Backend supports box_id but not card_id, so we filter client-side.
  getByCard: async (cardId, boxId) => {
    const all = await api.get('/tasks', { box_id: boxId })
    return Array.isArray(all) ? all.filter(t => t.card_id === Number(cardId)) : []
  },
};

// ---- REPORTS ----
export const reports = {
  getAll: (filters)      => api.get('/reports', filters),
  get: (id)              => api.get(`/reports/${id}`),
  create: (data)         => api.post('/reports', data),
  update: (id, data)     => api.put(`/reports/${id}`, data),
  convertToTask: (id, data) => api.post(`/reports/${id}/convert-to-task`, data),
  // Admin-only: close a report directly without converting to task. Logs a
  // `report_closed` event on the report's card_id with the optional reason.
  close: (id, reason)    => api.post(`/reports/${id}/close`, { reason: reason || null }),
};

// ---- REPORTS-EXPORT (Dochot page) ----
// admin / cashroom only on the backend.
export const reportsExport = {
  // Per-city totals — { from, to, city }
  summary: (filters)     => api.get('/reports-export/summary', filters),
  // Per-box breakdown — { from, to, city, status }
  perBox:  (filters)     => api.get('/reports-export/per-box', filters),
  // Period vs period — { from1, to1, from2, to2 }
  compare: (filters)     => api.get('/reports-export/compare', filters),
};

// ---- ALERTS ----
export const alerts = {
  getAll: (filters)      => api.get('/alerts', filters),
  // Cards with no collection in the configured threshold (default 30 days).
  // Returns { global_threshold, count, items: [...] }.
  noCollection: ()       => api.get('/alerts/no-collection'),
};

// ---- SETTINGS ----
// Backend exposes: GET /settings → object of all keys, PUT /settings → bulk-update by body.
export const settings = {
  getAll: ()             => api.get('/settings'),
  get: (key)             => api.get(`/settings/${key}`),
  // Bulk update — body is `{ key1: value1, key2: value2, ... }`
  updateAll: (patch)     => api.put('/settings', patch),
  // Convenience: update a single key
  update: (key, value)   => api.put('/settings', { [key]: value }),
  // Task 63: returns the Google Maps API key in plaintext so the frontend
  // can initialise the Maps JavaScript API. Restrict the key by HTTP referrer
  // in Google Cloud Console.
  getMapsKey: ()         => api.get('/settings/maps-key'),
};

// ---- TASK TYPES / REPORT TYPES / BOX TYPES ----
// All three are admin-managed lookup tables.
// GET is open to authenticated users; mutations are admin-only.
export const taskTypes = {
  getAll: ()             => api.get('/settings/task-types'),
  create: (data)         => api.post('/settings/task-types', data),
  update: (id, data)     => api.put(`/settings/task-types/${id}`, data),
  remove: (id)           => api.delete(`/settings/task-types/${id}`),
};
export const reportTypes = {
  getAll: ()             => api.get('/settings/report-types'),
  create: (data)         => api.post('/settings/report-types', data),
  update: (id, data)     => api.put(`/settings/report-types/${id}`, data),
  remove: (id)           => api.delete(`/settings/report-types/${id}`),
};
export const boxTypes = {
  getAll: ()             => api.get('/settings/box-types'),
  create: (data)         => api.post('/settings/box-types', data),
  update: (id, data)     => api.put(`/settings/box-types/${id}`, data),
  remove: (id)           => api.delete(`/settings/box-types/${id}`),
};

// ---- VERSION ----
// Public read (no auth) — used by the in-app update checker.
export const version = {
  getCollector: () => api.get('/version/collector'),
};
