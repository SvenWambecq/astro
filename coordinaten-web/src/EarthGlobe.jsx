import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { LocateFixed } from 'lucide-react'
import { RAD, substellarPoint, wrap360 } from './coordinates.js'
import {
  COLORS,
  addDot,
  addLine,
  addTube,
  clearGroup,
  createLabel,
  createStage,
  sampleCurve,
} from './sceneUtils.js'

function geo(latitude, longitude, radius = 1) {
  const phi = latitude * RAD
  const lambda = longitude * RAD
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.cos(lambda),
    radius * Math.cos(phi) * Math.sin(lambda),
    radius * Math.sin(phi),
  )
}

const CAMERA_DISTANCE = 4.6

function cameraPositionFor(longitude) {
  return geo(28, longitude + 28, CAMERA_DISTANCE)
}

const LABELS = {
  greenwich: ['Greenwich 0°', 'muted', true],
  equator: ['Equator', 'local', true],
  northPole: ['N', 'cardinal', false],
  observer: ['', 'horizon', false],
  substellar: ['', 'star small', true],
  starRay: ['', 'star', false],
  zenithDistance: ['90° − h', 'star angle', true],
  vernal: ['♈', 'global symbol', false],
  longitude: ['λ', 'horizon angle', false],
  gmst: ['GMST', 'global angle', false],
  sidereal: ['t', 'global angle', false],
}

