// Moved to frontend-shared so both frontends can use it (the unified cashroom
// page lives in @shared and needs it). Re-exported here so the admin's existing
// `../utils/PaginatedTable` imports keep working unchanged.
export { default } from '@shared/utils/PaginatedTable'
