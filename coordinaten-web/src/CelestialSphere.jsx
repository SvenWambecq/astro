import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  azimuthForOrigin,
  equatorialToHorizontal,
  equatorialVector,
  horizontalFromVector,
  horizontalVector,
  wrap360,
} from './coordinates.js'
import {
  COLORS,
  addDot,
  addLine,
  addTube,
  clearGroup,
  createLabel,
  createStage,
  sampleCurve,
  splitByVisibility,
} from './sceneUtils.js'

const toVector = ({ east, north, up }, radius = 1) => new THREE.Vector3(east * radius, north * radius, up * radius)
const isAboveHorizon = (point) => point.z >= -1e-9

const LABELS = {
  north: ['N', 'cardinal'],
  east: ['E', 'cardinal'],
  south: ['S', 'cardinal'],
  west: ['W', 'cardinal'],
  zenith: ['Zenith', 'muted'],
  ncp: ['NCP', 'local'],
  scp: ['SCP', 'local'],
  meridianPoint: ['M', 'local'],
  vernal: ['♈', 'global symbol'],
  star: ['', 'star'],
  altitude: ['h', 'horizon angle'],
  azimuth: ['A', 'horizon angle'],
  declination: ['δ', 'local angle'],
  hourAngle: ['H', 'local angle'],
  rightAscension: ['α', 'global angle'],
  sidereal: ['t', 'global angle'],
}

function addStyledCircle(parent, points, color, { dashedBelow = true, opacity = 1 } = {}) {
  const { above, below } = splitByVisibility(points, isAboveHorizon)
  const transparent = opacity < 1
  above.forEach((segment) => addLine(parent, segment, new THREE.LineBasicMaterial({ color, transparent, opacity })))
  below.forEach((segment) => addLine(parent, segment, dashedBelow
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.04, gapSize: 0.03, transparent: true, opacity: opacity * 0.75 })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity * 0.4 })))
}

