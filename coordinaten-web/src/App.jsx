import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Pause,
  Play,
  RotateCcw,
  Telescope,
} from 'lucide-react'
import AltitudeChart from './AltitudeChart.jsx'
import CelestialSphere from './CelestialSphere.jsx'
import ConversionSteps from './ConversionSteps.jsx'
import EarthGlobe from './EarthGlobe.jsx'
import SystemCards from './SystemCards.jsx'
import { LOCATIONS, STARS } from './catalog.js'
import {
  diurnalGeometry,
  equatorialToHorizontal,
  formatAngle,
  greenwichSiderealTime,
  horizontalToEquatorial,
  hourAngleFromRightAscension,
  localSiderealTime,
  rightAscensionFromHourAngle,
  skyCondition,
  sunAltitude,
} from './coordinates.js'
import './App.css'

const DEFAULT_TIME = '2026-10-15T21:00'
const DEFAULT_LOCATION = LOCATIONS[0]
const DEFAULT_STAR = STARS[0]
const DEFAULT_SYSTEMS = { horizon: true, local: true, global: true }
const MINUTE_MS = 60000
const SPEEDS = [
  { value: 1, label: 'Real time' },
  { value: 60, label: '1 min / s' },
  { value: 600, label: '10 min / s' },
  { value: 3600, label: '1 h / s' },
]
const FRAMES = [
  { id: 'sky', label: 'Sky' },
  { id: 'systems', label: 'Systems' },
  { id: 'earth', label: 'Earth' },
  { id: 'steps', label: 'Steps' },
  { id: 'chart', label: 'Day' },
]
const SKY_CONDITIONS = {
  day: 'Daylight',
  civil: 'Civil twilight',
  nautical: 'Nautical twilight',
  astronomical: 'Astronomical twilight',
  night: 'Dark night',
}

const pad = (value) => String(value).padStart(2, '0')
const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
const dateFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

