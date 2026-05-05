import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import { envelopes as envelopesApi } from '../api/endpoints'

export default function ScanPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()

  const [pendingValue, setPendingValue] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [scannerKey, setScannerKey] = useState(0)

  function handleScan(value) {
    setPendingValue(String(value))
    setError(null)
  }

  function handleClose() {
    if (cardId) navigate(`/collection/${cardId}`)
    else navigate('/collection')
  }

  function resetScanner() {
    setPendingValue(null)
    setError(null)
    setScannerKey((k) => k + 1)
  }

  async function confirmEnvelope() {
    if (!pendingValue || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await envelopesApi.create({
        card_id: Number(cardId),
        envelope_number: pendingValue,
      })
      navigate(`/collection/${cardId}`, {
        state: { toast: `מעטפה ${pendingValue} נוצרה` },
      })
    } catch (err) {
      setError(err?.message || 'שגיאה ביצירת מעטפה')
      setSubmitting(false)
    }
  }

  return (
    <>
      <BarcodeScanner key={scannerKey} onScan={handleScan} onClose={handleClose} />

      {pendingValue && (
        <div className="scanner-manual-form" role="dialog" aria-modal="true">
          <div className="box">
            <h4>מעטפה {pendingValue} — לאשר?</h4>
            {error && <div className="alert red" style={{ marginBottom: 10 }}>{error}</div>}
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={resetScanner}
                disabled={submitting}
              >
                סרוק שוב
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={confirmEnvelope}
                disabled={submitting}
              >
                {submitting ? 'יוצר...' : 'אשר'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
