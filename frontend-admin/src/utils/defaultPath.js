// Task 36: where each user role should land after login / on app entry.
// Cashroom users go straight to the cashroom view; everyone else to the
// cards list (the natural starting point for admins and collectors).
export function defaultPathForRole(role) {
  if (role === 'cashroom') return '/cashroom-admin'
  return '/cards'
}
