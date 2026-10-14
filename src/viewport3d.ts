import * as THREE from 'three'
import { cameraForward } from './camera.ts'
import {
  DEFAULT_FLOOR_COLOR,
  DEFAULT_POLYGON_COLOR,
  DEFAULT_SKY_COLOR,
  parseColor,
} from './color.ts'
import { DEFAULT_CAMERA, type CameraPose, type Polygon, type SetDocument } from './document.ts'
import { STILL_HEIGHT, STILL_MIME, STILL_WIDTH } from './still.ts'

const FLOOR_SIZE = 400
const VOLUME_LIFT = 0.002
const EDGE_COLOR = 0x333333
/** Skip coplanar cap triangulation; keep 90° wall/roof creases. */
const EDGE_THRESHOLD_DEG = 15

/** Eye-height default. Roll is 0 so the ground stays horizontal. */
export const CAMERA_EYE = DEFAULT_CAMERA

/**
 * Shape uses (x, −z) so that ExtrudeGeometry's +Z depth, after
 * rotateX(−π/2), becomes world +Y and map +Z stays world +Z.
 *
 * Check: map point (0, z=4) → shape (0, −4) → after Rx(−π/2) → (0, y, 4).
 * Rx(−π/2): (x, y, z) → (x, z, −y).
 */
export function buildVolumeGeometry(poly: Polygon): THREE.ExtrudeGeometry | null {
  if (poly.points.length < 3) {
    return null
  }
  const shape = new THREE.Shape()
  const first = poly.points[0]!
  shape.moveTo(first.x, -first.z)
  for (let i = 1; i < poly.points.length; i++) {
    const p = poly.points[i]!
    shape.lineTo(p.x, -p.z)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(poly.height, 1e-4),
    bevelEnabled: false,
    steps: 1,
  })
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, VOLUME_LIFT, 0)
  return geo
}

export function runViewportSelfTest(): void {
  const geo = buildVolumeGeometry({
    id: 'test',
    height: 3,
    color: DEFAULT_POLYGON_COLOR,
    points: [
      { x: 0, z: 4 },
      { x: 1, z: 4 },
      { x: 0, z: 5 },
    ],
  })
  if (!geo) throw new Error('expected volume geometry')
  const pos = geo.attributes.position
  let maxZ = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < pos.count; i++) {
    maxZ = Math.max(maxZ, pos.getZ(i))
    minY = Math.min(minY, pos.getY(i))
    maxY = Math.max(maxY, pos.getY(i))
  }
  if (maxZ < 4.5) {
    throw new Error(`map +Z must stay world +Z, maxZ=${maxZ}`)
  }
  if (minY > 0.05 || maxY < 2.9) {
    throw new Error(`expected extrusion near 0..3 on Y, y=${minY}..${maxY}`)
  }
  const edges = new THREE.EdgesGeometry(geo, EDGE_THRESHOLD_DEG)
  const edgeCount = edges.attributes.position.count / 2
  edges.dispose()
  geo.dispose()
  if (edgeCount < 9) {
    throw new Error(`triangle prism should have 9 creases, got ${edgeCount}`)
  }

  const floor = new THREE.PlaneGeometry(2, 2)
  floor.rotateX(-Math.PI / 2)
  floor.computeVertexNormals()
  const n = floor.attributes.normal
  if (n.getY(0) <= 0) {
    throw new Error('floor must face +Y so it is visible from above')
  }
  floor.dispose()

  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500)
  const pose = DEFAULT_CAMERA
  const fwd = cameraForward(pose.yaw)
  cam.up.set(0, 1, 0)
  cam.position.set(pose.x, pose.y, pose.z)
  cam.lookAt(pose.x + fwd.x, pose.y, pose.z + fwd.z)
  cam.updateMatrixWorld(true)
  const look = new THREE.Vector3()
  cam.getWorldDirection(look)
  if (Math.abs(look.x - 1) > 1e-5 || Math.abs(look.y) > 1e-5 || Math.abs(look.z) > 1e-5) {
    throw new Error(`default lookAt must face +X, got ${look.toArray()}`)
  }
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
  if (right.z < 0.9) {
    throw new Error(`default screen-right must be +Z, got ${right.toArray()}`)
  }
  cam.lookAt(pose.x + cameraForward(90).x, pose.y, pose.z + cameraForward(90).z)
  cam.updateMatrixWorld(true)
  cam.getWorldDirection(look)
  if (Math.abs(look.x) > 1e-5 || Math.abs(look.z - 1) > 1e-5) {
    throw new Error(`yaw 90 lookAt must face +Z, got ${look.toArray()}`)
  }
}

