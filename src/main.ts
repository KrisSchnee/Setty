import './style.css'
import { runCameraSelfTest } from './camera.ts'
import { formatColor, parseColor, runColorSelfTest } from './color.ts'
import { MapEditor } from './editor.ts'
import { runCoordsSelfTest } from './coords.ts'
import { selectedPolygon, runSelfTest } from './mapState.ts'
import type { MapState } from './mapState.ts'
import type { SetDocument } from './document.ts'
import { formatCameraHeight, formatHeight, formatYaw } from './document.ts'
import { downloadBlob, runStillSelfTest, stillFilename } from './still.ts'
import { runViewportSelfTest, Viewport3D } from './viewport3d.ts'

runCoordsSelfTest()
runColorSelfTest()
runCameraSelfTest()
runSelfTest()
runViewportSelfTest()
runStillSelfTest()

function must<T>(el: T | null, id: string): T {
  if (!el) {
    throw new Error(`Setty shell is missing #${id}`)
  }
  return el
}

const canvas = must(document.querySelector<HTMLCanvasElement>('#map'), 'map')
const view3d = must(document.querySelector<HTMLCanvasElement>('#view3d'), 'view3d')
const snapToggle = must(document.querySelector<HTMLInputElement>('#snap'), 'snap')
const status = must(document.querySelector<HTMLElement>('#status'), 'status')
const modePlace = must(document.querySelector<HTMLButtonElement>('#mode-place'), 'mode-place')
const modeSelect = must(document.querySelector<HTMLButtonElement>('#mode-select'), 'mode-select')
const inspectorPolygon = must(
  document.querySelector<HTMLElement>('#inspector-polygon'),
  'inspector-polygon',
)
const inspectorCamera = must(
  document.querySelector<HTMLElement>('#inspector-camera'),
  'inspector-camera',
)
const inspectorFloor = must(
  document.querySelector<HTMLElement>('#inspector-floor'),
  'inspector-floor',
)
const heightInput = must(document.querySelector<HTMLInputElement>('#height'), 'height')
const polyColorWell = must(
  document.querySelector<HTMLInputElement>('#poly-color-well'),
  'poly-color-well',
)
const polyColorHex = must(document.querySelector<HTMLInputElement>('#poly-color'), 'poly-color')
const yawInput = must(document.querySelector<HTMLInputElement>('#camera-yaw'), 'camera-yaw')
const cameraYInput = must(document.querySelector<HTMLInputElement>('#camera-y'), 'camera-y')
const floorColorWell = must(
  document.querySelector<HTMLInputElement>('#floor-color-well'),
  'floor-color-well',
)
const floorColorHex = must(document.querySelector<HTMLInputElement>('#floor-color'), 'floor-color')
const skyColorWell = must(
  document.querySelector<HTMLInputElement>('#sky-color-well'),
  'sky-color-well',
)
const skyColorHex = must(document.querySelector<HTMLInputElement>('#sky-color'), 'sky-color')
const helpPlace = must(document.querySelector<HTMLElement>('#help-place'), 'help-place')
const helpSelect = must(document.querySelector<HTMLElement>('#help-select'), 'help-select')
const exportStillBtn = must(
  document.querySelector<HTMLButtonElement>('#export-still'),
  'export-still',
)

const preview = new Viewport3D(view3d)
let lastDoc: SetDocument | null = null
let polyDocAtFocus: SetDocument | null = null
let cameraDocAtFocus: SetDocument | null = null
let floorDocAtFocus: SetDocument | null = null

const editor = new MapEditor(canvas, {
  onChange(state) {
    snapToggle.checked = state.snap
    status.textContent = statusText(state)
    syncMode(state)
    syncInspector(state)
    if (state.doc !== lastDoc) {
      lastDoc = state.doc
      preview.setDocument(state.doc)
    }
  },
  onExport: () => {
    void exportStill()
  },
})

exportStillBtn.addEventListener('click', () => {
  void exportStill()
})

