import type { Point } from './coords.ts'

export const DOCUMENT_VERSION = 1 as const

/** Default interior wall height in meters. */
export const DEFAULT_HEIGHT = 2.4

export type Polygon = {
  id: string
  points: Point[]
  height: number
}

export type SetDocument = {
  version: typeof DOCUMENT_VERSION
  gridSize: number
  polygons: Polygon[]
}

export function createDocument(): SetDocument {
  return {
    version: DOCUMENT_VERSION,
    gridSize: 1,
    polygons: [],
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
      },
    ],
  }
}
