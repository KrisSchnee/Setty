import { pointInPolygon, worldToScreen, type Point } from './coords.ts'
import type { CameraPose } from './document.ts'

/** Marker base width, in grid squares. */
export const CAMERA_MARKER_WIDTH_GRIDS = 0.5
/** Apex distance ahead of the eye, in grid squares. */
export const CAMERA_MARKER_LENGTH_GRIDS = 0.55
/** Base sits this far behind the eye so the marker contains the camera. */
export const CAMERA_MARKER_BACK_GRIDS = 0.12

/**
 * Ground-plane look direction from heading degrees CCW from +X.
 * Check: yaw 0 → (1, 0) in (x, z); yaw 90 → (0, 1).
 */
export function cameraForward(yawDegrees: number): Point {
  const theta = (yawDegrees * Math.PI) / 180
  return { x: Math.cos(theta), z: Math.sin(theta) }
}

/** Right on the ground plane: forward × up, up = (0, 1, 0). */
export function cameraRight(forward: Point): Point {
  // fwd=(1, 0) → right=(0, 1) = world +Z
  return { x: -forward.z, z: forward.x }
}

/** Apex ahead of the eye, base slightly behind it. Points along look direction. */
export function cameraMarkerTriangle(pose: CameraPose, gridSize: number): Point[] {
  const fwd = cameraForward(pose.yaw)
  const right = cameraRight(fwd)
  const half = (CAMERA_MARKER_WIDTH_GRIDS * gridSize) / 2
  const length = CAMERA_MARKER_LENGTH_GRIDS * gridSize
  const back = CAMERA_MARKER_BACK_GRIDS * gridSize
  const bx = pose.x - fwd.x * back
  const bz = pose.z - fwd.z * back
  return [
    { x: pose.x + fwd.x * length, z: pose.z + fwd.z * length },
    { x: bx + right.x * half, z: bz + right.z * half },
    { x: bx - right.x * half, z: bz - right.z * half },
  ]
}

export function pointHitsCameraMarker(
  p: Point,
  pose: CameraPose,
  gridSize: number,
): boolean {
  return pointInPolygon(p, cameraMarkerTriangle(pose, gridSize))
}

export function runCameraSelfTest(): void {
  const fwd0 = cameraForward(0)
  if (Math.abs(fwd0.x - 1) > 1e-9 || Math.abs(fwd0.z) > 1e-9) {
    throw new Error(`yaw 0 must look +X, got ${JSON.stringify(fwd0)}`)
  }
  const right0 = cameraRight(fwd0)
  if (Math.abs(right0.x) > 1e-9 || right0.z < 0.9) {
    throw new Error(`yaw 0 screen-right must be +Z, got ${JSON.stringify(right0)}`)
  }
  const fwd90 = cameraForward(90)
  if (Math.abs(fwd90.x) > 1e-9 || Math.abs(fwd90.z - 1) > 1e-9) {
    throw new Error(`yaw 90 must look +Z, got ${JSON.stringify(fwd90)}`)
  }
  const fwd180 = cameraForward(180)
  if (Math.abs(fwd180.x + 1) > 1e-9 || Math.abs(fwd180.z) > 1e-9) {
    throw new Error(`yaw 180 must look −X, got ${JSON.stringify(fwd180)}`)
  }
  const fwd270 = cameraForward(270)
  if (Math.abs(fwd270.x) > 1e-9 || Math.abs(fwd270.z + 1) > 1e-9) {
    throw new Error(`yaw 270 must look −Z, got ${JSON.stringify(fwd270)}`)
  }
  const pose: CameraPose = { x: 0, y: 1.5, z: 0, yaw: 0 }
  const tri = cameraMarkerTriangle(pose, 1)
  const apex = tri[0]!
  if (!(apex.x > 0.5)) {
    throw new Error(`default marker must point toward +X, apex x=${apex.x}`)
  }
  if (!pointHitsCameraMarker({ x: 0, z: 0 }, pose, 1)) {
    throw new Error('eye should sit on the marker')
  }
  if (pointHitsCameraMarker({ x: 10, z: 10 }, pose, 1)) {
    throw new Error('far point should miss the marker')
  }
  const tri90 = cameraMarkerTriangle({ ...pose, yaw: 90 }, 1)
  if (!(tri90[0]!.z > 0.5)) {
    throw new Error(`yaw 90 marker must point toward +Z, apex z=${tri90[0]!.z}`)
  }

  // Map-right of the camera marker must be world-right (3D screen-right).
  const view = { originX: 0, originZ: 0, pixelsPerMeter: 40 }
  for (const yaw of [0, 90, 180, 270]) {
    const fwd = cameraForward(yaw)
    const right = cameraRight(fwd)
    const eye = worldToScreen({ x: 0, z: 0 }, 200, 200, view)
    const ahead = worldToScreen({ x: fwd.x, z: fwd.z }, 200, 200, view)
    const side = worldToScreen({ x: right.x, z: right.z }, 200, 200, view)
    const fx = ahead.sx - eye.sx
    const fy = ahead.sy - eye.sy
    const along =
      (side.sx - eye.sx) * -fy + (side.sy - eye.sy) * fx
    if (along <= 0) {
      throw new Error(`yaw ${yaw}: world-right must sit to the map-right of the camera`)
    }
  }
}
