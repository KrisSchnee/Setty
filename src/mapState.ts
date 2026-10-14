import { pointInPolygon, samePoint, snapPoint, type Point } from './coords.ts'
import {
  addPolygon,
  createDocument,
  polygonById,
  setCameraHeight,
  setCameraPosition,
  setCameraYaw,
  setFloorColor,
  setPolygonColor,
  setSkyColor,
  setPolygonHeight,
  type Polygon,
  type SetDocument,
} from './document.ts'

export type EditorMode = 'place' | 'select'

export type MapState = {
  doc: SetDocument
  draft: Point[]
  snap: boolean
  cursor: Point | null
  history: SetDocument[]
  mode: EditorMode
  selectedId: string | null
  cameraSelected: boolean
  floorSelected: boolean
}

export function createMapState(): MapState {
  return {
    doc: createDocument(),
    draft: [],
    snap: true,
    cursor: null,
    history: [],
    mode: 'place',
    selectedId: null,
    cameraSelected: false,
    floorSelected: false,
  }
}

export function selectedPolygon(state: MapState): Polygon | null {
  if (!state.selectedId) {
    return null
  }
  return polygonById(state.doc, state.selectedId) ?? null
}

export function setMode(state: MapState, mode: EditorMode): MapState {
  if (state.mode === mode) {
    return state
  }
  const next = { ...state, mode }
  if (mode === 'select') {
    next.draft = []
  }
  return next
}

export function pickPolygonAt(doc: SetDocument, p: Point): string | null {
  for (let i = doc.polygons.length - 1; i >= 0; i--) {
    const poly = doc.polygons[i]!
    if (pointInPolygon(p, poly.points)) {
      return poly.id
    }
  }
  return null
}

export function selectAt(state: MapState, p: Point): MapState {
  const id = pickPolygonAt(state.doc, p)
  if (id) {
    if (state.selectedId === id && !state.cameraSelected && !state.floorSelected) {
      return state
    }
    return {
      ...state,
      selectedId: id,
      cameraSelected: false,
      floorSelected: false,
    }
  }
  return selectFloor(state)
}

export function selectCamera(state: MapState): MapState {
  if (state.cameraSelected && !state.selectedId && !state.floorSelected) {
    return state
  }
  return {
    ...state,
    cameraSelected: true,
    selectedId: null,
    floorSelected: false,
  }
}

export function selectFloor(state: MapState): MapState {
  if (state.floorSelected && !state.selectedId && !state.cameraSelected) {
    return state
  }
  return {
    ...state,
    floorSelected: true,
    selectedId: null,
    cameraSelected: false,
  }
}

export function clearSelection(state: MapState): MapState {
  if (!state.selectedId && !state.cameraSelected && !state.floorSelected) {
    return state
  }
  return {
    ...state,
    selectedId: null,
    cameraSelected: false,
    floorSelected: false,
  }
}

export function moveCamera(state: MapState, x: number, z: number): MapState {
  const doc = setCameraPosition(state.doc, x, z)
  if (doc === state.doc) {
    return state
  }
  return { ...state, doc }
}

export function applySelectedHeight(
  state: MapState,
  height: number,
  recordHistory = true,
): MapState {
  if (!state.selectedId) {
    return state
  }
  const nextDoc = setPolygonHeight(state.doc, state.selectedId, height)
  if (nextDoc === state.doc) {
    return state
  }
  return {
    ...state,
    doc: nextDoc,
    history: recordHistory ? [...state.history, state.doc] : state.history,
  }
}

export function applySelectedColor(
  state: MapState,
  color: string,
  recordHistory = true,
): MapState {
  if (!state.selectedId) {
    return state
  }
  const nextDoc = setPolygonColor(state.doc, state.selectedId, color)
  if (nextDoc === state.doc) {
    return state
  }
  return {
    ...state,
    doc: nextDoc,
    history: recordHistory ? [...state.history, state.doc] : state.history,
  }
}

export function applyFloorColor(
  state: MapState,
  color: string,
  recordHistory = true,
): MapState {
  if (!state.floorSelected) {
    return state
  }
  const nextDoc = setFloorColor(state.doc, color)
  if (nextDoc === state.doc) {
    return state
  }
  return {
    ...state,
    doc: nextDoc,
    history: recordHistory ? [...state.history, state.doc] : state.history,
  }
}