async function exportStill(): Promise<void> {
  exportStillBtn.disabled = true
  try {
    const blob = await preview.captureStill()
    downloadBlob(blob, stillFilename())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not export a still'
    status.textContent = message
  } finally {
    exportStillBtn.disabled = false
    canvas.focus()
  }
}

snapToggle.addEventListener('change', () => {
  editor.setSnap(snapToggle.checked)
  canvas.focus()
})

modePlace.addEventListener('click', () => editor.setMode('place'))
modeSelect.addEventListener('click', () => editor.setMode('select'))

heightInput.addEventListener('focus', onPolyFieldFocus)
polyColorWell.addEventListener('focus', onPolyFieldFocus)
polyColorHex.addEventListener('focus', onPolyFieldFocus)
heightInput.addEventListener('input', () => {
  const parsed = parseNumberInput(heightInput.value)
  if (parsed === null) {
    return
  }
  editor.setSelectedHeight(parsed, false)
})
polyColorWell.addEventListener('input', () => {
  editor.setSelectedColor(polyColorWell.value, false)
})
polyColorHex.addEventListener('input', () => {
  const parsed = parseColor(polyColorHex.value)
  if (!parsed) {
    return
  }
  editor.setSelectedColor(parsed, false)
})
heightInput.addEventListener('change', () => commitPolygonFields())
polyColorWell.addEventListener('change', () => commitPolygonFields())
polyColorHex.addEventListener('change', () => commitPolygonFields())
heightInput.addEventListener('blur', (e) => {
  if (isPolyField(e.relatedTarget)) {
    return
  }
  commitPolygonFields()
})
polyColorWell.addEventListener('blur', (e) => {
  if (isPolyField(e.relatedTarget)) {
    return
  }
  commitPolygonFields()
})
polyColorHex.addEventListener('blur', (e) => {
  if (isPolyField(e.relatedTarget)) {
    return
  }
  commitPolygonFields()
})
heightInput.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    e.preventDefault()
    commitPolygonFields()
    heightInput.blur()
  }
})
polyColorHex.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    e.preventDefault()
    commitPolygonFields()
    polyColorHex.blur()
  }
})

yawInput.addEventListener('focus', onCameraFieldFocus)
cameraYInput.addEventListener('focus', onCameraFieldFocus)
yawInput.addEventListener('input', () => {
  const parsed = parseNumberInput(yawInput.value)
  if (parsed === null) {
    return
  }
  editor.setCameraYaw(parsed, false)
})
cameraYInput.addEventListener('input', () => {
  const parsed = parseNumberInput(cameraYInput.value)
  if (parsed === null) {
    return
  }
  editor.setCameraHeight(parsed, false)
})
yawInput.addEventListener('change', () => commitCameraFields())
cameraYInput.addEventListener('change', () => commitCameraFields())
yawInput.addEventListener('blur', (e) => {
  if (isCameraField(e.relatedTarget)) {
    return
  }
  commitCameraFields()
})
cameraYInput.addEventListener('blur', (e) => {
  if (isCameraField(e.relatedTarget)) {
    return
  }
  commitCameraFields()
})
yawInput.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    e.preventDefault()
    commitCameraFields()
    yawInput.blur()
  }
})
cameraYInput.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    e.preventDefault()
    commitCameraFields()
    cameraYInput.blur()
  }
})

