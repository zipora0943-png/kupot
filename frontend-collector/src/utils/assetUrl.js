// Resolve a backend-relative path (e.g. "/uploads/abc.jpg") to a full URL.
// See frontend-admin/src/utils/assetUrl.js for full rationale.

import { API_BASE } from '../api/client';

function backendOrigin() {
  if (!API_BASE) return '';
  if (API_BASE.startsWith('/')) return '';
  try {
    const u = new URL(API_BASE);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

export function assetUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('blob:') || path.startsWith('data:')) return path;
  const origin = backendOrigin();
  if (!origin) return path;
  return path.startsWith('/') ? origin + path : `${origin}/${path}`;
}