export function applySkyColor(
  state: MapState,
  color: string,
  recordHistory = true,
): MapState {
  if (!state.floorSelected) {
    return state
  }
  const nextDoc = setSkyColor(state.doc, color)
  if (nextDoc === state.doc) {
    return state
  }
  return {
    ...state,
    doc: nextDoc,
    history: recordHistory ? [...state.history, state.doc] : state.history,
  }
}

export function applyCameraYaw(
  state: MapState,
  yaw: number,
  recordHistory = true,
): MapState {
  if (!state.cameraSelected) {
    return state
  }
  const nextDoc = setCameraYaw(state.doc, yaw)
  if (nextDoc === state.doc) {
    return state
  }
  return {
    ...state,
    doc: nextDoc,
    history: recordHistory ? [...state.history, state.doc] : state.history,
  }
}

export function applyCameraHeight(
  state: MapState,
  y: number,
  recordHistory = true,
): MapState {
  if (!state.cameraSelected) {
    return state
  }
  const nextDoc = setCameraHeight(state.doc, y)
  if (nextDoc === state.doc) {
    return state
  }
  return {
    ...state,
    doc: nextDoc,
    history: recordHistory ? [...state.history, state.doc] : state.history,
  }
}

export function cursorPoint(state: MapState, raw: Point): Point {
  return state.snap ? snapPoint(raw, state.doc.gridSize) : raw
}

export function setCursor(state: MapState, raw: Point | null): MapState {
  return { ...state, cursor: raw ? cursorPoint(state, raw) : null }
}

export function setSnap(state: MapState, snap: boolean): MapState {
  const next = { ...state, snap }
  if (next.cursor) {
    next.cursor = cursorPoint(next, next.cursor)
  }
  return next
}

export function addDraftPoint(state: MapState, raw: Point): MapState {
  const point = cursorPoint(state, raw)
  const last = state.draft[state.draft.length - 1]
  if (last && samePoint(last, point)) {
    return { ...state, cursor: point }
  }
  return {
    ...state,
    draft: [...state.draft, point],
    cursor: point,
  }
}

/** Click to place a vertex. Clicking the first vertex again closes (same as Enter) once 2+ points exist. */
export function placeDraftPoint(
  state: MapState,
  raw: Point,
  onFirstVertex = false,
): MapState {
  const point = cursorPoint(state, raw)
  const first = state.draft[0]
  const onFirst = Boolean(first) && (onFirstVertex || samePoint(first, point))
  if (onFirst) {
    if (state.draft.length >= 2) {
      return closeDraft(state)
    }
    return { ...state, cursor: point }
  }
  return addDraftPoint(state, raw)
}

export function popDraftPoint(state: MapState): MapState {
  if (state.draft.length === 0) {
    return state
  }
  return { ...state, draft: state.draft.slice(0, -1) }
}

export function cancelDraft(state: MapState): MapState {
  if (state.draft.length === 0) {
    return state
  }
  return { ...state, draft: [] }
}

export function closeDraft(state: MapState): MapState {
  if (state.draft.length < 3) {
    return state
  }
  return {
    ...state,
    doc: addPolygon(state.doc, state.draft),
    draft: [],
    history: [...state.history, state.doc],
  }
}

export function undo(state: MapState): MapState {
  if (state.draft.length > 0) {
    return popDraftPoint(state)
  }
  const previous = state.history[state.history.length - 1]
  if (!previous) {
    return state
  }
  const selectedId =
    state.selectedId && polygonById(previous, state.selectedId)
      ? state.selectedId
      : null
  // Polygon edits keep the live camera (XZ drag is not in history).
  // Camera-only history entries share the polygons array, so restore yaw/height.
  const camera =
    previous.polygons === state.doc.polygons ? previous.camera : state.doc.camera
  return {
    ...state,
    doc: { ...previous, camera },
    history: state.history.slice(0, -1),
    selectedId,
  }
}