floorColorWell.addEventListener('focus', onFloorFieldFocus)
floorColorHex.addEventListener('focus', onFloorFieldFocus)
skyColorWell.addEventListener('focus', onFloorFieldFocus)
skyColorHex.addEventListener('focus', onFloorFieldFocus)
floorColorWell.addEventListener('input', () => {
  editor.setFloorColor(floorColorWell.value, false)
})
floorColorHex.addEventListener('input', () => {
  const parsed = parseColor(floorColorHex.value)
  if (!parsed) {
    return
  }
  editor.setFloorColor(parsed, false)
})
skyColorWell.addEventListener('input', () => {
  editor.setSkyColor(skyColorWell.value, false)
})
skyColorHex.addEventListener('input', () => {
  const parsed = parseColor(skyColorHex.value)
  if (!parsed) {
    return
  }
  editor.setSkyColor(parsed, false)
})
floorColorWell.addEventListener('change', () => commitFloorFields())
floorColorHex.addEventListener('change', () => commitFloorFields())
skyColorWell.addEventListener('change', () => commitFloorFields())
skyColorHex.addEventListener('change', () => commitFloorFields())
floorColorWell.addEventListener('blur', (e) => {
  if (isFloorField(e.relatedTarget)) {
    return
  }
  commitFloorFields()
})
floorColorHex.addEventListener('blur', (e) => {
  if (isFloorField(e.relatedTarget)) {
    return
  }
  commitFloorFields()
})
skyColorWell.addEventListener('blur', (e) => {
  if (isFloorField(e.relatedTarget)) {
    return
  }
  commitFloorFields()
})
skyColorHex.addEventListener('blur', (e) => {
  if (isFloorField(e.relatedTarget)) {
    return
  }
  commitFloorFields()
})
floorColorHex.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    e.preventDefault()
    commitFloorFields()
    floorColorHex.blur()
  }
})
skyColorHex.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    e.preventDefault()
    commitFloorFields()
    skyColorHex.blur()
  }
})

function onPolyFieldFocus(): void {
  if (!polyDocAtFocus) {
    polyDocAtFocus = editor.getState().doc
  }
}

function onCameraFieldFocus(): void {
  if (!cameraDocAtFocus) {
    cameraDocAtFocus = editor.getState().doc
  }
}

function onFloorFieldFocus(): void {
  if (!floorDocAtFocus) {
    floorDocAtFocus = editor.getState().doc
  }
}

function isPolyField(el: EventTarget | null): boolean {
  return el === heightInput || el === polyColorWell || el === polyColorHex
}

function isCameraField(el: EventTarget | null): boolean {
  return el === yawInput || el === cameraYInput
}

function isFloorField(el: EventTarget | null): boolean {
  return (
    el === floorColorWell ||
    el === floorColorHex ||
    el === skyColorWell ||
    el === skyColorHex
  )
}

function commitPolygonFields(): void {
  const poly = selectedPolygon(editor.getState())
  if (!poly) {
    return
  }
  const heightParsed = parseNumberInput(heightInput.value)
  if (heightParsed === null) {
    heightInput.value = formatHeight(poly.height)
  } else {
    editor.setSelectedHeight(heightParsed, false)
  }
  const colorParsed = parseColor(polyColorHex.value) ?? parseColor(polyColorWell.value)
  if (!colorParsed) {
    const current = selectedPolygon(editor.getState())
    if (current) {
      polyColorHex.value = formatColor(current.color, current.color)
      polyColorWell.value = formatColor(current.color, current.color)
    }
  } else {
    editor.setSelectedColor(colorParsed, false)
  }
  const next = selectedPolygon(editor.getState())
  if (next) {
    heightInput.value = formatHeight(next.height)
    const hex = formatColor(next.color, next.color)
    polyColorHex.value = hex
    polyColorWell.value = hex
  }
  if (polyDocAtFocus) {
    editor.commitHistory(polyDocAtFocus)
    polyDocAtFocus = editor.getState().doc
  }
}

function commitCameraFields(): void {
  const state = editor.getState()
  if (!state.cameraSelected) {
    return
  }
  const yawParsed = parseNumberInput(yawInput.value)
  const yParsed = parseNumberInput(cameraYInput.value)
  if (yawParsed === null) {
    yawInput.value = formatYaw(state.doc.camera.yaw)
  } else {
    editor.setCameraYaw(yawParsed, false)
  }
  if (yParsed === null) {
    cameraYInput.value = formatCameraHeight(editor.getState().doc.camera.y)
  } else {
    editor.setCameraHeight(yParsed, false)
  }
  const cam = editor.getState().doc.camera
  yawInput.value = formatYaw(cam.yaw)
  cameraYInput.value = formatCameraHeight(cam.y)
  if (cameraDocAtFocus) {
    editor.commitHistory(cameraDocAtFocus)
    cameraDocAtFocus = editor.getState().doc
  }
}

