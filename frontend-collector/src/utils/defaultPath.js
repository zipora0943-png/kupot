// Where each user role lands after login / on app entry inside frontend-collector.
// Cashroom users go straight to the cashroom view (their only screen);
// everyone else (collectors, admins) → /boxes (the natural starting point).
export function defaultPathForRole(role) {
  if (role === 'cashroom') return '/cashroom-admin'
  return '/boxes'
}
