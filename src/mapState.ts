import { samePoint, snapPoint, type Point } from './coords.ts'
import { addPolygon, createDocument, type SetDocument } from './document.ts'

export type MapState = {
  doc: SetDocument
  draft: Point[]
  snap: boolean
  cursor: Point | null
  history: SetDocument[]
}

export function createMapState(): MapState {
  return {
    doc: createDocument(),
    draft: [],
    snap: true,
    cursor: null,
    history: [],
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
  return {
    ...state,
    doc: previous,
    history: state.history.slice(0, -1),
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
}