export default function CelestialSphere({
  latitude,
  siderealTime,
  star,
  azimuthOrigin,
  visibleSystems,
  grid,
  onStarDrag,
}) {
  const mountRef = useRef(null)
  const stageRef = useRef(null)
  const dynamicRef = useRef(null)
  const labelsRef = useRef(null)
  const starHitRef = useRef(null)
  const dragRef = useRef(onStarDrag)

  useEffect(() => {
    dragRef.current = onStarDrag
  }, [onStarDrag])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40)
    camera.up.set(0, 0, 1)
    camera.position.set(2.45, -3.65, 2.05)
    const stage = createStage(mount, camera, { minDistance: 2.6, maxDistance: 7.5 })
    const { scene, controls, renderer } = stage
    stageRef.current = stage

    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 36, 18),
      new THREE.MeshBasicMaterial({ color: 0x8aa39d, wireframe: true, transparent: true, opacity: 0.08 }),
    ))
    scene.add(new THREE.Mesh(
      new THREE.CircleGeometry(0.998, 120),
      new THREE.MeshBasicMaterial({ color: 0xc9d8d4, side: THREE.DoubleSide, transparent: true, opacity: 0.28, depthWrite: false }),
    ))
    addLine(scene, sampleCurve((angle) => toVector(horizontalVector(angle, 0)), 0, 360, 144), new THREE.LineBasicMaterial({ color: 0x111111 }))
    addLine(scene, sampleCurve((angle) => new THREE.Vector3(0, Math.cos(angle), Math.sin(angle)), 0, Math.PI, 72), new THREE.LineBasicMaterial({ color: 0x9aa79f }))
    addDot(scene, new THREE.Vector3(0, 0, 0), COLORS.horizon, 0.035)
    addDot(scene, new THREE.Vector3(0, 0, 1), COLORS.ink, 0.026)

    const labels = Object.fromEntries(Object.entries(LABELS).map(([key, [text, className]]) => {
      const label = createLabel(text, className)
      scene.add(label)
      return [key, label]
    }))
    labels.north.position.set(0, 1.14, 0)
    labels.east.position.set(1.14, 0, 0)
    labels.south.position.set(0, -1.14, 0)
    labels.west.position.set(-1.14, 0, 0)
    labels.zenith.position.set(0, 0, 1.1)
    labelsRef.current = labels

    const dynamic = new THREE.Group()
    scene.add(dynamic)
    dynamicRef.current = dynamic

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const celestialSphere = new THREE.Sphere(new THREE.Vector3(), 1)
    let dragging = false

    const aim = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
    }
    const hitsStar = () => Boolean(starHitRef.current) && raycaster.intersectObject(starHitRef.current).length > 0
    const pointOnSphere = () => {
      const point = new THREE.Vector3()
      if (raycaster.ray.intersectSphere(celestialSphere, point)) return point
      raycaster.ray.closestPointToPoint(celestialSphere.center, point)
      return point.normalize()
    }

    const onPointerMove = (event) => {
      aim(event)
      if (dragging) {
        const point = pointOnSphere()
        const { azimuth, altitude } = horizontalFromVector({ east: point.x, north: point.y, up: point.z })
        dragRef.current?.(azimuth, altitude)
      } else if (event.pointerType === 'mouse') {
        mount.style.cursor = hitsStar() ? 'grab' : ''
      }
    }
    const onPointerUp = () => {
      if (!dragging) return
      dragging = false
      controls.enabled = true
      mount.style.cursor = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
    // Capture phase on the mount runs before OrbitControls sees the event on the canvas.
    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      aim(event)
      if (!hitsStar()) return
      event.stopPropagation()
      event.preventDefault()
      dragging = true
      controls.enabled = false
      mount.style.cursor = 'grabbing'
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    }
    mount.addEventListener('pointerdown', onPointerDown, true)
    mount.addEventListener('pointermove', onPointerMove)

    return () => {
      onPointerUp()
      mount.removeEventListener('pointerdown', onPointerDown, true)
      mount.removeEventListener('pointermove', onPointerMove)
      stage.dispose()
      stageRef.current = null
      dynamicRef.current = null
      labelsRef.current = null
      starHitRef.current = null
    }
  }, [])

  useEffect(() => {
    const group = dynamicRef.current
    const labels = labelsRef.current
    if (!group || !labels) return
    clearGroup(group)

    const t = siderealTime
    const alpha = wrap360(star.rightAscension)
    const declination = star.declination
    const hourAngle = wrap360(t - alpha)
    const equatorial = (h, d, radius = 1) => toVector(equatorialVector(h, d, latitude), radius)
    const horizontal = (a, h, radius = 1) => toVector(horizontalVector(a, h), radius)
    const { azimuth, altitude } = equatorialToHorizontal(hourAngle, declination, latitude)
    const starPosition = equatorial(hourAngle, declination)
    const pole = equatorial(0, 90)
    const show = visibleSystems

    if (grid === 'horizon') {
      const material = () => new THREE.LineBasicMaterial({ color: COLORS.horizon, transparent: true, opacity: 0.22 })
      for (let alt = -75; alt <= 75; alt += 15) {
        if (alt) addLine(group, sampleCurve((a) => horizontal(a, alt), 0, 360, 120), material())
      }
      for (let az = 0; az < 360; az += 30) addLine(group, sampleCurve((h) => horizontal(az, h), -90, 90, 60), material())
    } else if (grid === 'equatorial') {
      const material = () => new THREE.LineBasicMaterial({ color: COLORS.local, transparent: true, opacity: 0.22 })
      for (let dec = -75; dec <= 75; dec += 15) {
        if (dec) addLine(group, sampleCurve((h) => equatorial(h, dec), 0, 360, 120), material())
      }
      for (let h = 0; h < 360; h += 30) addLine(group, sampleCurve((d) => equatorial(h, d), -90, 90, 60), material())
    }

    addLine(group, [pole.clone().multiplyScalar(-1.22), pole.clone().multiplyScalar(1.22)], new THREE.LineBasicMaterial({ color: COLORS.local, transparent: true, opacity: 0.7 }))
    addDot(group, pole, COLORS.local, 0.03)
    addStyledCircle(group, sampleCurve((h) => equatorial(h, 0), 0, 360, 180), COLORS.local)
    addStyledCircle(group, sampleCurve((h) => equatorial(h, declination), 0, 360, 180), COLORS.star)

    const vernal = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), new THREE.MeshBasicMaterial({ color: COLORS.global }))
    vernal.position.copy(equatorial(t, 0))
    group.add(vernal)

    addDot(group, starPosition, COLORS.star, 0.055)
    const starHit = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ visible: false }))
    starHit.position.copy(starPosition)
    group.add(starHit)
    starHitRef.current = starHit

    if (show.horizon) {
      const originAzimuth = azimuthOrigin === 'south' ? 180 : 0
      const shownAzimuth = azimuthForOrigin(azimuth, azimuthOrigin)
      addLine(group, sampleCurve((h) => horizontal(azimuth, h), 90, Math.min(0, altitude), 48), new THREE.LineDashedMaterial({ color: COLORS.horizon, dashSize: 0.035, gapSize: 0.025 }))
      addTube(group, sampleCurve((h) => horizontal(azimuth, h), 0, altitude, 40), COLORS.horizon, 0.013)
      addTube(group, sampleCurve((a) => horizontal(originAzimuth + a, 0), 0, shownAzimuth, 120), COLORS.horizon, 0.013)
      addDot(group, horizontal(azimuth, 0), COLORS.horizon, 0.025)
      labels.altitude.position.copy(horizontal(azimuth, altitude / 2, 1.1))
      labels.azimuth.position.copy(horizontal(originAzimuth + shownAzimuth / 2, 0, 1.12))
    }

    if (show.local || show.global) {
      const color = show.local ? COLORS.local : COLORS.global
      addLine(group, sampleCurve((d) => equatorial(hourAngle, d), 90, Math.min(0, declination), 48), new THREE.LineDashedMaterial({ color, dashSize: 0.035, gapSize: 0.025 }))
      addTube(group, sampleCurve((d) => equatorial(hourAngle, d), 0, declination, 40), color, 0.013)
      addDot(group, equatorial(hourAngle, 0), color, 0.025)
      labels.declination.position.copy(equatorial(hourAngle, declination / 2, 1.1))
      labels.declination.element.dataset.system = show.local ? 'local' : 'global'
    }

    if (show.local) {
      addDot(group, equatorial(0, 0), COLORS.local, 0.03)
      addTube(group, sampleCurve((h) => equatorial(h, 0), 0, hourAngle, 120), COLORS.local, 0.013)
      labels.hourAngle.position.copy(equatorial(hourAngle / 2, 0, 0.88))
      labels.meridianPoint.position.copy(equatorial(0, 0, 0.9))
    }

    if (show.global) {
      const siderealRadius = 1.17
      const alphaRadius = 1.08
      addTube(group, sampleCurve((h) => equatorial(h, 0, siderealRadius), 0, t, 120), COLORS.global, 0.011)
      addTube(group, sampleCurve((s) => equatorial(t - s, 0, alphaRadius), 0, alpha, 120), COLORS.global, 0.011)
      const ticks = new THREE.LineBasicMaterial({ color: COLORS.global, transparent: true, opacity: 0.6 })
      addLine(group, [equatorial(0, 0, 1), equatorial(0, 0, siderealRadius + 0.04)], ticks)
      addLine(group, [equatorial(t, 0, 1), equatorial(t, 0, siderealRadius + 0.04)], ticks)
      addLine(group, [equatorial(hourAngle, 0, 1), equatorial(hourAngle, 0, alphaRadius + 0.04)], ticks)
      labels.rightAscension.position.copy(equatorial(t - alpha / 2, 0, alphaRadius + 0.07))
      labels.sidereal.position.copy(equatorial(t / 2, 0, siderealRadius + 0.08))
    }

    labels.ncp.position.copy(pole.clone().multiplyScalar(1.3))
    labels.scp.position.copy(pole.clone().multiplyScalar(-1.3))
    labels.vernal.position.copy(equatorial(t, 0, 1.1))
    labels.star.position.copy(starPosition.clone().multiplyScalar(1.13))
    labels.star.element.textContent = star.name

    labels.altitude.visible = show.horizon && Math.abs(altitude) > 4
    labels.azimuth.visible = show.horizon
    labels.declination.visible = (show.local || show.global) && Math.abs(declination) > 4
    labels.hourAngle.visible = show.local && hourAngle > 6
    labels.meridianPoint.visible = show.local
    labels.rightAscension.visible = show.global && alpha > 6
    labels.sidereal.visible = show.global && t > 6
  }, [latitude, siderealTime, star, azimuthOrigin, visibleSystems, grid])

  return (
    <div
      className="sky-stage"
      ref={mountRef}
      role="img"
      aria-label={`Interactive 3D celestial sphere around the observer showing ${star.name}, the horizon, celestial equator, poles and vernal equinox. Drag the star to move it; drag elsewhere to rotate the view.`}
    />
  )
}
