import {
  DEFAULT_FLOOR_COLOR,
  DEFAULT_POLYGON_COLOR,
  DEFAULT_SKY_COLOR,
  parseColor,
} from './color.ts'
import type { Point } from './coords.ts'

export const DOCUMENT_VERSION = 1 as const

/** Default interior wall height in meters. */
export const DEFAULT_HEIGHT = 3
export const MIN_HEIGHT = 0
export const MAX_HEIGHT = 100

export function quantizeHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_HEIGHT
  }
  const rounded = Math.round(value * 10) / 10
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, rounded))
}

export function formatHeight(value: number): string {
  const q = quantizeHeight(value)
  return Number.isInteger(q) ? String(q) : q.toFixed(1)
}

export const DEFAULT_CAMERA_Y = 1.5
export const MIN_CAMERA_Y = 0.1
export const MAX_CAMERA_Y = 100

/** Heading degrees, CCW from +X. 0 faces +X; 90 faces +Z. */
export function quantizeYaw(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  const rounded = Math.round(value)
  return ((rounded % 360) + 360) % 360
}

export function formatYaw(value: number): string {
  return String(quantizeYaw(value))
}

export function quantizeCameraHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CAMERA_Y
  }
  const rounded = Math.round(value * 10) / 10
  return Math.min(MAX_CAMERA_Y, Math.max(MIN_CAMERA_Y, rounded))
}

export function formatCameraHeight(value: number): string {
  const q = quantizeCameraHeight(value)
  return Number.isInteger(q) ? String(q) : q.toFixed(1)
}

export type Polygon = {
  id: string
  points: Point[]
  height: number
  color: string
}

/**
 * Yaw is integer degrees around +Y, measured CCW from +X (0–359).
 * 0 looks along world +X; 90 looks along world +Z.
 */
export type CameraPose = {
  x: number
  y: number
  z: number
  yaw: number
}

export const DEFAULT_CAMERA: CameraPose = { x: 0, y: DEFAULT_CAMERA_Y, z: 0, yaw: 0 }

export type SetDocument = {
  version: typeof DOCUMENT_VERSION
  gridSize: number
  polygons: Polygon[]
  camera: CameraPose
  floorColor: string
  skyColor: string
}

export function createDocument(): SetDocument {
  return {
    version: DOCUMENT_VERSION,
    gridSize: 1,
    polygons: [],
    camera: { ...DEFAULT_CAMERA },
    floorColor: DEFAULT_FLOOR_COLOR,
    skyColor: DEFAULT_SKY_COLOR,
  }
}

export function addPolygon(doc: SetDocument, points: Point[]): SetDocument {
  if (points.length < 3) {
    throw new Error('A polygon needs at least 3 points')
  }
  return {
    ...doc,
    polygons: [
      ...doc.polygons,
      {
        id: crypto.randomUUID(),
        points: points.map((p) => ({ x: p.x, z: p.z })),
        height: DEFAULT_HEIGHT,
        color: DEFAULT_POLYGON_COLOR,
      },
    ],
  }
}

export function setCameraPosition(doc: SetDocument, x: number, z: number): SetDocument {
  if (doc.camera.x === x && doc.camera.z === z) {
    return doc
  }
  return {
    ...doc,
    camera: { ...doc.camera, x, z },
  }
}

export function setCameraYaw(doc: SetDocument, yaw: number): SetDocument {
  const next = quantizeYaw(yaw)
  if (doc.camera.yaw === next) {
    return doc
  }
  return {
    ...doc,
    camera: { ...doc.camera, yaw: next },
  }
}

export function setCameraHeight(doc: SetDocument, y: number): SetDocument {
  const next = quantizeCameraHeight(y)
  if (doc.camera.y === next) {
    return doc
  }
  return {
    ...doc,
    camera: { ...doc.camera, y: next },
  }
}

export function polygonById(doc: SetDocument, id: string): Polygon | undefined {
  return doc.polygons.find((p) => p.id === id)
}

export function setPolygonHeight(
  doc: SetDocument,
  id: string,
  height: number,
): SetDocument {
  const nextHeight = quantizeHeight(height)
  let changed = false
  const polygons = doc.polygons.map((poly) => {
    if (poly.id !== id || poly.height === nextHeight) {
      return poly
    }
    changed = true
    return { ...poly, height: nextHeight }
  })
  return changed ? { ...doc, polygons } : doc
}

export function setPolygonColor(
  doc: SetDocument,
  id: string,
  color: string,
): SetDocument {
  const nextColor = parseColor(color)
  if (!nextColor) {
    return doc
  }
  let changed = false
  const polygons = doc.polygons.map((poly) => {
    if (poly.id !== id || poly.color === nextColor) {
      return poly
    }
    changed = true
    return { ...poly, color: nextColor }
  })
  return changed ? { ...doc, polygons } : doc
}

export function setFloorColor(doc: SetDocument, color: string): SetDocument {
  const next = parseColor(color)
  if (!next || doc.floorColor === next) {
    return doc
  }
  return { ...doc, floorColor: next }
}

export function setSkyColor(doc: SetDocument, color: string): SetDocument {
  const next = parseColor(color)
  if (!next || doc.skyColor === next) {
    return doc
  }
  return { ...doc, skyColor: next }
}
