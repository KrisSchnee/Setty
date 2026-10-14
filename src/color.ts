/** Default volume color (unlit gray). */
export const DEFAULT_POLYGON_COLOR = '#808080'
/** Default ground plane outside polygons. */
export const DEFAULT_FLOOR_COLOR = '#202020'
/** Default background / sky behind the ground plane. */
export const DEFAULT_SKY_COLOR = '#00bfff'

const HEX3 = /^[0-9a-f]{3}$/
const HEX6 = /^[0-9a-f]{6}$/

/** Canonical `#rrggbb`, or null if the text is not a hex color. */
export function parseColor(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  if (s === '') {
    return null
  }
  const hex = s.startsWith('#') ? s.slice(1) : s
  if (HEX3.test(hex)) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
  }
  if (HEX6.test(hex)) {
    return `#${hex}`
  }
  return null
}

export function formatColor(raw: string, fallback: string): string {
  return parseColor(raw) ?? parseColor(fallback) ?? DEFAULT_POLYGON_COLOR
}

export function colorToRgb(hex: string): { r: number; g: number; b: number } {
  const c = parseColor(hex) ?? DEFAULT_POLYGON_COLOR
  return {
    r: parseInt(c.slice(1, 3), 16),
    g: parseInt(c.slice(3, 5), 16),
    b: parseInt(c.slice(5, 7), 16),
  }
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const { r, g, b } = colorToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Relative luminance 0–1 from sRGB hex. */
export function colorLuminance(hex: string): number {
  const { r, g, b } = colorToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function runColorSelfTest(): void {
  if (parseColor('#F00') !== '#ff0000') {
    throw new Error('3-digit hex should expand')
  }
  if (parseColor('808080') !== '#808080') {
    throw new Error('hash is optional')
  }
  if (parseColor('#80') !== null || parseColor('') !== null) {
    throw new Error('short or empty hex is invalid')
  }
  if (formatColor('nope', DEFAULT_FLOOR_COLOR) !== DEFAULT_FLOOR_COLOR) {
    throw new Error('invalid color should use fallback')
  }
}
