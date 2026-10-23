export const FULL_VIEW = { scale: 1, x: 0, y: 0 }
export const MAX_ZOOM = 6

function constrainView(view) {
  if (view.scale === 1) return FULL_VIEW
  const limit = 400 - 400 / view.scale
  return {
    scale: view.scale,
    x: Math.max(-limit, Math.min(limit, view.x)),
    y: Math.max(-limit, Math.min(limit, view.y)),
  }
}

export function zoomChart(view, scale, anchor = view) {
  const nextScale = Math.max(1, Math.min(MAX_ZOOM, scale))
  return constrainView({
    scale: nextScale,
    x: anchor.x - (anchor.x - view.x) * view.scale / nextScale,
    y: anchor.y - (anchor.y - view.y) * view.scale / nextScale,
  })
}

export function panChart(view, deltaX, deltaY) {
  return constrainView({ ...view, x: view.x + deltaX, y: view.y + deltaY })
}