/**
 * World frame (Three.js, Y-up, right-handed):
 *   +Y up, +X right, local camera forward −Z.
 * Ground plane is XZ. Polygon points are {x, z} in meters.
 *
 * 2D map canvas: +X right, +Z down the screen.
 * A later top-down Three.js camera sits on +Y, looks at the origin,
 * and uses camera.up = (0, 0, −1) so its screen axes match this map.
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
