import React from 'react'
import CashroomPage from '@shared/pages/CashroomPage'

// The cashroom screen is a single shared page (admin + collector). The admin
// has no camera, so it renders the page with no scan extras — desktop users
// scan via a USB/keyboard-wedge barcode reader into the text field.
export default function CashroomAdminPage() {
  return <CashroomPage />
}
