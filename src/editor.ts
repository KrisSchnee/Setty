import {
  screenToWorld,
  worldToScreen,
  type Point,
  type View,
  DEFAULT_VIEW,
} from './coords.ts'
import {
  addDraftPoint,
  cancelDraft,
  closeDraft,
  createMapState,
  setCursor,
  setSnap,
  undo,
  type MapState,
} from './mapState.ts'

const MIN_PPM = 8
const MAX_PPM = 200
const PAN_BUTTON = 1

export type EditorHooks = {
  onChange: (state: MapState) => void
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

  private emit(): void {
    this.hooks.onChange(this.state)
  }

  private bind(): void {
    this.canvas.tabIndex = 0
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e))
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e))
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e))
    this.canvas.addEventListener('pointercancel', () => this.endPan())
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

  private onPointerDown(e: PointerEvent): void {
    this.canvas.focus()
    const pan = e.button === PAN_BUTTON || (e.button === 0 && this.spaceDown)
    this.didPan = false
    if (pan) {
      e.preventDefault()
      this.panning = true
      this.panLast = this.cssPoint(e)
      this.canvas.setPointerCapture(e.pointerId)
      this.canvas.classList.add('panning')
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const css = this.cssPoint(e)
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
    this.state = setCursor(this.state, this.worldFromCss(css.x, css.y))
    this.redraw()
    this.emit()
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.panning) {
      this.endPan()
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

  private onClick(e: MouseEvent): void {
    if (this.spaceDown || this.didPan || e.button !== 0) {
      return
    }
    const css = this.cssPoint(e)
    const raw = this.worldFromCss(css.x, css.y)
    if (e.detail >= 2) {
      this.state = closeDraft(this.state)
    } else {
      this.state = addDraftPoint(this.state, raw)
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
    if (e.code === 'Space') {
      if (!e.repeat) {
        this.spaceDown = true
        this.canvas.classList.add('panning')
      }
      e.preventDefault()
      return
    }

    const typing =
      e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
    if (typing) {
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault()
      this.state = undo(this.state)
      this.redraw()
      this.emit()
      return
    }

    if (e.code === 'Enter') {
      e.preventDefault()
      this.state = closeDraft(this.state)
      this.redraw()
      this.emit()
      return
    }

    if (e.code === 'Escape') {
      e.preventDefault()
      this.state = cancelDraft(this.state)
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
    this.redraw()
  }

  redraw(): void {
    const { ctx } = this
    const w = this.cssWidth
    const h = this.cssHeight
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#16181b'
    ctx.fillRect(0, 0, w, h)
    this.drawGrid()
    this.drawAxes()
    for (const poly of this.state.doc.polygons) {
      this.drawPolygon(poly.points, false)
    }
    if (this.state.draft.length > 0) {
      const pts = this.state.cursor
        ? [...this.state.draft, this.state.cursor]
        : this.state.draft
      this.drawPolygon(pts, true)
    } else if (this.state.cursor && this.state.snap) {
      this.drawHandle(this.state.cursor, '#e6b84d')
    }
  }

  private drawGrid(): void {
    const { ctx, view, state } = this
    const w = this.cssWidth
    const h = this.cssHeight
    const step = gridStep(view.pixelsPerMeter, state.doc.gridSize)
    const topLeft = screenToWorld(0, 0, w, h, view)
    const bottomRight = screenToWorld(w, h, w, h, view)
    const x0 = Math.floor(topLeft.x / step) * step
    const z0 = Math.floor(topLeft.z / step) * step

    ctx.beginPath()
    ctx.strokeStyle = '#2a2e33'
    ctx.lineWidth = 1
    for (let x = x0; x <= bottomRight.x + 1e-9; x += step) {
      const { sx } = worldToScreen({ x, z: 0 }, w, h, view)
      ctx.moveTo(Math.round(sx) + 0.5, 0)
      ctx.lineTo(Math.round(sx) + 0.5, h)
    }
    for (let z = z0; z <= bottomRight.z + 1e-9; z += step) {
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
    ctx.fillText('+Z', origin.sx + 6, h - 10)
  }

  private drawPolygon(points: Point[], draft: boolean): void {
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
      if (!draft) {
        ctx.closePath()
        ctx.fillStyle = 'rgba(110, 168, 196, 0.22)'
        ctx.fill()
        ctx.strokeStyle = '#9ec9de'
        ctx.lineWidth = 2
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

    const handleColor = draft ? '#e6b84d' : '#cfe8f4'
    const verts = draft ? this.state.draft : points
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
