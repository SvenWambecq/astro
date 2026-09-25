"""Three.js notebook widget for Astropy Earth-Moon-Sun ephemerides."""

from collections.abc import Sequence

import anywidget
import traitlets

from earth_moon_model import Orbit3DSample, Position3D


class EarthMoonThreeJS(anywidget.AnyWidget):
    """Render timestamped ephemerides in an interactive Sun-centered scene."""

    _esm = r"""
import * as THREE from "https://esm.sh/three@0.180.0";
import { OrbitControls } from "https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js";

function render({ model, el }) {
  const root = document.createElement("div");
  root.className = "astro-three";
  root.innerHTML = `
    <div class="astro-three__viewport"></div>
    <div class="astro-three__readout">
      <strong></strong>
      <span class="astro-three__timestamp"></span>
    </div>
    <label class="astro-three__reference">
      <span>Fixed body</span>
      <select aria-label="Reference frame">
        <option value="sun">Sun</option>
        <option value="earth">Earth</option>
      </select>
    </label>
    <div class="astro-three__inclination">
      <select aria-label="Moon orbit data source">
        <option value="actual">JPL orbit</option>
        <option value="custom">Custom plane</option>
      </select>
      <input type="range" min="0" max="15" step="0.1" aria-label="Moon orbital inclination" disabled>
      <output></output>
    </div>
    <div class="astro-three__controls">
      <button class="astro-three__play" type="button" title="Play or pause" aria-label="Play">▶</button>
      <input class="astro-three__timeline" type="range" min="0" step="1" aria-label="Time">
      <select class="astro-three__speed" aria-label="Playback speed" title="Playback speed">
        <option value="12">0.5×</option>
        <option value="24" selected>1×</option>
        <option value="48">2×</option>
        <option value="96">4×</option>
      </select>
      <button class="astro-three__reset" type="button" title="Reset camera" aria-label="Reset camera">⌂</button>
    </div>`;
  el.replaceChildren(root);

  const viewport = root.querySelector(".astro-three__viewport");
  const systemTitle = root.querySelector(".astro-three__readout strong");
  const timestamp = root.querySelector(".astro-three__timestamp");
  const referenceFrameControl = root.querySelector(".astro-three__reference select");
  const inclinationMode = root.querySelector(".astro-three__inclination select");
  const inclination = root.querySelector(".astro-three__inclination input");
  const inclinationOutput = root.querySelector(".astro-three__inclination output");
  const playButton = root.querySelector(".astro-three__play");
  const timeline = root.querySelector(".astro-three__timeline");
  const speed = root.querySelector(".astro-three__speed");
  const resetButton = root.querySelector(".astro-three__reset");
  const frames = model.get("frames");
  const kilometersPerUnit = model.get("kilometers_per_unit");
  const sunCompression = model.get("sun_distance_compression");
  const verticalExaggeration = model.get("vertical_exaggeration");
  let moonInclinationDegrees = model.get("moon_inclination_degrees");
  let useActualMoonOrbit = model.get("use_actual_moon_orbit");
  let referenceFrame = model.get("reference_frame");

  if (!frames.length) {
    viewport.textContent = "No ephemeris frames supplied.";
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1f5f8);
  scene.fog = new THREE.FogExp2(0xf1f5f8, 0.004);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 2000);
  const initialCameraPosition = new THREE.Vector3(42, 30, 48);
  camera.position.copy(initialCameraPosition);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  viewport.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2;
  controls.maxDistance = 240;

  scene.add(new THREE.HemisphereLight(0x8ca9d8, 0x080b12, 0.7));
  const sunlight = new THREE.PointLight(0xfff2d0, 90, 0, 1.2);
  scene.add(sunlight);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(0.58, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x2474b5, roughness: 0.72, metalness: 0.03 })
  );
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.63, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x67c8ff, transparent: true, opacity: 0.12, side: THREE.BackSide })
  );
  scene.add(earth, atmosphere);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0xc8c5bc, roughness: 0.95 })
  );
  scene.add(moon);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 40, 28),
    new THREE.MeshBasicMaterial({ color: 0xffc44d })
  );
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 40, 28),
    new THREE.MeshBasicMaterial({ color: 0xff9d2e, transparent: true, opacity: 0.18, side: THREE.BackSide })
  );
  scene.add(sun, sunGlow);

  const grid = new THREE.GridHelper(80, 40, 0x7f9bb5, 0xc5d2dc);
  grid.material.transparent = true;
  grid.material.opacity = 0.38;
  scene.add(grid);

  const earthOrbitGeometry = new THREE.BufferGeometry();
  const earthOrbit = new THREE.Line(
    earthOrbitGeometry,
    new THREE.LineBasicMaterial({ color: 0x4f94cf, transparent: true, opacity: 0.8 })
  );
  scene.add(earthOrbit);

  const sunOrbitGeometry = new THREE.BufferGeometry();
  const sunOrbit = new THREE.Line(
    sunOrbitGeometry,
    new THREE.LineBasicMaterial({ color: 0xd69b36, transparent: true, opacity: 0.7 })
  );
  scene.add(sunOrbit);

  const moonOrbitGeometry = new THREE.BufferGeometry();
  const moonOrbit = new THREE.Line(
    moonOrbitGeometry,
    new THREE.LineBasicMaterial({ color: 0xc7c4ba, transparent: true, opacity: 0.65 })
  );
  scene.add(moonOrbit);

  const sunEarthLineGeometry = new THREE.BufferGeometry();
  const sunEarthLine = new THREE.Line(
    sunEarthLineGeometry,
    new THREE.LineBasicMaterial({ color: 0xc77918, transparent: true, opacity: 0.9 })
  );
  scene.add(sunEarthLine);

  const antiSolarLineGeometry = new THREE.BufferGeometry();
  const antiSolarLine = new THREE.Line(
    antiSolarLineGeometry,
    new THREE.LineDashedMaterial({ color: 0x8d5368, dashSize: 0.45, gapSize: 0.28, transparent: true, opacity: 0.8 })
  );
  scene.add(antiSolarLine);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let index = 0; index < 900; index += 1) {
    const radius = 90 + Math.random() * 90;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0x71879b, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.55 })
  );
  scene.add(stars);

  function sceneVector(position, compression = 1) {
    const scale = kilometersPerUnit * compression;
    return new THREE.Vector3(
      position[0] / scale,
      position[2] * verticalExaggeration / scale,
      -position[1] / scale
    );
  }

  function moonVectorAtInclination(position) {
    if (useActualMoonOrbit) {
      return position;
    }
    const radius = Math.hypot(position[0], position[1], position[2]);
    const longitude = Math.atan2(position[1], position[0]);
    const inclinationRadians = THREE.MathUtils.degToRad(moonInclinationDegrees);
    return [
      radius * Math.cos(longitude),
      radius * Math.sin(longitude) * Math.cos(inclinationRadians),
      radius * Math.sin(longitude) * Math.sin(inclinationRadians),
    ];
  }

  function scenePositions(frame) {
    const moonFromEarth = sceneVector(moonVectorAtInclination(frame.moon));
    const sunFromEarth = sceneVector(frame.sun, sunCompression);
    if (referenceFrame === "earth") {
      return {
        sunPosition: sunFromEarth,
        earthPosition: new THREE.Vector3(),
        moonPosition: moonFromEarth,
      };
    }
    const earthPosition = sunFromEarth.clone().multiplyScalar(-1);
    return {
      sunPosition: new THREE.Vector3(),
      earthPosition,
      moonPosition: earthPosition.clone().add(moonFromEarth),
    };
  }

  function showFrame(index) {
    const frame = frames[index];
    const { sunPosition, earthPosition, moonPosition } = scenePositions(frame);
    systemTitle.textContent = referenceFrame === "earth"
      ? "Geocentric Earth-Moon-Sun system"
      : "Heliocentric Earth-Moon system";
    sun.position.copy(sunPosition);
    sunGlow.position.copy(sunPosition);
    sunlight.position.copy(sunPosition);
    earth.position.copy(earthPosition);
    atmosphere.position.copy(earthPosition);
    moon.position.copy(moonPosition);
    sunEarthLineGeometry.setFromPoints([sunPosition, earthPosition]);
    const antiSolarDirection = earthPosition.clone().sub(sunPosition).normalize();
    const antiSolarEnd = earthPosition.clone().add(
      antiSolarDirection.multiplyScalar(10)
    );
    antiSolarLineGeometry.setFromPoints([earthPosition, antiSolarEnd]);
    antiSolarLine.computeLineDistances();
    timestamp.textContent = new Date(frame.timestamp).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC";

    const positions = frames.slice(0, index + 1).map(scenePositions);
    sunOrbitGeometry.setFromPoints(positions.map((item) => item.sunPosition));
    earthOrbitGeometry.setFromPoints(positions.map((item) => item.earthPosition));
    moonOrbitGeometry.setFromPoints(positions.map((item) => item.moonPosition));
    timeline.value = String(index);
  }

  let frameIndex = 0;
  let playing = false;
  let lastAdvance = 0;
  let animationId;

  referenceFrameControl.value = referenceFrame;
  referenceFrameControl.addEventListener("change", () => {
    referenceFrame = referenceFrameControl.value;
    showFrame(frameIndex);
  });
  inclinationMode.value = useActualMoonOrbit ? "actual" : "custom";
  inclination.disabled = useActualMoonOrbit;
  inclination.value = String(moonInclinationDegrees);
  inclinationOutput.value = useActualMoonOrbit ? "measured" : `${moonInclinationDegrees.toFixed(1)}°`;
  inclinationMode.addEventListener("change", () => {
    useActualMoonOrbit = inclinationMode.value === "actual";
    inclination.disabled = useActualMoonOrbit;
    inclinationOutput.value = useActualMoonOrbit ? "measured" : `${moonInclinationDegrees.toFixed(1)}°`;
    showFrame(frameIndex);
  });
  inclination.addEventListener("input", () => {
    moonInclinationDegrees = Number(inclination.value);
    inclinationOutput.value = `${moonInclinationDegrees.toFixed(1)}°`;
    showFrame(frameIndex);
  });
  timeline.max = String(frames.length - 1);
  timeline.addEventListener("input", () => {
    frameIndex = Number(timeline.value);
    showFrame(frameIndex);
  });
  playButton.addEventListener("click", () => {
    playing = !playing;
    playButton.textContent = playing ? "❚❚" : "▶";
    playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
  });
  resetButton.addEventListener("click", () => {
    camera.position.copy(initialCameraPosition);
    controls.target.set(0, 0, 0);
    controls.update();
  });

  function resize() {
    const width = Math.max(viewport.clientWidth, 1);
    const height = Math.max(viewport.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  resize();
  showFrame(frameIndex);

  function animate(time) {
    animationId = requestAnimationFrame(animate);
    if (playing && time - lastAdvance >= 1000 / Number(speed.value)) {
      frameIndex = (frameIndex + 1) % frames.length;
      showFrame(frameIndex);
      lastAdvance = time;
    }
    earth.rotation.y += 0.0015;
    controls.update();
    renderer.render(scene, camera);
  }
  animate(0);

  return () => {
    cancelAnimationFrame(animationId);
    resizeObserver.disconnect();
    controls.dispose();
    renderer.dispose();
    earthOrbitGeometry.dispose();
    sunOrbitGeometry.dispose();
    moonOrbitGeometry.dispose();
    sunEarthLineGeometry.dispose();
    antiSolarLineGeometry.dispose();
    starGeometry.dispose();
  };
}

export default { render };
"""

    _css = r"""
.astro-three {
  position: relative;
  width: 100%;
  height: min(680px, 72vh);
  min-height: 460px;
  overflow: hidden;
  border: 1px solid #b8c7d3;
  border-radius: 8px;
  background: #f1f5f8;
  color: #172b3d;
  font-family: "Segoe UI", sans-serif;
}

.astro-three__viewport,
.astro-three__viewport canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.astro-three__readout {
  position: absolute;
  top: 18px;
  left: 20px;
  display: grid;
  gap: 3px;
  pointer-events: none;
  text-shadow: 0 1px 4px rgba(255, 255, 255, 0.9);
}

.astro-three__readout strong {
  font: 600 18px/1.2 Georgia, serif;
}

.astro-three__timestamp {
  color: #49657c;
  font: 12px/1.4 Consolas, monospace;
}

.astro-three__reference {
  position: absolute;
  top: 68px;
  left: 20px;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border: 1px solid rgba(111, 139, 163, 0.38);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.86);
  color: #29475f;
  font-size: 12px;
  backdrop-filter: blur(8px);
}

.astro-three__reference select {
  height: 28px;
}

.astro-three__inclination {
  position: absolute;
  top: 18px;
  right: 20px;
  display: grid;
  grid-template-columns: auto 140px 64px;
  gap: 8px;
  align-items: center;
  padding: 7px 9px;
  border: 1px solid rgba(111, 139, 163, 0.38);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.86);
  color: #29475f;
  font-size: 12px;
  backdrop-filter: blur(8px);
}

.astro-three__inclination input {
  width: 140px;
  accent-color: #3e769f;
}

.astro-three__inclination select {
  height: 28px;
}

.astro-three__inclination output {
  font-family: Consolas, monospace;
  text-align: right;
}

.astro-three__controls {
  position: absolute;
  right: 14px;
  bottom: 14px;
  left: 14px;
  display: grid;
  grid-template-columns: 38px minmax(120px, 1fr) auto 38px;
  gap: 9px;
  align-items: center;
  padding: 9px;
  border: 1px solid rgba(111, 139, 163, 0.38);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(8px);
}

.astro-three button,
.astro-three select {
  height: 34px;
  border: 1px solid #9bafc0;
  border-radius: 5px;
  background: #ffffff;
  color: #183148;
  cursor: pointer;
}

.astro-three button:hover,
.astro-three select:hover {
  border-color: #3e769f;
}

.astro-three__timeline {
  width: 100%;
  accent-color: #e8b75d;
}

@media (max-width: 560px) {
  .astro-three {
    height: 540px;
    min-height: 420px;
  }

  .astro-three__controls {
    grid-template-columns: 38px minmax(80px, 1fr) 38px;
  }

  .astro-three__speed {
    display: none;
  }

  .astro-three__inclination {
    top: 110px;
    right: 12px;
    grid-template-columns: auto 90px 58px;
  }

  .astro-three__reference {
    left: 12px;
  }
}
"""

    frames = traitlets.List(traitlets.Dict(), default_value=[]).tag(sync=True)
    kilometers_per_unit = traitlets.Float(50_000.0).tag(sync=True)
    sun_distance_compression = traitlets.Float(100.0).tag(sync=True)
    vertical_exaggeration = traitlets.Float(1.0).tag(sync=True)
    moon_inclination_degrees = traitlets.Float(5.145, min=0.0, max=15.0).tag(sync=True)
    use_actual_moon_orbit = traitlets.Bool(True).tag(sync=True)
    reference_frame = traitlets.Enum(["sun", "earth"], default_value="sun").tag(sync=True)

    def __init__(
        self,
        moon_samples: Sequence[Orbit3DSample],
        sun_positions: Sequence[Position3D],
        **kwargs: object,
    ) -> None:
        if not moon_samples:
            raise ValueError("moon_samples must contain at least one ephemeris sample")
        if len(moon_samples) != len(sun_positions):
            raise ValueError("moon_samples and sun_positions must have equal lengths")

        frames = [
            {
                "timestamp": timestamp.isoformat(),
                "moon": list(moon_position),
                "sun": list(sun_position),
            }
            for (timestamp, moon_position), sun_position in zip(moon_samples, sun_positions)
        ]
        super().__init__(frames=frames, **kwargs)