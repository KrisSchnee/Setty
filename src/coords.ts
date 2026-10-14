/**
 * World frame (Three.js, Y-up, right-handed):
 *   +Y up, +X right, local camera forward −Z.
 * Ground plane is XZ. Polygon points are {x, z} in meters.
 *
 * 2D map is a true top-down (looking from +Y): +X right, +Z down the screen.
 * That matches Three.js camera.up = (0, 0, −1) when looking down, so a
 * camera's map-right is its world-right (forward × up) and the 3D preview
 * is not mirrored. Heading is degrees CCW from +X (0 looks +X, 90 looks +Z).
 */

export type Point = {
  x: number
  z: number
}

export type View = {
  originX: number
  originZ: number
  pixelsPerMeter: number
}

export const DEFAULT_VIEW: View = {
  originX: 0,
  originZ: 0,
  pixelsPerMeter: 40,
}

export function snapPoint(p: Point, gridSize: number): Point {
  return {
    x: Math.round(p.x / gridSize) * gridSize,
    z: Math.round(p.z / gridSize) * gridSize,
  }
}

export function samePoint(a: Point, b: Point, epsilon = 1e-9): boolean {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.z - b.z) < epsilon
}

/** Even-odd point-in-polygon on the XZ ground plane. */
export function pointInPolygon(p: Point, verts: Point[]): boolean {
  if (verts.length < 3) {
    return false
  }
  let inside = false
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const a = verts[i]!
    const b = verts[j]!
    const crosses =
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    if (crosses) {
      inside = !inside
    }
  }
  return inside
}

export function screenToWorld(
  sx: number,
  sy: number,
  canvasWidth: number,
  canvasHeight: number,
  view: View,
): Point {
  return {
    x: view.originX + (sx - canvasWidth / 2) / view.pixelsPerMeter,
    z: view.originZ + (sy - canvasHeight / 2) / view.pixelsPerMeter,
  }
}

export function worldToScreen(
  p: Point,
  canvasWidth: number,
  canvasHeight: number,
  view: View,
): { sx: number; sy: number } {
  return {
    sx: (p.x - view.originX) * view.pixelsPerMeter + canvasWidth / 2,
    sy: (p.z - view.originZ) * view.pixelsPerMeter + canvasHeight / 2,
  }
}

export function runCoordsSelfTest(): void {
  const view: View = { originX: 0, originZ: 0, pixelsPerMeter: 40 }
  const origin = worldToScreen({ x: 0, z: 0 }, 200, 200, view)
  const north = worldToScreen({ x: 0, z: 1 }, 200, 200, view)
  const east = worldToScreen({ x: 1, z: 0 }, 200, 200, view)
  if (!(north.sy > origin.sy)) {
    throw new Error('+Z must appear down on the 2D map')
  }
  if (!(east.sx > origin.sx)) {
    throw new Error('+X must appear right on the 2D map')
  }
  const roundTrip = screenToWorld(north.sx, north.sy, 200, 200, view)
  if (Math.abs(roundTrip.x) > 1e-9 || Math.abs(roundTrip.z - 1) > 1e-9) {
    throw new Error(`screen/world round-trip failed: ${JSON.stringify(roundTrip)}`)
  }

  const square: Point[] = [
    { x: 0, z: 0 },
    { x: 2, z: 0 },
    { x: 2, z: 2 },
    { x: 0, z: 2 },
  ]
  if (!pointInPolygon({ x: 1, z: 1 }, square)) {
    throw new Error('centroid should be inside the square')
  }
  if (pointInPolygon({ x: 3, z: 1 }, square)) {
    throw new Error('point outside the square should miss')
  }
}
