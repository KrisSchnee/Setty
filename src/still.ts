/** Native 1080p 16:9 — Grok Imagine image-to-video at 1080p. */
export const STILL_WIDTH = 1920
export const STILL_HEIGHT = 1080
export const STILL_MIME = 'image/png'

export function stillFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = now.getFullYear()
  const mo = pad(now.getMonth() + 1)
  const d = pad(now.getDate())
  const h = pad(now.getHours())
  const mi = pad(now.getMinutes())
  const s = pad(now.getSeconds())
  return `setty-${y}${mo}${d}-${h}${mi}${s}.png`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function runStillSelfTest(): void {
  if (STILL_WIDTH / STILL_HEIGHT !== 16 / 9) {
    throw new Error(`still must be 16:9, got ${STILL_WIDTH}x${STILL_HEIGHT}`)
  }
  const name = stillFilename(new Date(2026, 3, 9, 15, 4, 7))
  if (name !== 'setty-20260409-150407.png') {
    throw new Error(`still filename, got ${name}`)
  }
}
