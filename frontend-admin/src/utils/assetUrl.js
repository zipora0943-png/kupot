// Resolve a backend-relative path (e.g. "/uploads/abc.jpg") to a full URL.
//
// Backend stores image paths like "/uploads/<filename>" in the DB. In dev the
// Vite proxy forwards /uploads to the backend, so the relative path works as-is.
// In production the frontends are served from a different origin than the
// backend, so we must prefix with the backend origin derived from VITE_API_BASE.
//
// VITE_API_BASE looks like "http://178.105.96.70:3000/api" — strip the trailing
// "/api" to get the backend origin. If VITE_API_BASE is unset (dev), return the
// path unchanged so the Vite proxy handles it.

import { API_BASE } from '@shared/api/client';

function backendOrigin() {
  if (!API_BASE) return '';
  if (API_BASE.startsWith('/')) return ''; // dev — relative, proxy handles it
  try {
    const u = new URL(API_BASE);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

export function assetUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  if (path.startsWith('blob:') || path.startsWith('data:')) return path;
  const origin = backendOrigin();
  if (!origin) return path;
  return path.startsWith('/') ? origin + path : `${origin}/${path}`;
}
