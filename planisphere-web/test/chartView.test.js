import test from 'node:test'
import assert from 'node:assert/strict'
import { FULL_VIEW, MAX_ZOOM, panChart, zoomChart } from '../src/chartView.js'

test('Zoom magnifies the view around the chosen map point', () => {
  const anchor = { x: 160, y: -100 }
  const next = zoomChart(FULL_VIEW, 2, anchor)
  assert.deepEqual(next, { scale: 2, x: 80, y: -50 })
  assert.equal((anchor.x - next.x) * next.scale, anchor.x)
  assert.equal((anchor.y - next.y) * next.scale, anchor.y)
})

test('Zoom limits and resetting restore the complete chart', () => {
  const enlarged = zoomChart(FULL_VIEW, 100, { x: 200, y: 100 })
  assert.equal(enlarged.scale, MAX_ZOOM)
  assert.deepEqual(zoomChart(enlarged, 0), FULL_VIEW)
})

test('Panning is bounded and cannot lose the map', () => {
  assert.deepEqual(panChart(FULL_VIEW, 100, -200), FULL_VIEW)
  assert.deepEqual(panChart({ scale: 2, x: 0, y: 0 }, 1000, -1000), { scale: 2, x: 200, y: -200 })
})

test('Button zoom keeps the current view center until the disk edge', () => {
  const view = { scale: 2, x: 80, y: -50 }
  assert.deepEqual(zoomChart(view, 3), { ...view, scale: 3 })
  assert.deepEqual(zoomChart(view, 1), FULL_VIEW)
})