function toLocalInputValue(timeMs) {
  const date = new Date(timeMs)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatUniversalTime(timeMs) {
  const iso = new Date(timeMs).toISOString()
  return `${iso.slice(11, 19)}`
}

function utcOffsetLabel(timeMs) {
  const minutes = -new Date(timeMs).getTimezoneOffset()
  const sign = minutes < 0 ? '−' : '+'
  const absolute = Math.abs(minutes)
  return `UTC${sign}${Math.floor(absolute / 60)}${absolute % 60 ? `:${pad(absolute % 60)}` : ''}`
}

const formatClock = (timeMs) => timeFormatter.format(new Date(timeMs))

function formatGeoShort(degrees, positive, negative) {
  return `${Math.abs(degrees).toFixed(1)}° ${degrees < 0 ? negative : positive}`
}

function App() {
  const [observer, setObserver] = useState({ ...DEFAULT_LOCATION })
  const [star, setStar] = useState({ ...DEFAULT_STAR })
  const [timeMs, setTimeMs] = useState(() => new Date(DEFAULT_TIME).getTime())
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(600)
  const [mode, setMode] = useState('sexagesimal')
  const [azimuthOrigin, setAzimuthOrigin] = useState('north')
  const [visibleSystems, setVisibleSystems] = useState(DEFAULT_SYSTEMS)
  const [grid, setGrid] = useState('none')
  const [viewKey, setViewKey] = useState(0)
  const [frame, setFrame] = useState('sky')

  useEffect(() => {
    if (!playing) return undefined
    let animationFrame = 0
    let previous = performance.now()
    const tick = (now) => {
      const elapsed = Math.min(now - previous, 250)
      previous = now
      setTimeMs((current) => current + elapsed * speed)
      animationFrame = window.requestAnimationFrame(tick)
    }
    animationFrame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [playing, speed])

  const gmst = greenwichSiderealTime(timeMs)
  const siderealTime = localSiderealTime(timeMs, observer.longitude)
  const hourAngle = hourAngleFromRightAscension(siderealTime, star.rightAscension)
  const horizontal = equatorialToHorizontal(hourAngle, star.declination, observer.latitude)
  const geometry = diurnalGeometry(star.declination, observer.latitude)
  const sky = skyCondition(sunAltitude(timeMs, observer))
  const fmtHours = (value) => formatAngle(value, 'hours', mode)

  function updateObserver(patch) {
    setObserver((current) => ({ ...current, ...patch, id: 'custom', name: 'Custom location' }))
  }

  function selectLocation(id) {
    const location = LOCATIONS.find((item) => item.id === id)
    if (location) setObserver({ ...location })
  }

  function updateStar(patch) {
    setStar((current) => ({
      ...current,
      ...patch,
      id: 'custom',
      name: current.id === 'custom' ? current.name : 'Custom',
      constellation: current.id === 'custom' ? current.constellation : `Moved from ${current.name}`,
    }))
  }

  function selectStar(id) {
    const preset = STARS.find((item) => item.id === id)
    if (preset) setStar({ ...preset })
  }

  function setHorizontal(azimuth, altitude) {
    const equatorial = horizontalToEquatorial(azimuth, altitude, observer.latitude)
    updateStar({
      rightAscension: rightAscensionFromHourAngle(siderealTime, equatorial.hourAngle),
      declination: equatorial.declination,
    })
  }

  function setLatitudeValue(value) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) updateObserver({ latitude: Math.max(-90, Math.min(90, parsed)) })
  }

  function setLongitudeValue(value) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) updateObserver({ longitude: Math.max(-180, Math.min(180, parsed)) })
  }

  function shiftTime(minutes) {
    setTimeMs((current) => current + minutes * MINUTE_MS)
  }

  function resetAll() {
    setObserver({ ...DEFAULT_LOCATION })
    setStar({ ...DEFAULT_STAR })
    setTimeMs(new Date(DEFAULT_TIME).getTime())
    setPlaying(false)
    setVisibleSystems(DEFAULT_SYSTEMS)
    setGrid('none')
    setViewKey((key) => key + 1)
  }

  const starStatus = horizontal.altitude >= 0 ? 'Above horizon' : 'Below horizon'
  const diurnalLabel = geometry.kind === 'circumpolar' ? 'circumpolar' : geometry.kind === 'never' ? 'never rises here' : 'rises and sets'

  const timeStepButtons = (compact = false) => (
    <>
      {!compact && (
        <button className="step-button" type="button" onClick={() => shiftTime(-60)} title="One hour earlier" aria-label="One hour earlier"><ChevronsLeft size={16} /></button>
      )}
      <button className="step-button" type="button" onClick={() => shiftTime(-10)} title="Ten minutes earlier" aria-label="Ten minutes earlier"><ChevronLeft size={16} /></button>
      <button className="step-button play-button" type="button" onClick={() => setPlaying((value) => !value)} aria-pressed={playing} title={playing ? 'Pause' : 'Play'} aria-label={playing ? 'Pause time' : 'Play time'}>
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button className="step-button" type="button" onClick={() => shiftTime(10)} title="Ten minutes later" aria-label="Ten minutes later"><ChevronRight size={16} /></button>
      {!compact && (
        <button className="step-button" type="button" onClick={() => shiftTime(60)} title="One hour later" aria-label="One hour later"><ChevronsRight size={16} /></button>
      )}
    </>
  )

  return (
    <main className="app-shell">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Coordinate explorer home">
          <span className="wordmark-mark"><Telescope size={18} strokeWidth={1.8} /></span>
          <span>COÖRDINATEN <span className="wordmark-divider">/</span> FIELD MODEL</span>
        </a>
        <div className="masthead-meta">
          <span className="live-indicator" data-playing={playing} />
          <span>SPHERICAL ASTRONOMY</span>
          <span className="masthead-index">01—05</span>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">GEOGRAPHIC / HORIZON / EQUATORIAL</p>
          <h1>One star, four coordinate systems</h1>
          <p className="intro-copy">Follow a catalogue position (α, δ) through sidereal time t to the hour angle H and finally to where you point the telescope (A, h).</p>
        </div>
        <button className="reset-button" type="button" onClick={resetAll} title="Reset observer, time, object and view" aria-label="Reset observer, time, object and view">
          <RotateCcw size={15} strokeWidth={1.8} />
          <span>Reset</span>
        </button>
      </section>

      <section className="control-deck" aria-label="Observer, time and object controls">
        <div className="control-group">
          <div className="control-heading">
            <label htmlFor="location-select">OBSERVER <span>φ λ</span></label>
            <select id="location-select" className="select-field" value={observer.id} onChange={(event) => selectLocation(event.target.value)}>
              {LOCATIONS.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              {observer.id === 'custom' && <option value="custom">Custom location</option>}
            </select>
          </div>
          <div className="slider-row">
            <label htmlFor="latitude-slider">φ</label>
            <input id="latitude-slider" className="range-input" type="range" min="-90" max="90" step="0.1" value={observer.latitude} onChange={(event) => setLatitudeValue(event.target.value)} aria-label="Observer latitude, degrees" />
            <span className="control-readout">{formatGeoShort(observer.latitude, 'N', 'S')}</span>
          </div>
          <div className="slider-row">
            <label htmlFor="longitude-slider">λ</label>
            <input id="longitude-slider" className="range-input longitude-range" type="range" min="-180" max="180" step="0.1" value={observer.longitude} onChange={(event) => setLongitudeValue(event.target.value)} aria-label="Observer longitude, degrees east" />
            <span className="control-readout">{formatGeoShort(observer.longitude, 'E', 'W')}</span>
          </div>
        </div>

        <div className="control-separator" aria-hidden="true" />

        <div className="control-group">
          <div className="control-heading">
            <label htmlFor="time-input">TIME <span>t</span></label>
            <span className="control-hint">{utcOffsetLabel(timeMs)} · your device’s time zone</span>
          </div>
          <div className="control-row">
            <label className="date-field" htmlFor="time-input">
              <Clock size={14} aria-hidden="true" />
              <span className="visually-hidden">Local date and time</span>
              <input
                id="time-input"
                type="datetime-local"
                value={toLocalInputValue(timeMs)}
                onChange={(event) => {
                  const parsed = new Date(event.target.value).getTime()
                  if (Number.isFinite(parsed)) setTimeMs(parsed)
                }}
              />
            </label>
            <button className="text-button" type="button" onClick={() => setTimeMs(Date.now())} title="Jump to the current time">Now</button>
          </div>
          <div className="control-row">
            {timeStepButtons()}
            <label className="visually-hidden" htmlFor="speed-select">Playback speed</label>
            <select id="speed-select" className="select-field" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              {SPEEDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>

        <div className="control-separator object-separator" aria-hidden="true" />

        <div className="control-group object-group">
          <div className="control-heading">
            <label htmlFor="star-select">OBJECT <span>α δ</span></label>
            <span className="control-hint">J2000 catalogue</span>
          </div>
          <select id="star-select" className="select-field wide" value={star.id} onChange={(event) => selectStar(event.target.value)}>
            {STARS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            {star.id === 'custom' && <option value="custom">Custom</option>}
          </select>
          <p className="object-note">{star.constellation}</p>
          <div className="control-row display-row">
            <span className="control-hint">Angles</span>
            <div className="segmented" role="group" aria-label="Angle notation">
              <button type="button" aria-pressed={mode === 'sexagesimal'} onClick={() => setMode('sexagesimal')}>° ′ ″ / h m s</button>
              <button type="button" aria-pressed={mode === 'decimal'} onClick={() => setMode('decimal')}>Decimal</button>
            </div>
          </div>
        </div>
      </section>

      <section className="readout-strip" aria-label="Current time and sidereal time">
        <div className="readout-cell"><span className="readout-label">LOCAL</span><strong>{dateFormatter.format(new Date(timeMs))} {formatClock(timeMs)}</strong></div>
        <div className="readout-cell"><span className="readout-label">UT</span><strong>{formatUniversalTime(timeMs)}</strong></div>
        <div className="readout-cell"><span className="readout-label">GMST</span><strong>{fmtHours(gmst)}</strong></div>
        <div className="readout-cell accent"><span className="readout-label">SIDEREAL TIME t</span><strong>{fmtHours(siderealTime)}</strong></div>
        <div className="readout-chips">
          <span className="condition-chip" data-state={horizontal.altitude >= 0 ? 'up' : 'down'}><span className="condition-dot" />{star.name}: {starStatus} · {diurnalLabel}</span>
          <span className="condition-chip" data-sky={sky}><span className="condition-dot" />{SKY_CONDITIONS[sky]}</span>
        </div>
      </section>

      <nav className="mobile-frame-selector" aria-label="Select view">
        {FRAMES.map((item) => (
          <button key={item.id} type="button" aria-pressed={frame === item.id} aria-controls={`${item.id}-panel`} onClick={() => setFrame(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      <section className="workspace" aria-label="Linked coordinate views">
        <article id="sky-panel" className="view-panel sky-panel" data-active={frame === 'sky'}>
          <header className="panel-header">
            <div className="panel-title-wrap"><span className="panel-number">01</span><h2>Observer’s celestial sphere</h2></div>
            <span className="panel-tag">DRAG THE STAR</span>
          </header>
          <div className="panel-toolbar">
            <span className="control-hint">Grid</span>
            <div className="segmented small" role="group" aria-label="Coordinate grid">
              {[['none', 'None'], ['horizon', 'Horizon'], ['equatorial', 'Equatorial']].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={grid === value} onClick={() => setGrid(value)}>{label}</button>
              ))}
            </div>
          </div>
          <CelestialSphere
            key={`sky-${viewKey}`}
            latitude={observer.latitude}
            siderealTime={siderealTime}
            star={star}
            azimuthOrigin={azimuthOrigin}
            visibleSystems={visibleSystems}
            grid={grid}
            onStarDrag={setHorizontal}
          />
          <footer className="panel-footer system-toggles">
            {[
              ['horizon', 'Horizon', 'A, h'],
              ['local', 'Local equatorial', 'H, δ'],
              ['global', 'Equatorial', 't, α'],
            ].map(([key, label, symbols]) => (
              <button
                key={key}
                type="button"
                className="system-toggle"
                data-system={key}
                aria-pressed={visibleSystems[key]}
                onClick={() => setVisibleSystems((current) => ({ ...current, [key]: !current[key] }))}
              >
                <i aria-hidden="true" />{label} <b>{symbols}</b>
              </button>
            ))}
            <span className="legend-item"><i className="legend-line star-legend" />Daily circle</span>
            <span className="legend-item"><i className="legend-line dashed-legend" />Below horizon</span>
          </footer>
        </article>

        <article id="systems-panel" className="view-panel systems-panel" data-active={frame === 'systems'}>
          <header className="panel-header">
            <div className="panel-title-wrap"><span className="panel-number">02</span><h2>Coordinate systems</h2></div>
            <span className="panel-tag">EDIT ANY VALUE</span>
          </header>
          <p className="panel-subtitle">Type decimal or sexagesimal values, e.g. <code>18h36m56s</code>, <code>51°09′ NB</code>, <code>-16 42 58</code>. Use ↑/↓ to nudge.</p>
          <SystemCards
            observer={observer}
            star={star}
            hourAngle={hourAngle}
            horizontal={horizontal}
            mode={mode}
            azimuthOrigin={azimuthOrigin}
            onAzimuthOriginChange={setAzimuthOrigin}
            onObserverChange={updateObserver}
            onHorizontalChange={setHorizontal}
            onHourAngleChange={(value) => updateStar({ rightAscension: rightAscensionFromHourAngle(siderealTime, value) })}
            onDeclinationChange={(declination) => updateStar({ declination })}
            onRightAscensionChange={(rightAscension) => updateStar({ rightAscension })}
          />
        </article>

        <article id="earth-panel" className="view-panel earth-panel" data-active={frame === 'earth'}>
          <header className="panel-header">
            <div className="panel-title-wrap"><span className="panel-number">03</span><h2>Earth and sky</h2></div>
            <span className="panel-tag">t = GMST + λ</span>
          </header>
          <p className="panel-subtitle">♈ turns with the sky. The star stands in the zenith above the point (δ, α − GMST).</p>
          <EarthGlobe
            key={`earth-${viewKey}`}
            latitude={observer.latitude}
            longitude={observer.longitude}
            timeMs={timeMs}
            gmst={gmst}
            star={star}
            observerName={observer.name}
          />
          <footer className="panel-footer">
            <span className="legend-item"><i className="legend-line horizon-legend" />Observer meridian · λ</span>
            <span className="legend-item"><i className="legend-line global-legend" />♈ · GMST · t</span>
            <span className="legend-item"><i className="legend-line star-legend" />Starlight · 90° − h</span>
          </footer>
        </article>

        <article id="steps-panel" className="view-panel steps-panel" data-active={frame === 'steps'}>
          <header className="panel-header">
            <div className="panel-title-wrap"><span className="panel-number">04</span><h2>Step by step</h2></div>
            <span className="panel-tag">α δ → A h</span>
          </header>
          <ConversionSteps
            observer={observer}
            star={star}
            gmst={gmst}
            siderealTime={siderealTime}
            hourAngle={hourAngle}
            horizontal={horizontal}
            azimuthOrigin={azimuthOrigin}
            mode={mode}
            geometry={geometry}
          />
        </article>

        <section id="chart-panel" className="view-panel chart-panel" data-active={frame === 'chart'}>
          <header className="panel-header">
            <div className="panel-title-wrap"><span className="panel-number">05</span><h2>Altitude through the day</h2></div>
            <span className="chart-meta">
              <span className="legend-item"><i className="sky-swatch day" />Day</span>
              <span className="legend-item"><i className="sky-swatch civil" />Twilight</span>
              <span className="legend-item"><i className="sky-swatch night" />Night</span>
            </span>
          </header>
          <AltitudeChart timeMs={timeMs} star={star} observer={observer} formatTime={formatClock} onSeek={setTimeMs} />
        </section>
      </section>

      <section className="mobile-timebar" aria-label="Time controls">
        <span className="mobile-time"><strong>{formatClock(timeMs)}</strong> t = {fmtHours(siderealTime)}</span>
        <div className="control-row">{timeStepButtons(true)}</div>
      </section>

      <footer className="page-footer">
        <span>MEAN SIDEREAL TIME · J2000 POSITIONS, PRECESSION IGNORED</span>
        <span>IDEAL HORIZON · REFRACTION OMITTED · APPROXIMATE SUN FOR TWILIGHT</span>
        <span>φ = {formatAngle(observer.latitude, 'degrees', 'decimal')} <b>·</b> H = {fmtHours(hourAngle)}</span>
      </footer>
    </main>
  )
}

export default App
