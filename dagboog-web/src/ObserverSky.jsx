import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { solarPosition } from './astro'

function solarTrack(latitudeDegrees, declinationRadians) {
  const count = 720
  const samples = Array.from({ length: count + 1 }, (_, index) => {
    const { east, north, up } = solarPosition(latitudeDegrees, declinationRadians, 24 * index / count)
    return { point: new THREE.Vector3(east, north, up), day: up >= 0 }
  })

  const segments = { day: [], night: [] }
  let activeKind = samples[0].day ? 'day' : 'night'
  let activeSegment = [samples[0].point]

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    const currentKind = current.day ? 'day' : 'night'

    if (currentKind !== activeKind) {
      const fraction = previous.point.z / (previous.point.z - current.point.z)
      const crossing = previous.point.clone().lerp(current.point, fraction)
      crossing.z = 0
      activeSegment.push(crossing)
      segments[activeKind].push(activeSegment)
      activeKind = currentKind
      activeSegment = [crossing, current.point]
    } else {
      activeSegment.push(current.point)
    }
  }

  segments[activeKind].push(activeSegment)
  return segments
}

function addLine(scene, points, material) {
  if (points.length < 2) return null
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const line = new THREE.Line(geometry, material)
  if (material instanceof THREE.LineDashedMaterial) line.computeLineDistances()
  scene.add(line)
  return line
}

function disposeObjectTree(root) {
  root.traverse((object) => {
    object.geometry?.dispose()
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
    else object.material?.dispose()
  })
}

export default function ObserverSky({ latitude, declination }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const dynamicGroupRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const scene = new THREE.Scene()
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30)
    camera.up.set(0, 0, 1)
    camera.position.set(2.7, -3.2, 2.3)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 2.4
    controls.maxDistance = 6.5

    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x789a97, wireframe: true, transparent: true, opacity: 0.3 }),
    )
    skyDome.rotation.x = Math.PI / 2
    scene.add(skyDome)

    const lowerSky = new THREE.Mesh(
      new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x789a97, wireframe: true, transparent: true, opacity: 0.07 }),
    )
    lowerSky.rotation.x = Math.PI / 2
    scene.add(lowerSky)

    const horizonPlane = new THREE.Mesh(
      new THREE.CircleGeometry(0.995, 120),
      new THREE.MeshBasicMaterial({ color: 0xc9d8d4, side: THREE.DoubleSide, transparent: true, opacity: 0.2 }),
    )
    scene.add(horizonPlane)
    const horizonPoints = Array.from({ length: 121 }, (_, index) => {
      const angle = (2 * Math.PI * index) / 120
      return new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0)
    })
    addLine(scene, horizonPoints, new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2 }))

    const northArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      0.78,
      0x347b8c,
      0.13,
      0.085,
    )
    scene.add(northArrow)

    const observer = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x2e8b57 }),
    )
    scene.add(observer)

    const zenith = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0x253d38 }),
    )
    zenith.position.set(0, 0, 1)
    scene.add(zenith)

    let animationFrame = 0
    const render = () => {
      controls.update()
      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(render)
    }
    render()

    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = mount
      if (!clientWidth || !clientHeight) return
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(clientWidth, clientHeight)
    })
    resizeObserver.observe(mount)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      controls.dispose()
      disposeObjectTree(scene)
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
      dynamicGroupRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (dynamicGroupRef.current) {
      scene.remove(dynamicGroupRef.current)
      disposeObjectTree(dynamicGroupRef.current)
    }

    const group = new THREE.Group()
    const latitudeRadians = THREE.MathUtils.degToRad(latitude)
    const celestialPole = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0x508c83 }),
    )
    celestialPole.position.set(0, Math.cos(latitudeRadians), Math.sin(latitudeRadians))
    group.add(celestialPole)

    const dailyTrack = solarTrack(latitude, declination)
    dailyTrack.day.forEach((segment) => {
      addLine(group, segment, new THREE.LineBasicMaterial({ color: 0xe3b522 }))
    })
    dailyTrack.night.forEach((segment) => {
      addLine(group, segment, new THREE.LineDashedMaterial({
        color: 0xe3b522,
        dashSize: 0.045,
        gapSize: 0.03,
      }))
    })

    const sunNoon = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe3b522 }),
    )
    const noonPosition = solarPosition(latitude, declination, 12)
    sunNoon.position.set(noonPosition.east, noonPosition.north, noonPosition.up)
    group.add(sunNoon)

    scene.add(group)
    dynamicGroupRef.current = group
  }, [latitude, declination])

  return <div className="observer-sky" ref={mountRef} role="img" aria-label="Interactive 3D local sky: observer at the horizon origin, north arrow, zenith, and solar daily circle" />
}