export function runSelfTest(): void {
  let s = createMapState()
  if (!s.snap) throw new Error('snap defaults on')

  s = addDraftPoint(s, { x: 0.4, z: 0.6 })
  if (!samePoint(s.draft[0]!, { x: 0, z: 1 })) {
    throw new Error(`snap failed: ${JSON.stringify(s.draft[0])}`)
  }

  s = addDraftPoint(s, { x: 4.2, z: 0.1 })
  s = addDraftPoint(s, { x: 4.2, z: 4.2 })
  s = addDraftPoint(s, { x: 4.2, z: 4.2 })
  if (s.draft.length !== 3) throw new Error('duplicate point should be ignored')

  s = closeDraft(s)
  if (s.draft.length !== 0) throw new Error('draft should clear on close')
  if (s.doc.polygons.length !== 1) throw new Error('expected one polygon')
  if (s.doc.polygons[0]!.points.length !== 3) throw new Error('expected 3 verts')

  const tooSmall = closeDraft(
    addDraftPoint(addDraftPoint(createMapState(), { x: 0, z: 0 }), { x: 1, z: 0 }),
  )
  if (tooSmall.doc.polygons.length !== 0) {
    throw new Error('two points must not close')
  }

  s = undo(s)
  if (s.doc.polygons.length !== 0) throw new Error('undo should drop polygon')

  let loop = placeDraftPoint(createMapState(), { x: 0, z: 0 })
  loop = placeDraftPoint(loop, { x: 0, z: 0 })
  if (loop.draft.length !== 1) throw new Error('second click on the only point should do nothing')

  loop = placeDraftPoint(loop, { x: 3, z: 0 })
  loop = placeDraftPoint(loop, { x: 0, z: 0 })
  if (loop.draft.length !== 2) throw new Error('clicking first of two points should not close')
  if (loop.doc.polygons.length !== 0) throw new Error('two points must not become a polygon')

  loop = placeDraftPoint(loop, { x: 0, z: 3 })
  loop = placeDraftPoint(loop, { x: 0, z: 0 })
  if (loop.draft.length !== 0) throw new Error('clicking first of 3+ points should close')
  if (loop.doc.polygons.length !== 1) throw new Error('expected closed polygon from first-point click')

  let hit = placeDraftPoint(createMapState(), { x: 0, z: 0 })
  hit = placeDraftPoint(hit, { x: 2, z: 0 })
  hit = placeDraftPoint(hit, { x: 2, z: 2 })
  hit = placeDraftPoint(hit, { x: 9, z: 9 }, true)
  if (hit.draft.length !== 0 || hit.doc.polygons.length !== 1) {
    throw new Error('screen hit on first vertex should close like Enter')
  }

  let sel = closeDraft(
    placeDraftPoint(
      placeDraftPoint(placeDraftPoint(createMapState(), { x: 0, z: 0 }), { x: 4, z: 0 }),
      { x: 4, z: 4 },
    ),
  )
  sel = setMode(sel, 'select')
  if (sel.mode !== 'select') throw new Error('expected select mode')
  sel = selectAt(sel, { x: 1, z: 1 })
  if (!sel.selectedId) throw new Error('expected a hit inside the polygon')
  sel = applySelectedHeight(sel, 3.16)
  if (selectedPolygon(sel)?.height !== 3.2) {
    throw new Error(`height should quantize to 3.2, got ${selectedPolygon(sel)?.height}`)
  }
  sel = applySelectedHeight(sel, -4)
  if (selectedPolygon(sel)?.height !== 0) throw new Error('height 0 is the floor')
  sel = applySelectedHeight(sel, 1000)
  if (selectedPolygon(sel)?.height !== 100) throw new Error('height caps at 100')
  sel = undo(sel)
  if (selectedPolygon(sel)?.height !== 0) throw new Error('undo should restore height')
  sel = selectAt(sel, { x: 50, z: 50 })
  if (sel.selectedId || sel.cameraSelected || !sel.floorSelected) {
    throw new Error('clicking empty space should select the floor')
  }

  let placing = addDraftPoint(createMapState(), { x: 0, z: 0 })
  placing = setMode(placing, 'select')
  if (placing.draft.length !== 0) throw new Error('switching to select should cancel the draft')

  let cam = moveCamera(createMapState(), 2, -3)
  if (cam.doc.camera.x !== 2 || cam.doc.camera.z !== -3) {
    throw new Error('camera should move on XZ')
  }
  if (cam.doc.camera.y !== 1.5 || cam.doc.camera.yaw !== 0) {
    throw new Error('camera height and yaw stay at the default')
  }

  cam = selectCamera(setMode(createMapState(), 'select'))
  if (!cam.cameraSelected || cam.selectedId) {
    throw new Error('selecting the camera should clear a polygon selection')
  }
  cam = applyCameraYaw(cam, 90)
  if (cam.doc.camera.yaw !== 90) throw new Error('yaw 90 should stick')
  cam = applyCameraYaw(cam, 360)
  if (cam.doc.camera.yaw !== 0) throw new Error('yaw 360 wraps to 0')
  cam = applyCameraYaw(cam, -1)
  if (cam.doc.camera.yaw !== 359) throw new Error('yaw -1 wraps to 359')
  cam = applyCameraYaw(cam, 359.6)
  if (cam.doc.camera.yaw !== 0) throw new Error('yaw 359.6 rounds then wraps to 0')
  cam = undo(cam)
  if (cam.doc.camera.yaw !== 359) throw new Error('undo should restore yaw')

  let eye = selectCamera(setMode(createMapState(), 'select'))
  eye = applyCameraHeight(eye, 0)
  if (eye.doc.camera.y !== 0.1) throw new Error('camera height floors at 0.1')
  eye = applyCameraHeight(eye, 2.36)
  if (eye.doc.camera.y !== 2.4) throw new Error('camera height should quantize to 2.4')
  eye = applyCameraHeight(eye, 1000)
  if (eye.doc.camera.y !== 100) throw new Error('camera height caps at 100')
  eye = undo(eye)
  if (eye.doc.camera.y !== 2.4) throw new Error('undo should restore camera height')

  let both = closeDraft(
    placeDraftPoint(
      placeDraftPoint(placeDraftPoint(createMapState(), { x: 0, z: 0 }), { x: 4, z: 0 }),
      { x: 4, z: 4 },
    ),
  )
  both = selectAt(setMode(both, 'select'), { x: 1, z: 1 })
  if (!both.selectedId) throw new Error('expected polygon selected')
  both = selectCamera(both)
  if (both.selectedId || !both.cameraSelected) {
    throw new Error('camera and polygon selection are mutually exclusive')
  }
  both = applyCameraYaw(both, 45)
  if (both.doc.camera.yaw !== 45) throw new Error('expected yaw 45')
  both = selectAt(both, { x: 50, z: 50 })
  if (both.cameraSelected || both.selectedId || !both.floorSelected) {
    throw new Error('empty click should select the floor')
  }
  both = selectCamera(both)
  both = applyCameraYaw(both, 45)
  both = undo(both)
  if (both.doc.polygons.length !== 1) {
    throw new Error('undo of camera yaw should keep the polygon')
  }
  if (both.doc.camera.yaw !== 0) throw new Error('undo of camera yaw should restore 0')

  let painted = closeDraft(
    placeDraftPoint(
      placeDraftPoint(placeDraftPoint(createMapState(), { x: 0, z: 0 }), { x: 4, z: 0 }),
      { x: 4, z: 4 },
    ),
  )
  if (painted.doc.polygons[0]!.color !== '#808080') {
    throw new Error('new polygons default to #808080')
  }
  if (painted.doc.floorColor !== '#202020') {
    throw new Error('floor defaults to #202020')
  }
  if (painted.doc.skyColor !== '#00bfff') {
    throw new Error('sky defaults to #00bfff')
  }
  painted = selectAt(setMode(painted, 'select'), { x: 1, z: 1 })
  painted = applySelectedColor(painted, '#F00')
  if (selectedPolygon(painted)?.color !== '#ff0000') {
    throw new Error('polygon color should expand #F00 to #ff0000')
  }
  painted = applySelectedColor(painted, 'not-a-color')
  if (selectedPolygon(painted)?.color !== '#ff0000') {
    throw new Error('invalid color should be ignored')
  }
  painted = undo(painted)
  if (selectedPolygon(painted)?.color !== '#808080') {
    throw new Error('undo should restore polygon color')
  }
  painted = selectFloor(painted)
  if (painted.selectedId || !painted.floorSelected) {
    throw new Error('floor selection should clear the polygon')
  }
  painted = applyFloorColor(painted, '336699')
  if (painted.doc.floorColor !== '#336699') {
    throw new Error('floor color should accept hex without hash')
  }
  painted = undo(painted)
  if (painted.doc.floorColor !== '#202020') {
    throw new Error('undo should restore floor color')
  }
  if (painted.doc.polygons.length !== 1) {
    throw new Error('undo of floor color should keep the polygon')
  }
  painted = applySkyColor(painted, '00BFFF')
  if (painted.doc.skyColor !== '#00bfff') {
    throw new Error('sky #00BFFF should match the default')
  }
  painted = applySkyColor(painted, '#112233')
  if (painted.doc.skyColor !== '#112233') {
    throw new Error('sky color should update')
  }
  painted = undo(painted)
  if (painted.doc.skyColor !== '#00bfff') {
    throw new Error('undo should restore sky color')
  }
}