export class Viewport3D {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly volumes = new THREE.Group()
  private readonly floorMat = new THREE.MeshBasicMaterial({
    color: DEFAULT_FLOOR_COLOR,
  })
  private readonly edgeMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR })
  private readonly canvas: HTMLCanvasElement
  private doc: SetDocument | null = null
  private sceneDirty = true
  private renderDirty = true

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    })
    this.renderer.setClearColor(DEFAULT_SKY_COLOR)
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500)
    this.applyCamera(DEFAULT_CAMERA)

    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    if (
      Math.abs(forward.x - 1) > 1e-5 ||
      Math.abs(forward.y) > 1e-5 ||
      Math.abs(forward.z) > 1e-5
    ) {
      throw new Error(`default camera must look along +X, got ${forward.toArray()}`)
    }
    const look = cameraForward(DEFAULT_CAMERA.yaw)
    if (Math.abs(look.x - 1) > 1e-9 || Math.abs(look.z) > 1e-9) {
      throw new Error(`heading 0 must be +X, got ${JSON.stringify(look)}`)
    }
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
    if (right.z < 0.9) {
      throw new Error(`default camera screen-right must be +Z, got ${right.toArray()}`)
    }

    this.scene.add(this.makeFloor())
    this.scene.add(this.volumes)
    new ResizeObserver(() => this.resize()).observe(canvas)
    this.resize()
  }

  setDocument(doc: SetDocument): void {
    const polygonsChanged = !this.doc || this.doc.polygons !== doc.polygons
    this.doc = doc
    if (polygonsChanged) {
      this.sceneDirty = true
    }
    this.applyFloorColor(doc.floorColor)
    this.applySkyColor(doc.skyColor)
    this.applyCamera(doc.camera)
    this.renderDirty = true
    this.flush()
  }

  markDirty(): void {
    this.renderDirty = true
    this.flush()
  }

  /** 16:9 PNG of the camera view at 1920×1080, independent of the preview size. */
  captureStill(): Promise<Blob> {
    this.flush()
    const prevAspect = this.camera.aspect
    const canvas = document.createElement('canvas')
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    })
    try {
      renderer.setClearColor(
        this.renderer.getClearColor(new THREE.Color()),
        this.renderer.getClearAlpha(),
      )
      renderer.setPixelRatio(1)
      renderer.setSize(STILL_WIDTH, STILL_HEIGHT, false)
      this.camera.aspect = STILL_WIDTH / STILL_HEIGHT
      this.camera.updateProjectionMatrix()
      renderer.render(this.scene, this.camera)
    } finally {
      this.camera.aspect = prevAspect
      this.camera.updateProjectionMatrix()
      this.renderDirty = true
      this.flush()
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        renderer.dispose()
        if (!blob || blob.size === 0) {
          reject(new Error('Could not export a still'))
          return
        }
        resolve(blob)
      }, STILL_MIME)
    })
  }

  private flush(): void {
    if (this.sceneDirty) {
      this.rebuildVolumes()
      this.sceneDirty = false
    }
    if (this.renderDirty) {
      this.renderer.render(this.scene, this.camera)
      this.renderDirty = false
    }
  }

  private applyCamera(pose: CameraPose): void {
    const fwd = cameraForward(pose.yaw)
    this.camera.up.set(0, 1, 0)
    this.camera.position.set(pose.x, pose.y, pose.z)
    this.camera.lookAt(pose.x + fwd.x, pose.y, pose.z + fwd.z)
    this.camera.updateMatrixWorld(true)
  }

  private applyFloorColor(color: string): void {
    const hex = parseColor(color) ?? DEFAULT_FLOOR_COLOR
    this.floorMat.color.set(hex)
  }

  private applySkyColor(color: string): void {
    const hex = parseColor(color) ?? DEFAULT_SKY_COLOR
    this.renderer.setClearColor(hex)
  }

  private makeFloor(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE)
    geo.rotateX(-Math.PI / 2)
    return new THREE.Mesh(geo, this.floorMat)
  }

  private rebuildVolumes(): void {
    for (const child of [...this.volumes.children]) {
      this.volumes.remove(child)
      disposeVolume(child)
    }
    if (!this.doc) {
      return
    }
    for (const poly of this.doc.polygons) {
      const geo = buildVolumeGeometry(poly)
      if (!geo) {
        continue
      }
      const mat = new THREE.MeshBasicMaterial({
        color: parseColor(poly.color) ?? DEFAULT_POLYGON_COLOR,
        // Inner and outer walls share this material so a camera inside a volume
        // sees the same color/texture as from outside.
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.add(
        new THREE.LineSegments(new THREE.EdgesGeometry(geo, EDGE_THRESHOLD_DEG), this.edgeMat),
      )
      this.volumes.add(mesh)
    }
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width * dpr))
    const h = Math.max(1, Math.round(rect.height * dpr))
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderDirty = true
    this.flush()
  }
}

function disposeVolume(obj: THREE.Object3D): void {
  for (const child of [...obj.children]) {
    obj.remove(child)
    disposeVolume(child)
  }
  if (obj instanceof THREE.Mesh) {
    obj.geometry.dispose()
    const mat = obj.material
    if (!Array.isArray(mat)) {
      mat.dispose()
    }
  } else if (obj instanceof THREE.LineSegments) {
    obj.geometry.dispose()
  }
}
