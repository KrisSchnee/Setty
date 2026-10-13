import './style.css'
import { MapEditor } from './editor.ts'
import { runSelfTest } from './mapState.ts'
import type { MapState } from './mapState.ts'

runSelfTest()

const canvas = document.querySelector<HTMLCanvasElement>('#map')
const snapToggle = document.querySelector<HTMLInputElement>('#snap')
const status = document.querySelector<HTMLElement>('#status')
if (!canvas || !snapToggle || !status) {
  throw new Error('Setty shell is missing expected elements')
}

const editor = new MapEditor(canvas, {
  onChange(state) {
    snapToggle.checked = state.snap
    status.textContent = statusText(state)
  },
})

snapToggle.addEventListener('change', () => {
  editor.setSnap(snapToggle.checked)
  canvas.focus()
})

function statusText(state: MapState): string {
  const cursor = state.cursor
  const pos = cursor
    ? `x ${formatMeters(cursor.x)}  z ${formatMeters(cursor.z)}`
    : 'x —  z —'
  const snap = state.snap ? `snap ${state.doc.gridSize} m` : 'snap off'
  const draft =
    state.draft.length > 0
      ? `${state.draft.length} pt${state.draft.length === 1 ? '' : 's'}`
      : `${state.doc.polygons.length} poly`
  return `${pos}   ${snap}   ${draft}`
}

function formatMeters(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return rounded.toFixed(2)
}

declare global {
  interface Window {
    __setty: { editor: MapEditor }
  }
}

window.__setty = { editor }
