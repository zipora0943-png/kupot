// Moved to frontend-shared so both frontends share one cashroom modal.
// Re-exported here so the admin's existing `../components/CashroomModal`
// imports (CashroomAdminPage, EnvelopesTab, EnvelopesPage) keep working.
export { default } from '@shared/components/CashroomModal'
