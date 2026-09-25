"""Interactive Three.js widget for Jupiter and the Galilean moons."""

from collections.abc import Sequence

import anywidget
import traitlets

from jupiter_galilean.galilean_moons_model import GALILEAN_MOONS, MoonOrbit3DSample, MoonOrbitSample


class GalileanMoonsThreeJS(anywidget.AnyWidget):
    """Render timestamped Galilean-moon positions in an interactive Three.js scene."""

    _esm = r"""
import * as THREE from "https://esm.sh/three@0.180.0";
import { OrbitControls } from "https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js";

function render({ model, el }) {
  const root = document.createElement("div");
  root.className = "galilean-three";
  root.innerHTML = `
    <div class="galilean-three__viewport"></div>
    <div class="galilean-three__readout"><strong>Jupiter and the Galilean moons</strong><span></span></div>
    <div class="galilean-three__controls">
      <button type="button" title="Play or pause" aria-label="Play">▶</button>
      <input type="range" min="0" step="1" aria-label="Time">
      <select aria-label="Playback speed" title="Playback speed"><option value="12">0.5x</option><option value="24" selected>1x</option><option value="48">2x</option><option value="96">4x</option></select>
      <button type="button" title="Reset camera" aria-label="Reset camera">⌂</button>
    </div>`;
  el.replaceChildren(root);

  const frames = model.get("frames");
  if (!frames.length) {
    root.querySelector(".galilean-three__viewport").textContent = "No moon positions supplied.";
    return;
  }
  const viewport = root.querySelector(".galilean-three__viewport");
  const timestamp = root.querySelector(".galilean-three__readout span");
  const [playButton, timeline, speed, resetButton] = root.querySelectorAll(".galilean-three__controls button, .galilean-three__controls input, .galilean-three__controls select");
  const moonDefinitions = model.get("moons");
  const scale = model.get("kilometers_per_unit");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08111f);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const initialCameraPosition = new THREE.Vector3(0, 29, 37);
  camera.position.copy(initialCameraPosition);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 5;
  controls.maxDistance = 90;
  scene.add(new THREE.HemisphereLight(0x8299bd, 0x06090e, 1.5));
  const sunlight = new THREE.DirectionalLight(0xffefd1, 2.2);
  sunlight.position.set(-20, 14, 24);
  scene.add(sunlight);

  const stars = new THREE.BufferGeometry();
  const starPositions = [];
  for (let index = 0; index < 700; index += 1) {
    const radius = 55 + Math.random() * 70;
    const theta = Math.random() * Math.PI * 2;
    const height = (Math.random() - 0.5) * 80;
    starPositions.push(radius * Math.cos(theta), height, radius * Math.sin(theta));
  }
  stars.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xb9cee8, size: 0.13, transparent: true, opacity: 0.65 })));

  const jupiter = new THREE.Mesh(new THREE.SphereGeometry(1.15, 48, 32), new THREE.MeshStandardMaterial({ color: 0xd18c55, roughness: 0.74 }));
  scene.add(jupiter);
  const moonMeshes = new Map();
  const trailLines = new Map();
  const orbitLines = new Map();
  function toVector(position) {
    return new THREE.Vector3(position[0] / scale, position.length === 3 ? position[2] / scale : 0, -position[1] / scale);
  }
  for (const moon of moonDefinitions) {
    const material = new THREE.MeshStandardMaterial({ color: moon.color, roughness: 0.9 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 28, 20), material);
    mesh.userData.name = moon.name;
    scene.add(mesh);
    moonMeshes.set(moon.name, mesh);
    const orbitPoints = frames.map((frame) => toVector(frame.moons[moon.name]));
    const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints), new THREE.LineBasicMaterial({ color: moon.color, transparent: true, opacity: 0.33 }));
    scene.add(orbit);
    orbitLines.set(moon.name, orbit);
    const trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: moon.color, transparent: true, opacity: 0.95 }));
    scene.add(trail);
    trailLines.set(moon.name, trail);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const label = document.createElement("div");
  label.className = "galilean-three__label";
  root.appendChild(label);
  renderer.domElement.addEventListener("pointermove", (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...moonMeshes.values()])[0];
    label.textContent = hit ? hit.object.userData.name : "";
    label.style.left = `${event.clientX - bounds.left + 12}px`;
    label.style.top = `${event.clientY - bounds.top + 12}px`;
  });

  function showFrame(index) {
    const frame = frames[index];
    timestamp.textContent = new Date(frame.timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
    for (const moon of moonDefinitions) {
      moonMeshes.get(moon.name).position.copy(toVector(frame.moons[moon.name]));
      const path = frames.slice(0, index + 1).map((item) => toVector(item.moons[moon.name]));
      trailLines.get(moon.name).geometry.setFromPoints(path);
    }
    timeline.value = String(index);
  }

  let frameIndex = 0;
  let playing = false;
  let lastAdvance = 0;
  timeline.max = String(frames.length - 1);
  timeline.addEventListener("input", () => { frameIndex = Number(timeline.value); showFrame(frameIndex); });
  playButton.addEventListener("click", () => { playing = !playing; playButton.textContent = playing ? "❚❚" : "▶"; playButton.setAttribute("aria-label", playing ? "Pause" : "Play"); });
  resetButton.addEventListener("click", () => { camera.position.copy(initialCameraPosition); controls.target.set(0, 0, 0); controls.update(); });
  const resize = () => { const width = Math.max(viewport.clientWidth, 1); const height = Math.max(viewport.clientHeight, 1); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  resize();
  showFrame(0);
  let animationId;
  function animate(time) {
    animationId = requestAnimationFrame(animate);
    if (playing && time - lastAdvance >= 1000 / Number(speed.value)) { frameIndex = (frameIndex + 1) % frames.length; showFrame(frameIndex); lastAdvance = time; }
    jupiter.rotation.y += 0.002;
    controls.update();
    renderer.render(scene, camera);
  }
  animate(0);
  return () => { cancelAnimationFrame(animationId); resizeObserver.disconnect(); controls.dispose(); renderer.dispose(); stars.dispose(); };
}

export default { render };
"""

    _css = r"""
.galilean-three { position: relative; height: min(680px, 72vh); min-height: 460px; overflow: hidden; border: 1px solid #344b67; border-radius: 8px; background: #08111f; color: #edf5ff; font-family: "Segoe UI", sans-serif; }
.galilean-three__viewport, .galilean-three__viewport canvas { display: block; width: 100%; height: 100%; }
.galilean-three__readout { position: absolute; top: 18px; left: 20px; display: grid; gap: 3px; pointer-events: none; }
.galilean-three__readout strong { font: 600 18px/1.2 Georgia, serif; }
.galilean-three__readout span { color: #b9cee8; font: 12px/1.4 Consolas, monospace; }
.galilean-three__controls { position: absolute; right: 20px; bottom: 18px; display: grid; grid-template-columns: 38px minmax(150px, 320px) 58px 38px; gap: 8px; align-items: center; padding: 8px; border: 1px solid rgba(173, 201, 232, 0.28); border-radius: 6px; background: rgba(8, 17, 31, 0.84); }
.galilean-three button, .galilean-three select { height: 30px; border: 1px solid #567190; border-radius: 4px; background: #12253b; color: #edf5ff; cursor: pointer; }
.galilean-three__label { position: absolute; pointer-events: none; color: #fff1cc; font-size: 12px; text-shadow: 0 1px 2px #000; }
@media (max-width: 560px) { .galilean-three { height: 540px; min-height: 420px; } .galilean-three__readout { left: 12px; } .galilean-three__controls { right: 12px; left: 12px; grid-template-columns: 38px minmax(80px, 1fr) 58px 38px; } }
"""

    frames = traitlets.List(traitlets.Dict(), default_value=[]).tag(sync=True)
    moons = traitlets.List(traitlets.Dict(), default_value=[]).tag(sync=True)
    kilometers_per_unit = traitlets.Float(100_000.0).tag(sync=True)

    def __init__(
      self, samples: dict[str, Sequence[MoonOrbitSample | MoonOrbit3DSample]], **kwargs: object
    ) -> None:
        """Build an animation timeline from synchronized Galilean-moon samples."""
        expected_names = {moon.name for moon in GALILEAN_MOONS}
        if set(samples) != expected_names or any(not values for values in samples.values()):
            raise ValueError("samples must contain non-empty positions for Io, Europa, Ganymede, and Callisto")

        sample_count = len(samples[GALILEAN_MOONS[0].name])
        if any(len(values) != sample_count for values in samples.values()):
            raise ValueError("each moon must have the same number of samples")

        frames = []
        for index in range(sample_count):
            timestamp = samples[GALILEAN_MOONS[0].name][index][0]
            positions = {}
            for moon in GALILEAN_MOONS:
                moon_timestamp, position = samples[moon.name][index]
                if moon_timestamp != timestamp:
                    raise ValueError("all moon samples must share timestamps")
                positions[moon.name] = list(position)
            frames.append({"timestamp": timestamp.isoformat(), "moons": positions})

        moons = [{"name": moon.name, "color": moon.color} for moon in GALILEAN_MOONS]
        super().__init__(frames=frames, moons=moons, **kwargs)