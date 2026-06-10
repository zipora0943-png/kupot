// WhatsApp-style image compression: resize longest edge to 1280px,
// re-encode as JPEG quality 0.75. Heavy phone photos (4-8MB) drop to
// 150-300KB — keeps the document readable while staying lean on the
// network and on the backend's 5MB upload cap.
//
// Returns a new File with the original filename rewritten to `.jpg`
// (always JPEG out, regardless of input type). If anything goes wrong
// (HEIC the canvas can't decode, OOM, etc.) the original file is
// returned unchanged so the upload still happens.

const MAX_EDGE = 1280
const JPEG_QUALITY = 0.75

export async function compressImage(file) {
  if (!file || typeof file !== 'object') return file
  if (!/^image\//i.test(file.type || '')) return file
  // Already small? Don't waste cycles re-encoding.
  if (file.size <= 200 * 1024) return file

  try {
    const bitmap = await loadBitmap(file)
    const { width, height } = scaledSize(bitmap.width, bitmap.height, MAX_EDGE)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    try { bitmap.close?.() } catch { /* ignore */ }

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob) return file
    // Larger after compression? Keep the original.
    if (blob.size >= file.size) return file

    const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch (err) {
    console.warn('[compressImage] falling back to original:', err?.message)
    return file
  }
}

function scaledSize(w, h, maxEdge) {
  const longest = Math.max(w, h)
  if (longest <= maxEdge) return { width: w, height: h }
  const ratio = maxEdge / longest
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch { /* fall through to <img> path */ }
  }
  return await loadImageElement(file)
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e?.error || new Error('image decode failed'))
    }
    img.src = url
  })
}
