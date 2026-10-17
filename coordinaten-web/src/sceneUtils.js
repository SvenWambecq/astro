import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

export const COLORS = {
  ink: 0x1b302d,
  horizon: 0x2e8b57,
  local: 0x2f7891,
  global: 0x7a5cc0,
  star: 0xe3b522,
  grid: 0x8aa39d,
  earth: 0x8fbccb,
}

export function sampleCurve(pointAt, start, end, segments = 64) {
  return Array.from({ length: segments + 1 }, (_, index) => pointAt(start + (end - start) * index / segments))
}

export function addLine(parent, points, material) {
  if (points.length < 2) return null
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const line = new THREE.Line(geometry, material)
  if (material instanceof THREE.LineDashedMaterial) line.computeLineDistances()
  parent.add(line)
  return line
}

export function addTube(parent, points, color, radius = 0.011) {
  if (points.length < 2) return null
  const length = points.reduce((total, point, index) => (index ? total + point.distanceTo(points[index - 1]) : 0), 0)
  if (length < 0.01) return null
  const curve = new THREE.CatmullRomCurve3(points)
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(8, points.length), radius, 6, false),
    new THREE.MeshBasicMaterial({ color }),
  )
  parent.add(mesh)
  return mesh
}

export function addDot(parent, position, color, radius = 0.04) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), new THREE.MeshBasicMaterial({ color }))
  mesh.position.copy(position)
  parent.add(mesh)
  return mesh
}

/** Splits a closed or open polyline where `isAbove(point)` changes, so each part can be styled. */
export function splitByVisibility(points, isAbove) {
  const segments = { above: [], below: [] }
  if (!points.length) return segments
  let kind = isAbove(points[0]) ? 'above' : 'below'
  let current = [points[0]]
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    const nextKind = isAbove(point) ? 'above' : 'below'
    if (nextKind !== kind) {
      segments[kind].push([...current, point])
      kind = nextKind
      current = [points[index - 1], point]
    } else {
      current.push(point)
    }
  }
  segments[kind].push(current)
  return segments
}

export function createLabel(text, className) {
  const element = document.createElement('span')
  element.className = `scene-label ${className ?? ''}`.trim()
  element.textContent = text
  return new CSS2DObject(element)
}

export function disposeObjectTree(root) {
  root.traverse((object) => {
    object.geometry?.dispose()
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
    else object.material?.dispose()
    if (object.isCSS2DObject) object.element.remove()
  })
}

export function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child)
    disposeObjectTree(child)
  }
}

/** WebGL scene with an HTML label layer and orbit controls that follow the mount size. */
export function createStage(mount, camera, controlOptions = {}, onFrame = null) {
  const scene = new THREE.Scene()
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)
  mount.appendChild(renderer.domElement)

  const labelRenderer = new CSS2DRenderer()
  labelRenderer.domElement.className = 'label-layer'
  mount.appendChild(labelRenderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false }, controlOptions)

  const resize = () => {
    const { clientWidth, clientHeight } = mount
    if (!clientWidth || !clientHeight) return
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(clientWidth, clientHeight)
    labelRenderer.setSize(clientWidth, clientHeight)
  }
  resize()
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(mount)

  let animationFrame = 0
  const loop = () => {
    controls.update()
    onFrame?.()
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
    animationFrame = window.requestAnimationFrame(loop)
  }
  loop()

  return {
    scene,
    renderer,
    controls,
    dispose() {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      controls.dispose()
      disposeObjectTree(scene)
      renderer.dispose()
      renderer.domElement.remove()
      labelRenderer.domElement.remove()
    },
  }
}
