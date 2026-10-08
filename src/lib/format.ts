// Utility helpers for PharmaKin

/**
 * Format a number as FC (Congolese Francs) with thousand separators.
 */
export function formatFC(n: number | undefined | null): string {
  const value = Number(n ?? 0)
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value) + ' FC'
}

/**
 * Format a number with thousand separators (no currency).
 */
export function formatNumber(n: number | undefined | null): string {
  const value = Number(n ?? 0)
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)
}

/**
 * Format today's date as DD/MM/YYYY.
 */
export function todayStr(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Format a time as HH:MM.
 */
export function timeStr(d: Date = new Date()): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Format an invoice sequence as HK-000001.
 */
export function formatInvoiceNumber(seq: number): string {
  return 'HK-' + String(seq).padStart(6, '0')
}

/**
 * Haversine distance in meters between two lat/lng points.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Human readable distance: "350 m" or "1,2 km".
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  const km = meters / 1000
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(km)} km`
}

/**
 * Slugify-safe id for local storage keys.
 */
export function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Simple debounce.
 */
export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 200): T {
  let t: ReturnType<typeof setTimeout>
  return ((...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }) as T
}

/**
 * Title-case a name.
 */
export function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
}
