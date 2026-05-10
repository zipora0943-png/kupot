import React, { useEffect } from 'react'

/**
 * Reusable modal wrapper. Renders the existing CSS classes from index.css:
 *   .modal-backdrop, .modal-box (.wide), .modal-header, .modal-close, .modal-footer
 *
 * Props:
 *   open      — bool, render the modal only when true
 *   title     — string for the header
 *   onClose   — called on backdrop click, ✕ button, or Escape key
 *   wide      — boolean, switch to the wider variant
 *   footer    — optional ReactNode rendered inside .modal-footer
 *   children  — body content
 */
export default function Modal({ open, title, onClose, wide, footer, children }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className={'modal-box' + (wide ? ' wide' : '')}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="סגור"
          >✕</button>
        </div>
        <div>{children}</div>
        {footer != null && (
          <div className="modal-footer">{footer}</div>
        )}
      </div>
    </div>
  )
}
