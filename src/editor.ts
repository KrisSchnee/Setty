import {
  screenToWorld,
  worldToScreen,
  type Point,
  type View,
  DEFAULT_VIEW,
} from './coords.ts'
import {
  cameraMarkerTriangle,
  pointHitsCameraMarker,
} from './camera.ts'
import { colorLuminance, colorWithAlpha, DEFAULT_FLOOR_COLOR } from './color.ts'
import type { SetDocument } from './document.ts'
import {
  applyCameraHeight,
  applyCameraYaw,
  applyFloorColor,
  applySelectedColor,
  applySkyColor,
  applySelectedHeight,
  cancelDraft,
  clearSelection,
  closeDraft,
  createMapState,
  moveCamera,
  placeDraftPoint,
  selectAt,
  selectCamera,
  setCursor,
  setMode,
  setSnap,
  undo,
  type EditorMode,
  type MapState,
} from './mapState.ts'

const MIN_PPM = 8
const MAX_PPM = 200
const PAN_BUTTON = 1
const FIRST_VERTEX_HIT_PX = 10
const CAMERA_HIT_PX = 12

export type EditorHooks = {
  onChange: (state: MapState) => void
  onExport?: () => void
}

export class MapEditor {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly hooks: EditorHooks
  private state: MapState = createMapState()
  private view: View = { ...DEFAULT_VIEW }
  private spaceDown = false
  private panning = false
  private didPan = false
  private panLast: { x: number; y: number } | null = null
  private cameraDragging = false
  private cameraGrab: Point | null = null
  private ignoreClick = false
  private cssWidth = 1
  private cssHeight = 1

