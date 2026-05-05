import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'

export default function ScanPage() {
  const { cardId } = useParams()
  const navigate = useNavigate()
  const [lastValue, setLastValue] = useState(null)

  function handleScan(value) {
    setLastValue(value)
    // eslint-disable-next-line no-console
    console.log('barcode scanned:', value, 'for card', cardId)
  }

  function handleClose() {
    if (cardId) navigate(`/collection/${cardId}`)
    else navigate('/collection')
  }

  return (
    <>
      <BarcodeScanner onScan={handleScan} onClose={handleClose} />
      {lastValue && (
        <div className="toast success">נקלט: {lastValue}</div>
      )}
    </>
  )
}
