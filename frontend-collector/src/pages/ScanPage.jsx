import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import { cards as cardsApi, envelopes as envelopesApi } from '../api/endpoints'

export default function ScanPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()

  const [boxId, setBoxId] = useState(null)
  const [pendingValue, setPendingValue] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [scannerKey, setScannerKey] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualInput, setManualInput] = useState('')

  useEffect(() => {
    if (!cardId) return
    let cancelled = false
    cardsApi.get(cardId)
      .then((data) => { if (!cancelled) setBoxId(data?.box_id ?? null) })
      .catch(() => { /* keep boxId null; submit will surface the error */ })
    return () => { cancelled = true }
  }, [cardId])

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
    if (!boxId) {
      setError('טוען פרטי קופה...')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await envelopesApi.create({
        box_id: Number(boxId),
        envelope_number: pendingValue,
      })
      navigate('/collection', {
        state: { toast: `שיוך מעטפה מס׳ ${pendingValue}` },
      })
    } catch (err) {
      setError(err?.message || 'שגיאה ביצירת מעטפה')
      setSubmitting(false)
    }
  }

  function submitManual(e) {
    e?.preventDefault?.()
    const v = manualInput.trim()
    if (!v) return
    setManualOpen(false)
    setManualInput('')
    setPendingValue(v)
    setError(null)
  }

  return (
    <>
      <BarcodeScanner key={scannerKey} onScan={handleScan} onClose={handleClose} />

      {!pendingValue && !manualOpen && (
        <div className="scanner-actions">
          <button
            type="button"
            className="scanner-manual-btn"
            onClick={() => setManualOpen(true)}
          >
            — או הזן ידנית —
          </button>
        </div>
      )}

      {manualOpen && (
        <div className="scanner-manual-form" role="dialog" aria-modal="true">
          <form className="box" onSubmit={submitManual}>
            <h4>הזנת מספר מעטפה</h4>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="מספר מעטפה"
            />
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => { setManualOpen(false); setManualInput('') }}
              >
                ביטול
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={!manualInput.trim()}
              >
                אישור
              </button>
            </div>
          </form>
        </div>
      )}

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