  constructor(canvas: HTMLCanvasElement, hooks: EditorHooks) {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D is unavailable')
    }
    this.canvas = canvas
    this.ctx = ctx
    this.hooks = hooks
    this.bind()
    this.resize()
    this.redraw()
    this.emit()
  }

  getState(): MapState {
    return this.state
  }

  setSnap(snap: boolean): void {
    this.state = setSnap(this.state, snap)
    this.redraw()
    this.emit()
  }

  setMode(mode: EditorMode): void {
    this.state = setMode(this.state, mode)
    this.syncCursor()
    this.redraw()
    this.emit()
  }

  setSelectedHeight(height: number, recordHistory = true): void {
    this.state = applySelectedHeight(this.state, height, recordHistory)
    this.redraw()
    this.emit()
  }

  setSelectedColor(color: string, recordHistory = true): void {
    this.state = applySelectedColor(this.state, color, recordHistory)
    this.redraw()
    this.emit()
  }

  setFloorColor(color: string, recordHistory = true): void {
    this.state = applyFloorColor(this.state, color, recordHistory)
    this.redraw()
    this.emit()
  }

  setSkyColor(color: string, recordHistory = true): void {
    this.state = applySkyColor(this.state, color, recordHistory)
    this.redraw()
    this.emit()
  }

  setCameraYaw(yaw: number, recordHistory = true): void {
    this.state = applyCameraYaw(this.state, yaw, recordHistory)
    this.redraw()
    this.emit()
  }

  setCameraHeight(y: number, recordHistory = true): void {
    this.state = applyCameraHeight(this.state, y, recordHistory)
    this.redraw()
    this.emit()
  }

  commitHistory(previousDoc: SetDocument): void {
    if (this.state.doc === previousDoc) {
      return
    }
    this.state = {
      ...this.state,
      history: [...this.state.history, previousDoc],
    }
    this.emit()
  }

  private emit(): void {
    this.hooks.onChange(this.state)
  }

  private bind(): void {
    this.canvas.tabIndex = 0
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e))
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e))
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e))
    this.canvas.addEventListener('pointercancel', () => {
      this.endPan()
      this.endCameraDrag()
    })
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        this.onWheel(e)
      },
      { passive: false },
    )
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    this.canvas.addEventListener('click', (e) => this.onClick(e))
    this.canvas.addEventListener('dblclick', (e) => {
      e.preventDefault()
    })

    window.addEventListener('keydown', (e) => this.onKeyDown(e))
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false
        this.canvas.classList.remove('panning')
      }
    })
    new ResizeObserver(() => this.resize()).observe(this.canvas)
  }

  private cssPoint(e: PointerEvent | MouseEvent | WheelEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  private worldFromCss(cssX: number, cssY: number): Point {
    return screenToWorld(cssX, cssY, this.cssWidth, this.cssHeight, this.view)
  }

  private hitsFirstVertex(cssX: number, cssY: number): boolean {
    const first = this.state.draft[0]
    if (!first) {
      return false
    }
    const { sx, sy } = worldToScreen(first, this.cssWidth, this.cssHeight, this.view)
    const dx = cssX - sx
    const dy = cssY - sy
    return dx * dx + dy * dy <= FIRST_VERTEX_HIT_PX * FIRST_VERTEX_HIT_PX
  }

  private hitsCamera(world: Point, cssX: number, cssY: number): boolean {
    const pose = this.state.doc.camera
    if (pointHitsCameraMarker(world, pose, this.state.doc.gridSize)) {
      return true
    }
    const { sx, sy } = worldToScreen(
      { x: pose.x, z: pose.z },
      this.cssWidth,
      this.cssHeight,
      this.view,
    )
    const dx = cssX - sx
    const dy = cssY - sy
    return dx * dx + dy * dy <= CAMERA_HIT_PX * CAMERA_HIT_PX
  }

  private onPointerDown(e: PointerEvent): void {
    this.canvas.focus()
    const pan = e.button === PAN_BUTTON || (e.button === 0 && this.spaceDown)
    this.didPan = false
    this.ignoreClick = false
    if (pan) {
      e.preventDefault()
      this.panning = true
      this.panLast = this.cssPoint(e)
      this.canvas.setPointerCapture(e.pointerId)
      this.canvas.classList.add('panning')
      return
    }
    if (e.button === 0 && this.state.mode === 'select') {
      const css = this.cssPoint(e)
      const world = this.worldFromCss(css.x, css.y)
      if (this.hitsCamera(world, css.x, css.y)) {
        e.preventDefault()
        this.state = selectCamera(this.state)
        this.cameraDragging = true
        this.ignoreClick = true
        this.cameraGrab = {
          x: this.state.doc.camera.x - world.x,
          z: this.state.doc.camera.z - world.z,
        }
        this.canvas.setPointerCapture(e.pointerId)
        this.canvas.classList.add('camera-drag')
        this.redraw()
        this.emit()
      }
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const css = this.cssPoint(e)
    const world = this.worldFromCss(css.x, css.y)
    if (this.panning && this.panLast) {
      const dx = css.x - this.panLast.x
      const dy = css.y - this.panLast.y
      this.view.originX -= dx / this.view.pixelsPerMeter
      this.view.originZ -= dy / this.view.pixelsPerMeter
      this.didPan = true
      this.panLast = css
      this.redraw()
      return
    }
    if (this.cameraDragging) {
      const grab = this.cameraGrab ?? { x: 0, z: 0 }
      this.state = moveCamera(this.state, world.x + grab.x, world.z + grab.z)
      this.redraw()
      this.emit()
      return
    }
    this.canvas.classList.toggle(
      'camera-hover',
      this.state.mode === 'select' && this.hitsCamera(world, css.x, css.y),
    )
    this.state = setCursor(this.state, world)
    this.redraw()
    this.emit()
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.panning || this.cameraDragging) {
      this.endPan()
      this.endCameraDrag()
      try {
        this.canvas.releasePointerCapture(e.pointerId)
      } catch {
        // capture already released
      }
    }
  }

  private endPan(): void {
    this.panning = false
    this.panLast = null
    if (!this.spaceDown) {
      this.canvas.classList.remove('panning')
    }
  }

  private endCameraDrag(): void {
    this.cameraDragging = false
    this.cameraGrab = null
    this.canvas.classList.remove('camera-drag')
  }

  private onClick(e: MouseEvent): void {
    if (this.ignoreClick) {
      this.ignoreClick = false
      return
    }
    if (this.spaceDown || this.didPan || e.button !== 0) {
      return
    }
    const css = this.cssPoint(e)
    const raw = this.worldFromCss(css.x, css.y)
    if (this.state.mode === 'select') {
      this.state = selectAt(this.state, raw)
    } else if (e.detail >= 2) {
      this.state = closeDraft(this.state)
    } else {
      this.state = placeDraftPoint(this.state, raw, this.hitsFirstVertex(css.x, css.y))
    }
    this.redraw()
    this.emit()
  }

  private onWheel(e: WheelEvent): void {
    const css = this.cssPoint(e)
    const before = this.worldFromCss(css.x, css.y)
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    this.view.pixelsPerMeter = clamp(
      this.view.pixelsPerMeter * factor,
      MIN_PPM,
      MAX_PPM,
    )
    const after = this.worldFromCss(css.x, css.y)
    this.view.originX += before.x - after.x
    this.view.originZ += before.z - after.z
    this.state = setCursor(this.state, after)
    this.redraw()
    this.emit()
  }

  private onKeyDown(e: KeyboardEvent): void {
    const typing =
      e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
    if (typing) {
      return
    }

    if (e.code === 'Space') {
      if (!e.repeat) {
        this.spaceDown = true
        this.canvas.classList.add('panning')
      }
      e.preventDefault()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault()
      this.state = undo(this.state)
      this.redraw()
      this.emit()
      return
    }

    if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      this.setMode('place')
      return
    }

    if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      this.setMode('select')
      return
    }

    if (e.code === 'KeyE' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      this.hooks.onExport?.()
      return
    }

    if (e.code === 'Enter') {
      if (this.state.mode !== 'place') {
        return
      }
      e.preventDefault()
      this.state = closeDraft(this.state)
      this.redraw()
      this.emit()
      return
    }

    if (e.code === 'Escape') {
      e.preventDefault()
      this.state =
        this.state.mode === 'select' ? clearSelection(this.state) : cancelDraft(this.state)
      this.redraw()
      this.emit()
      return
    }

    if (e.code === 'Backspace') {
      e.preventDefault()
      this.state = undo(this.state)
      this.redraw()
      this.emit()
      return
    }

    if (e.code === 'KeyG' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      this.setSnap(!this.state.snap)
    }
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    this.cssWidth = Math.max(1, rect.width)
    this.cssHeight = Math.max(1, rect.height)
    this.canvas.width = Math.round(this.cssWidth * dpr)
    this.canvas.height = Math.round(this.cssHeight * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.syncCursor()
    this.redraw()
  }

  private syncCursor(): void {
    this.canvas.classList.toggle('select-mode', this.state.mode === 'select')
    this.canvas.classList.toggle('floor-selected', this.state.floorSelected)
  }

  redraw(): void {
    this.syncCursor()
    const { ctx } = this
    const w = this.cssWidth
    const h = this.cssHeight
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = this.state.doc.floorColor || DEFAULT_FLOOR_COLOR
    ctx.fillRect(0, 0, w, h)
    this.drawGrid()
    this.drawAxes()
    for (const poly of this.state.doc.polygons) {
      this.drawPolygon(
        poly.points,
        poly.id === this.state.selectedId ? 'selected' : 'solid',
        poly.color,
      )
    }
    if (this.state.mode === 'place' && this.state.draft.length > 0) {
      const pts = this.state.cursor
        ? [...this.state.draft, this.state.cursor]
        : this.state.draft
      this.drawPolygon(pts, 'draft')
    } else if (this.state.mode === 'place' && this.state.cursor && this.state.snap) {
      this.drawHandle(this.state.cursor, '#e6b84d')
    }
    this.drawCamera()
    this.drawFloorSelection()
  }

  private drawFloorSelection(): void {
    if (!this.state.floorSelected) {
      return
    }
    const { ctx } = this
    ctx.strokeStyle = '#e6b84d'
    ctx.lineWidth = 3
    ctx.strokeRect(1.5, 1.5, this.cssWidth - 3, this.cssHeight - 3)
  }

  private drawCamera(): void {
    const { ctx } = this
    const tri = cameraMarkerTriangle(this.state.doc.camera, this.state.doc.gridSize)
    const screens = tri.map((p) =>
      worldToScreen(p, this.cssWidth, this.cssHeight, this.view),
    )
    const first = screens[0]
    if (!first) {
      return
    }
    ctx.beginPath()
    ctx.moveTo(first.sx, first.sy)
    for (let i = 1; i < screens.length; i++) {
      ctx.lineTo(screens[i]!.sx, screens[i]!.sy)
    }
    ctx.closePath()
    ctx.fillStyle = '#ffff00'
    ctx.fill()
    if (this.state.cameraSelected) {
      ctx.strokeStyle = '#e6b84d'
      ctx.lineWidth = 2.5
    } else {
      ctx.strokeStyle = '#16181b'
      ctx.lineWidth = 1
    }
    ctx.stroke()
  }

  private drawGrid(): void {
    const { ctx, view, state } = this
    const w = this.cssWidth
    const h = this.cssHeight
    const step = gridStep(view.pixelsPerMeter, state.doc.gridSize)
    const topLeft = screenToWorld(0, 0, w, h, view)
    const bottomRight = screenToWorld(w, h, w, h, view)
    const xMin = Math.min(topLeft.x, bottomRight.x)
    const xMax = Math.max(topLeft.x, bottomRight.x)
    const zMin = Math.min(topLeft.z, bottomRight.z)
    const zMax = Math.max(topLeft.z, bottomRight.z)
    const x0 = Math.floor(xMin / step) * step
    const z0 = Math.floor(zMin / step) * step

    ctx.beginPath()
    const lum = colorLuminance(state.doc.floorColor)
    ctx.strokeStyle = lum > 0.45 ? 'rgba(0,0,0,0.22)' : '#2a2e33'
    ctx.lineWidth = 1
    for (let x = x0; x <= xMax + 1e-9; x += step) {
      const { sx } = worldToScreen({ x, z: 0 }, w, h, view)
      ctx.moveTo(Math.round(sx) + 0.5, 0)
      ctx.lineTo(Math.round(sx) + 0.5, h)
    }
    for (let z = z0; z <= zMax + 1e-9; z += step) {
      const { sy } = worldToScreen({ x: 0, z }, w, h, view)
      ctx.moveTo(0, Math.round(sy) + 0.5)
      ctx.lineTo(w, Math.round(sy) + 0.5)
    }
    ctx.stroke()
  }

  private drawAxes(): void {
    const { ctx, view } = this
    const w = this.cssWidth
    const h = this.cssHeight
    const origin = worldToScreen({ x: 0, z: 0 }, w, h, view)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.strokeStyle = '#6a3a3a'
    ctx.moveTo(0, origin.sy)
    ctx.lineTo(w, origin.sy)
    ctx.stroke()
    ctx.beginPath()
    ctx.strokeStyle = '#3a4a6a'
    ctx.moveTo(origin.sx, 0)
    ctx.lineTo(origin.sx, h)
    ctx.stroke()

    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillStyle = '#8a6a6a'
    ctx.fillText('+X', w - 22, origin.sy - 6)
    ctx.fillStyle = '#6a7a9a'
    ctx.fillText('+Z', origin.sx + 6, h - 8)
  }

  private drawPolygon(
    points: Point[],
    kind: 'draft' | 'solid' | 'selected',
    color = '#9ec9de',
  ): void {
    if (points.length === 0) {
      return
    }
    const { ctx, view } = this
    const w = this.cssWidth
    const h = this.cssHeight
    const screens = points.map((p) => worldToScreen(p, w, h, view))

    if (screens.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(screens[0]!.sx, screens[0]!.sy)
      for (let i = 1; i < screens.length; i++) {
        ctx.lineTo(screens[i]!.sx, screens[i]!.sy)
      }
      if (kind !== 'draft') {
        ctx.closePath()
        ctx.fillStyle =
          kind === 'selected' ? colorWithAlpha(color, 0.45) : colorWithAlpha(color, 0.7)
        ctx.fill()
        ctx.strokeStyle = kind === 'selected' ? '#e6b84d' : color
        ctx.lineWidth = kind === 'selected' ? 2.5 : 2
        ctx.stroke()
      } else {
        ctx.strokeStyle = '#e6b84d'
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.setLineDash([])
        if (this.state.draft.length >= 3 && this.state.cursor) {
          const first = screens[0]!
          const last = screens[screens.length - 1]!
          ctx.beginPath()
          ctx.strokeStyle = 'rgba(230, 184, 77, 0.45)'
          ctx.setLineDash([3, 5])
          ctx.moveTo(last.sx, last.sy)
          ctx.lineTo(first.sx, first.sy)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
    }

    const handleColor = kind === 'solid' ? '#cfe8f4' : '#e6b84d'
    const verts = kind === 'draft' ? this.state.draft : points
    for (const p of verts) {
      this.drawHandle(p, handleColor)
    }
  }

  private drawHandle(p: Point, color: string): void {
    const { sx, sy } = worldToScreen(p, this.cssWidth, this.cssHeight, this.view)
    const { ctx } = this
    ctx.beginPath()
    ctx.fillStyle = color
    ctx.arc(sx, sy, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#16181b'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function gridStep(pixelsPerMeter: number, gridSize: number): number {
  let step = gridSize
  while (step * pixelsPerMeter < 12) {
    step *= 2
  }
  return step
}