function commitFloorFields(): void {
  const state = editor.getState()
  if (!state.floorSelected) {
    return
  }
  const floorParsed = parseColor(floorColorHex.value) ?? parseColor(floorColorWell.value)
  if (!floorParsed) {
    const hex = formatColor(state.doc.floorColor, state.doc.floorColor)
    floorColorHex.value = hex
    floorColorWell.value = hex
  } else {
    editor.setFloorColor(floorParsed, false)
  }
  const skyParsed = parseColor(skyColorHex.value) ?? parseColor(skyColorWell.value)
  if (!skyParsed) {
    const hex = formatColor(editor.getState().doc.skyColor, editor.getState().doc.skyColor)
    skyColorHex.value = hex
    skyColorWell.value = hex
  } else {
    editor.setSkyColor(skyParsed, false)
  }
  const doc = editor.getState().doc
  const floorHex = formatColor(doc.floorColor, doc.floorColor)
  floorColorHex.value = floorHex
  floorColorWell.value = floorHex
  const skyHex = formatColor(doc.skyColor, doc.skyColor)
  skyColorHex.value = skyHex
  skyColorWell.value = skyHex
  if (floorDocAtFocus) {
    editor.commitHistory(floorDocAtFocus)
    floorDocAtFocus = editor.getState().doc
  }
}

function parseNumberInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
    return null
  }
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function syncMode(state: MapState): void {
  modePlace.setAttribute('aria-pressed', state.mode === 'place' ? 'true' : 'false')
  modeSelect.setAttribute('aria-pressed', state.mode === 'select' ? 'true' : 'false')
  helpPlace.hidden = state.mode !== 'place'
  helpSelect.hidden = state.mode !== 'select'
}

function syncColorPair(
  hexInput: HTMLInputElement,
  wellInput: HTMLInputElement,
  color: string,
): void {
  const hex = formatColor(color, color)
  if (document.activeElement !== hexInput) {
    hexInput.value = hex
  }
  if (document.activeElement !== wellInput) {
    wellInput.value = hex
  }
}

function syncInspector(state: MapState): void {
  const poly = selectedPolygon(state)
  inspectorPolygon.hidden = !poly
  inspectorCamera.hidden = !state.cameraSelected
  inspectorFloor.hidden = !state.floorSelected
  if (poly) {
    if (document.activeElement !== heightInput) {
      heightInput.value = formatHeight(poly.height)
    }
    syncColorPair(polyColorHex, polyColorWell, poly.color)
  } else {
    polyDocAtFocus = null
  }
  if (state.cameraSelected) {
    const cam = state.doc.camera
    if (document.activeElement !== yawInput) {
      yawInput.value = formatYaw(cam.yaw)
    }
    if (document.activeElement !== cameraYInput) {
      cameraYInput.value = formatCameraHeight(cam.y)
    }
  } else {
    cameraDocAtFocus = null
  }
  if (state.floorSelected) {
    syncColorPair(floorColorHex, floorColorWell, state.doc.floorColor)
    syncColorPair(skyColorHex, skyColorWell, state.doc.skyColor)
  } else {
    floorDocAtFocus = null
  }
}

function statusText(state: MapState): string {
  const cursor = state.cursor
  const pos = cursor
    ? `x ${formatMeters(cursor.x)}  z ${formatMeters(cursor.z)}`
    : 'x —  z —'
  const snap = state.snap ? `snap ${state.doc.gridSize} m` : 'snap off'
  const tool = state.mode === 'select' ? 'select' : 'place'
  const draft =
    state.mode === 'place' && state.draft.length > 0
      ? `${state.draft.length} pt${state.draft.length === 1 ? '' : 's'}`
      : `${state.doc.polygons.length} poly`
  return `${pos}   ${snap}   ${tool}   ${draft}`
}

function formatMeters(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return rounded.toFixed(2)
}

declare global {
  interface Window {
    __setty: { editor: MapEditor; preview: Viewport3D }
  }
}

window.__setty = { editor, preview }
