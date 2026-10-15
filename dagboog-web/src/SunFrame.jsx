import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { OBLIQUITY_DEG, RAD, solarLongitude } from './astro.js'

const ORBIT_RADIUS = 2.3
const EARTH_RADIUS = 0.42
const AXIS = new THREE.Vector3(0, -Math.sin(OBLIQUITY_DEG * RAD), Math.cos(OBLIQUITY_DEG * RAD))

function addLine(group, points, color) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color }),
  )
  group.add(line)
}

function addLabel(group, text, position, color = '#52645e') {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const context = canvas.getContext('2d')
  context.font = '600 24px Consolas, monospace'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = color
  context.fillText(text, 128, 32)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
  label.position.copy(position)
  label.scale.set(2, 0.5, 1)
  group.add(label)
}

function disposeTree(root) {
  root.traverse((object) => {
    object.geometry?.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      material?.map?.dispose()
      material?.dispose()
    })
  })
}

export default function SunFrame({ latitude, selectedDate }) {
  const mountRef = useRef(null)
  const earthRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
    camera.up.set(0, 0, 1)
    camera.position.set(6, -8, 7)
    camera.lookAt(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 7
    controls.maxDistance = 16
    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    scene.add(new THREE.PointLight(0xffffff, 28))

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xe3b522 }),
    )
    scene.add(sun)
    addLabel(scene, 'SUN', new THREE.Vector3(0, 0, 0.55), '#98731a')
    addLine(scene, Array.from({ length: 181 }, (_, index) => {
      const angle = index * Math.PI / 90
      return new THREE.Vector3(ORBIT_RADIUS * Math.cos(angle), ORBIT_RADIUS * Math.sin(angle), 0)
    }), 0xaab8b8)

    const seasonLabels = ['MAR EQUINOX', 'JUN SOLSTICE', 'SEP EQUINOX', 'DEC SOLSTICE']
    seasonLabels.forEach((label, index) => {
      const angle = index * Math.PI / 2
      const position = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0)
      addLine(scene, [position.clone().multiplyScalar(2.2), position.clone().multiplyScalar(2.45)], 0x708079)
      addLabel(scene, label, position.multiplyScalar(3.1))
    })

    const earth = new THREE.Group()
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 48, 32),
      new THREE.MeshStandardMaterial({ color: 0x5896aa, roughness: 0.85 }),
    )
    earth.add(globe)
    const equatorDirection = new THREE.Vector3(1, 0, 0)
    const equatorSide = new THREE.Vector3().crossVectors(AXIS, equatorDirection)
    addLine(earth, Array.from({ length: 121 }, (_, index) => {
      const angle = index * Math.PI / 60
      return equatorDirection.clone().multiplyScalar(Math.cos(angle))
        .addScaledVector(equatorSide, Math.sin(angle)).multiplyScalar(EARTH_RADIUS * 1.025)
    }), 0xf0f6f3)
    earth.add(new THREE.ArrowHelper(AXIS, AXIS.clone().multiplyScalar(-0.72), 1.44, 0x253d38, 0.12, 0.08))
    addLabel(earth, 'N', AXIS.clone().multiplyScalar(0.9))
    const observer = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.22, 0x2e8b57, 0.09, 0.07)
    earth.add(observer)
    scene.add(earth)
    earthRef.current = { earth, observer }

    const resize = () => {
      const { clientWidth, clientHeight } = mount
      if (!clientWidth || !clientHeight) return
      camera.aspect = clientWidth / clientHeight
      const distance = 4.3 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect))
      camera.position.sub(controls.target).normalize().multiplyScalar(distance).add(controls.target)
      controls.maxDistance = Math.max(16, distance * 1.3)
      camera.updateProjectionMatrix()
      renderer.setSize(clientWidth, clientHeight)
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    let animationFrame
    const render = () => {
      controls.update()
      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(render)
    }
    render()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      controls.dispose()
      disposeTree(scene)
      renderer.dispose()
      renderer.domElement.remove()
      earthRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!earthRef.current) return
    const { earth, observer } = earthRef.current
    const longitude = solarLongitude(selectedDate)
    earth.position.set(ORBIT_RADIUS * Math.cos(longitude), ORBIT_RADIUS * Math.sin(longitude), 0)
    const sunDirection = earth.position.clone().negate().normalize()
    const noonDirection = sunDirection.clone().addScaledVector(AXIS, -sunDirection.dot(AXIS)).normalize()
    const observerDirection = noonDirection.multiplyScalar(Math.cos(latitude * RAD))
      .addScaledVector(AXIS, Math.sin(latitude * RAD)).normalize()
    observer.position.copy(observerDirection.clone().multiplyScalar(EARTH_RADIUS * 1.03))
    observer.setDirection(observerDirection)
  }, [latitude, selectedDate])

  return <div className="sun-frame" ref={mountRef} role="img" aria-label={`Interactive Sun-centered orbit on ${selectedDate}: Earth with fixed ${OBLIQUITY_DEG.toFixed(2)} degree axial tilt, equator, and observer at latitude ${latitude} degrees at local solar noon. Sizes and distances not to scale.`} />
}