export default function EarthGlobe({ latitude, longitude, timeMs, gmst, star, observerName }) {
  const mountRef = useRef(null)
  const stageRef = useRef(null)
  const cameraRef = useRef(null)
  const dynamicRef = useRef(null)
  const labelsRef = useRef(null)
  const initialLongitudeRef = useRef(longitude)
  const longitudeRef = useRef(longitude)

  useEffect(() => {
    longitudeRef.current = longitude
  }, [longitude])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40)
    camera.up.set(0, 0, 1)
    camera.position.copy(cameraPositionFor(initialLongitudeRef.current))
    cameraRef.current = camera

    const labels = {}
    const cameraDirection = new THREE.Vector3()
    // Fade labels sitting on the far side of the globe.
    const fadeHiddenLabels = () => {
      cameraDirection.copy(camera.position).normalize()
      for (const label of Object.values(labels)) {
        if (!label.userData.onSurface) continue
        const facing = label.position.clone().normalize().dot(cameraDirection)
        label.element.style.opacity = facing > 0.05 ? '1' : '0.12'
      }
    }

    const stage = createStage(mount, camera, { minDistance: 2.4, maxDistance: 8 }, fadeHiddenLabels)
    const { scene } = stage
    stageRef.current = stage

    scene.add(new THREE.AmbientLight(0xffffff, 1.9))
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.4)
    sunLight.position.set(1, -0.4, 1.2)
    camera.add(sunLight)
    scene.add(camera)

    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 40).rotateX(Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: COLORS.earth }),
    ))

    const gridMaterial = () => new THREE.LineBasicMaterial({ color: 0xf4f8f6, transparent: true, opacity: 0.55 })
    for (let lat = -75; lat <= 75; lat += 15) {
      if (lat) addLine(scene, sampleCurve((lon) => geo(lat, lon, 1.002), -180, 180, 120), gridMaterial())
    }
    for (let lon = -165; lon <= 180; lon += 15) {
      if (lon) addLine(scene, sampleCurve((lat) => geo(lat, lon, 1.002), -90, 90, 60), gridMaterial())
    }
    addTube(scene, sampleCurve((lon) => geo(0, lon, 1.003), -180, 180, 160), COLORS.local, 0.008)
    addTube(scene, sampleCurve((lat) => geo(lat, 0, 1.003), -90, 90, 80), COLORS.ink, 0.008)
    addLine(scene, [new THREE.Vector3(0, 0, -1.3), new THREE.Vector3(0, 0, 1.3)], new THREE.LineBasicMaterial({ color: 0x9aa79f }))

    for (const [key, [text, className, onSurface]] of Object.entries(LABELS)) {
      const label = createLabel(text, className)
      label.userData.onSurface = onSurface
      scene.add(label)
      labels[key] = label
    }
    labels.greenwich.position.copy(geo(38, 0, 1.06))
    labels.equator.position.copy(geo(0, -35, 1.06))
    labels.northPole.position.set(0, 0, 1.4)
    labelsRef.current = labels

    const dynamic = new THREE.Group()
    scene.add(dynamic)
    dynamicRef.current = dynamic

    return () => {
      stage.dispose()
      stageRef.current = null
      cameraRef.current = null
      dynamicRef.current = null
      labelsRef.current = null
    }
  }, [])

  useEffect(() => {
    const group = dynamicRef.current
    const labels = labelsRef.current
    if (!group || !labels) return
    clearGroup(group)

    const observer = geo(latitude, longitude)
    const sub = substellarPoint(timeMs, star)
    const subDirection = geo(sub.latitude, sub.longitude)
    const sidereal = wrap360(gmst + longitude)

    addLine(group, sampleCurve((lat) => geo(lat, longitude, 1.004), -90, 90, 80), new THREE.LineBasicMaterial({ color: COLORS.horizon }))
    addDot(group, observer, COLORS.horizon, 0.04)
    group.add(new THREE.ArrowHelper(observer, observer, 0.55, COLORS.ink, 0.09, 0.05))
    group.add(new THREE.ArrowHelper(subDirection, observer, 0.55, 0xc99a12, 0.09, 0.05))

    addDot(group, subDirection, COLORS.star, 0.035)
    addLine(group, [new THREE.Vector3(), subDirection.clone().multiplyScalar(1.95)], new THREE.LineDashedMaterial({ color: 0xc99a12, dashSize: 0.05, gapSize: 0.035 }))

    const separation = observer.angleTo(subDirection)
    if (separation > 0.01 && separation < Math.PI - 0.01) {
      const axis = observer.clone().cross(subDirection).normalize()
      const arc = sampleCurve((angle) => observer.clone().applyAxisAngle(axis, angle).multiplyScalar(1.008), 0, separation, 64)
      addTube(group, arc, COLORS.star, 0.009)
      labels.zenithDistance.position.copy(observer.clone().applyAxisAngle(axis, separation / 2).multiplyScalar(1.1))
      labels.zenithDistance.visible = separation > 0.15
    } else {
      labels.zenithDistance.visible = false
    }

    const vernalDirection = geo(0, -gmst)
    group.add(new THREE.ArrowHelper(vernalDirection, new THREE.Vector3(), 1.85, COLORS.global, 0.1, 0.055))

    const longitudeRadius = 1.07
    const gmstRadius = 1.3
    const siderealRadius = 1.44
    addTube(group, sampleCurve((lon) => geo(0, lon, longitudeRadius), 0, longitude, 90), COLORS.horizon, 0.01)
    addTube(group, sampleCurve((s) => geo(0, -s, gmstRadius), 0, gmst, 120), COLORS.global, 0.008)
    addTube(group, sampleCurve((s) => geo(0, longitude - s, siderealRadius), 0, sidereal, 120), COLORS.global, 0.012)
    const tick = new THREE.LineBasicMaterial({ color: COLORS.global, transparent: true, opacity: 0.55 })
    addLine(group, [geo(0, 0, 1), geo(0, 0, gmstRadius + 0.04)], tick)
    addLine(group, [geo(0, longitude, 1), geo(0, longitude, siderealRadius + 0.04)], tick)

    labels.observer.element.textContent = observerName
    labels.observer.position.copy(observer.clone().multiplyScalar(1.68))
    labels.substellar.element.textContent = `Under ${star.name}`
    labels.substellar.position.copy(subDirection.clone().multiplyScalar(1.07))
    labels.starRay.element.textContent = `→ ${star.name}`
    labels.starRay.position.copy(subDirection.clone().multiplyScalar(2.06))
    labels.vernal.position.copy(vernalDirection.clone().multiplyScalar(1.98))
    labels.longitude.position.copy(geo(0, longitude / 2, longitudeRadius + 0.08))
    labels.longitude.visible = Math.abs(longitude) > 6
    labels.gmst.position.copy(geo(0, -gmst / 2, gmstRadius + 0.08))
    labels.gmst.visible = gmst > 8
    labels.sidereal.position.copy(geo(0, longitude - sidereal / 2, siderealRadius + 0.08))
    labels.sidereal.visible = sidereal > 8
  }, [latitude, longitude, timeMs, gmst, star, observerName])

  function faceObserver() {
    const camera = cameraRef.current
    const stage = stageRef.current
    if (!camera || !stage) return
    camera.position.copy(cameraPositionFor(longitudeRef.current))
    stage.controls.target.set(0, 0, 0)
    stage.controls.update()
  }

  return (
    <div className="globe-wrap">
      <div
        className="globe-stage"
        ref={mountRef}
        role="img"
        aria-label={`Interactive 3D Earth showing the observer at ${observerName}, the Greenwich meridian, the direction of the vernal equinox and the point on Earth directly under ${star.name}.`}
      />
      <button className="overlay-button" type="button" onClick={faceObserver} title="Turn the globe to face the observer">
        <LocateFixed size={14} aria-hidden="true" />
        <span>Face observer</span>
      </button>
    </div>
  )
}
