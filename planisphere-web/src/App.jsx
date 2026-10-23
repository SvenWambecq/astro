import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Compass, Crosshair, Download, LocateFixed, MapPin, Minus, Moon, Pause, Play, Plus, Search, Settings2, Stars, Sun, X } from 'lucide-react'
import { Rotation_EQJ_EQD } from 'astronomy-engine'
import { altitude, dateFields, dateFromFields, ofDate, separation, sidereal, skyCondition } from './astro.js'
import { loadCatalog, LOCATIONS, TARGETS } from './catalog.js'
import Planisphere from './Planisphere.jsx'

const initialOptions = { magnitude: 5, labels: true, lines: true, grid: false, altitude: false, mask: true, targets: true }
const coordinate = (value, positive, negative) => `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`
const offsetLabel = (offset) => `UTC${offset >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offset))).padStart(2, '0')}:${String(Math.round((Math.abs(offset) % 1) * 60)).padStart(2, '0')}`

function IconButton({ label, children, ...props }) {
  return <button className="icon-button" title={label} aria-label={label} {...props}>{children}</button>
}

export default function App() {
  const [location, setLocation] = useState(LOCATIONS[0])
  const [date, setDate] = useState(() => new Date())
  const [offset, setOffset] = useState(0)
  const [options, setOptions] = useState(initialOptions)
  const [catalog, setCatalog] = useState(null)
  const [catalogError, setCatalogError] = useState('')
  const [reload, setReload] = useState(0)
  const [locationOpen, setLocationOpen] = useState(true)
  const [locationError, setLocationError] = useState('')
  const [locating, setLocating] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('targets')
  const [selectedId, setSelectedId] = useState('m31')
  const [guideId, setGuideId] = useState('')
  const [playing, setPlaying] = useState(false)
  const [night, setNight] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [declination, setDeclination] = useState('')
  const locationDialog = useRef(null)
  const chartRef = useRef(null)
  const fields = dateFields(date, offset)
  const lst = sidereal(date, location.longitude)

  useEffect(() => {
    const controller = new AbortController()
    loadCatalog(controller.signal).then(setCatalog).catch((error) => { if (error.name !== 'AbortError') setCatalogError(error.message) })
    return () => controller.abort()
  }, [reload])

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => setDate((previous) => new Date(previous.getTime() + 60000)), 250)
    return () => clearInterval(timer)
  }, [playing])

  useEffect(() => {
    if (locationOpen) locationDialog.current?.showModal()
    else locationDialog.current?.close()
  }, [locationOpen])

  const rotation = Rotation_EQJ_EQD(date)
  const stars = (catalog?.stars || []).map((star) => ({ ...star, ...ofDate(star.ra, star.dec, date, rotation) }))
  const targets = TARGETS.map((target) => ({ ...target, ...ofDate(target.ra, target.dec, date, rotation) }))
  const objects = [...targets, ...stars]
  const selected = objects.find((object) => object.id === selectedId)
  const selectedHeight = selected ? altitude(selected.ra, selected.dec, location.latitude, lst) : 0
  const visibleStars = stars.filter((star) => star.mag <= options.magnitude && altitude(star.ra, star.dec, location.latitude, lst) > 0)
  const condition = skyCondition(date, location.latitude, location.longitude)
  const guideCandidates = selected ? stars.filter((star) => star.name && star.mag < 3 && star.id !== selected.id).map((star) => ({ ...star, distance: separation(star, selected), height: altitude(star.ra, star.dec, location.latitude, lst) })).filter((star) => star.height > 0).sort((first, second) => first.distance - second.distance).slice(0, 3) : []
  const guide = guideCandidates.find((star) => star.id === guideId) || guideCandidates[0]
  const pool = query ? objects.filter((object) => object.name) : tab === 'targets' ? targets : stars.filter((star) => star.name && star.mag <= 2.5)
  const results = pool.filter((object) => `${object.name} ${object.designation} ${object.constellation || ''}`.toLowerCase().includes(query.toLowerCase()) && (declination === '' || Math.abs(object.dec - Number(declination)) <= 10)).map((object) => ({ ...object, height: altitude(object.ra, object.dec, location.latitude, lst) })).sort((first, second) => Number(second.height > 0) - Number(first.height > 0) || first.mag - second.mag).slice(0, 60)

  function shift(minutes) { setPlaying(false); setDate((previous) => new Date(previous.getTime() + minutes * 60000)) }
  function changeDate(day, clock) {
    if (!day || !clock || Number(day.slice(0, 4)) < 1900 || Number(day.slice(0, 4)) > 2100) return
    const next = dateFromFields(day, clock, offset)
    if (Number.isFinite(next.getTime())) { setDate(next); setPlaying(false) }
  }
  function chooseLocation(index) { setLocation(LOCATIONS[Number(index)]); setLocationError('') }
  function locate() {
    if (!navigator.geolocation) { setLocationError('Geolocation is unavailable. Enter your coordinates instead.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation({ name: 'My location', latitude: position.coords.latitude, longitude: position.coords.longitude })
      setLocating(false)
      setLocationError('')
    }, (error) => { setLocating(false); setLocationError(error.code === 1 ? 'Location permission denied. Enter your coordinates instead.' : 'Could not determine location. Enter your coordinates instead.') }, { timeout: 10000 })
  }
  function exportChart() {
    const svg = chartRef.current.querySelector('svg.planisphere').cloneNode(true)
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules].map((rule) => rule.cssText) } catch { return [] } }).join('\n')
    svg.prepend(style)
    const description = document.createElementNS('http://www.w3.org/2000/svg', 'desc')
    description.textContent = `${location.name}; ${location.latitude}, ${location.longitude}; ${date.toISOString()}; geometric horizon; catalogue: d3-celestial, Olaf Frohn (BSD-3-Clause).`
    svg.prepend(description)
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
    const link = document.createElement('a')
    link.href = url; link.download = `planisphere-${fields.day}.svg`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const locationFields = <>
    <label>Observing location<select aria-label="Observing location" value={LOCATIONS.findIndex((place) => place.name === location.name)} onChange={(event) => chooseLocation(event.target.value)}><option value="-1" disabled>Custom coordinates</option>{LOCATIONS.map((place, index) => <option key={place.name} value={index}>{place.name}</option>)}</select></label>
    <div className="coordinate-fields"><label>Latitude<input aria-label="Latitude" type="number" min="-90" max="90" step="0.01" value={location.latitude} onChange={(event) => { if (event.target.value !== '' && event.target.validity.valid) setLocation({ ...location, name: 'Custom coordinates', latitude: Number(event.target.value) }) }} /></label><label>Longitude<input aria-label="Longitude" type="number" min="-180" max="180" step="0.01" value={location.longitude} onChange={(event) => { if (event.target.value !== '' && event.target.validity.valid) setLocation({ ...location, name: 'Custom coordinates', longitude: Number(event.target.value) }) }} /></label></div>
    <input aria-label="Latitude slider" type="range" min="-90" max="90" step="0.1" value={location.latitude} onChange={(event) => setLocation({ ...location, name: 'Custom coordinates', latitude: Number(event.target.value) })} />
    <div className="range-ends"><span>90° S</span><span>Equator</span><span>90° N</span></div>
    <button className="location-button" onClick={locate} disabled={locating}><LocateFixed size={15} />{locating ? 'Locating...' : 'Use my location'}</button>
    {locationError && <p role="alert" className="error">{locationError}</p>}
  </>

  return <div className={`app ${night ? 'night-mode' : ''}`}>
    <header className="app-header"><div className="brand"><Compass size={28} strokeWidth={1.4} /><div><h1>Planisphere</h1><span>OBSERVING DESK</span></div></div><div className="header-location"><MapPin size={14} /><span>{location.name}</span><span className="coordinate-summary">{coordinate(location.latitude, 'N', 'S')}</span></div><div className="header-actions"><IconButton label={night ? 'Disable red-light mode' : 'Red-light mode'} aria-pressed={night} onClick={() => setNight(!night)}><Moon size={18} /></IconButton><IconButton label="Download SVG chart" disabled={!catalog} onClick={exportChart}><Download size={18} /></IconButton></div></header>
    <main className="desk">
      <aside className="sidebar">
        <section className="control-section"><h2><MapPin size={15} />Observer</h2>{!locationOpen && locationFields}</section>
        <section className="control-section"><h2><Sun size={15} />Date & time</h2><div className="date-fields"><label>Date<input aria-label="Date" type="date" min="1900-01-01" max="2100-12-31" value={fields.day} onChange={(event) => changeDate(event.target.value, fields.clock)} /></label><label>Time<input aria-label="Time" type="time" value={fields.clock} onChange={(event) => changeDate(fields.day, event.target.value)} /></label></div><label>UTC offset<select aria-label="UTC offset" value={offset} onChange={(event) => setOffset(Number(event.target.value))}>{Array.from({ length: 105 }, (_, index) => index / 4 - 12).map((value) => <option key={value} value={value}>{offsetLabel(value)}{value === 0 ? ' (UTC)' : ''}</option>)}</select></label><div className="time-actions"><button onClick={() => { setDate(new Date()); setPlaying(false) }}><Crosshair size={14} />Now</button><button onClick={() => { setOffset(-new Date().getTimezoneOffset() / 60) }}>Device offset</button></div><div className="condition"><span className={`status-dot ${condition.altitude > -18 ? 'daylight' : ''}`} />{condition.label}<span>Sun {condition.altitude.toFixed(0)}°</span></div></section>
        <section className="control-section"><h2><Settings2 size={15} />Chart layers</h2>{[['lines', 'Constellation lines'], ['labels', 'Bright star names'], ['targets', 'Deep-sky objects'], ['grid', 'RA / declination grid'], ['altitude', 'Altitude circles'], ['mask', 'Horizon mask']].map(([key, label]) => <label className="toggle-row" key={key}><span>{label}</span><input type="checkbox" role="switch" checked={options[key]} onChange={(event) => setOptions({ ...options, [key]: event.target.checked })} /></label>)}<label className="magnitude-label">Limiting magnitude <output>{options.magnitude.toFixed(1)}</output><input aria-label="Limiting magnitude" type="range" min="2" max="6" step="0.5" value={options.magnitude} onChange={(event) => setOptions({ ...options, magnitude: Number(event.target.value) })} /></label><div className="range-ends"><span>Brightest</span><span>Dark-sky limit</span></div></section>
        <footer className="sidebar-footer"><span>CATALOGUE</span><strong>{catalog ? '5,044 stars' : 'Loading stars...'}</strong><a href="https://github.com/ofrohn/d3-celestial" target="_blank" rel="noreferrer">d3-celestial / Hipparcos</a></footer>
      </aside>
      <div className="workspace">
        <div className="workspace-heading"><div><div className="eyebrow">THE SKY ABOVE</div><h2>{location.name}</h2><p>{coordinate(location.latitude, 'N', 'S')} <span>/</span> {coordinate(location.longitude, 'E', 'W')}</p></div><div className="sky-count"><Stars size={16} /><strong>{visibleStars.length.toLocaleString()}</strong><span>stars above horizon</span></div></div>
        <section className="chart-section" aria-label="Planisphere instrument"><div className="chart-meta"><span>{location.latitude < 0 ? 'SOUTH' : 'NORTH'} POLAR PROJECTION</span><span>{fields.day} <b>{fields.clock}</b> {offsetLabel(offset)}</span></div><div className="chart-viewport" ref={chartRef}><div className="chart-scale" style={{ width: `${zoom * 100}%` }}>{catalog ? <Planisphere stars={stars} lines={catalog.lines} date={date} latitude={location.latitude} longitude={location.longitude} offset={offset} options={{ ...options, targetList: targets }} selected={selected} guide={selected?.type !== 'Star' ? guide : null} onSelect={setSelectedId} onDateChange={(next) => { setPlaying(false); setDate(next) }} /> : <div className="chart-loading" role="status">{catalogError || 'Loading star catalogue...'}{catalogError && <button onClick={() => { setCatalogError(''); setReload(reload + 1) }}>Retry</button>}</div>}</div></div><div className="chart-bottom"><div className="legend"><span><i className="star-key" />Star</span><span><i className="target-key" />Deep sky</span><span className="horizon-key">Geometric horizon</span></div><div className="zoom-controls"><IconButton label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(Math.max(1, zoom - 0.25))}><Minus size={16} /></IconButton><output>{Math.round(zoom * 100)}%</output><IconButton label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom(Math.min(2, zoom + 0.25))}><Plus size={16} /></IconButton></div></div></section>
        <div className="transport"><div className="transport-date"><strong>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${fields.day}T12:00:00Z`))}</strong><span>{fields.clock} {offsetLabel(offset)}</span></div><div className="transport-buttons"><IconButton label="Previous hour" onClick={() => shift(-60)}><ArrowLeft size={17} /></IconButton><IconButton label={playing ? 'Pause time' : 'Play time'} className="play-button icon-button" aria-pressed={playing} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={17} /> : <Play size={17} />}</IconButton><IconButton label="Next hour" onClick={() => shift(60)}><ArrowRight size={17} /></IconButton></div><label className="time-scrubber"><span>00:00</span><input type="range" aria-label="Time of day" min="0" max="1439" value={Number(fields.clock.slice(0, 2)) * 60 + Number(fields.clock.slice(3))} onChange={(event) => { const minutes = Number(event.target.value); changeDate(fields.day, `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`) }} /><span>23:59</span></label></div>
        <section className="finder"><div className="finder-heading"><div><div className="eyebrow">OBJECT FINDER</div><h2>From bright stars to deep sky</h2></div><div className="search-field"><Search size={16} /><input aria-label="Search objects" placeholder="Search stars or objects" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <IconButton label="Clear search" onClick={() => setQuery('')}><X size={14} /></IconButton>}</div></div><div className="finder-tools"><div className="tabs"><button className={tab === 'targets' ? 'active' : ''} onClick={() => setTab('targets')}>Deep sky</button><button className={tab === 'stars' ? 'active' : ''} onClick={() => setTab('stars')}>Bright stars</button></div><label className="declination-filter">Declination<select aria-label="Declination filter" value={declination} onChange={(event) => { setDeclination(event.target.value); if (event.target.value !== '') setOptions({ ...options, grid: true }) }}><option value="">All</option>{[-80, -60, -40, -20, 0, 20, 40, 60, 80].map((value) => <option value={value} key={value}>{value > 0 ? '+' : ''}{value}° +/- 10°</option>)}</select></label></div><div className="finder-content"><div className="object-list" role="list" aria-label="Objects">{results.length ? results.map((object) => <button role="listitem" className={`object-row ${selectedId === object.id ? 'selected' : ''}`} key={object.id} onClick={() => { setSelectedId(object.id); setGuideId('') }}><span className={object.type === 'Star' ? 'object-symbol star-symbol' : 'object-symbol'}>{object.type === 'Star' ? <Stars size={16} /> : <Crosshair size={16} />}</span><span className="object-name"><strong>{object.name}</strong><small>{object.type === 'Star' ? object.constellation : object.designation} / {object.type}</small></span><span className={`object-altitude ${object.height > 0 ? 'above' : ''}`}>{object.height > 0 ? `${object.height.toFixed(0)}°` : 'Below'}</span></button>) : <p className="empty-state">No matching objects.</p>}</div><div className="object-detail">{selected && <><div className="detail-type">{selected.designation} / {selected.type}</div><h3>{selected.name || selected.designation}</h3><div className="detail-status"><span className={`status-dot ${selectedHeight <= 0 ? 'below' : ''}`} />{selectedHeight > 0 ? 'Above horizon' : 'Below horizon'}</div><div className="object-facts"><div><span>Altitude</span><strong>{selectedHeight.toFixed(1)}°</strong></div><div><span>Magnitude</span><strong>{selected.mag.toFixed(1)}</strong></div><div><span>RA (of date)</span><strong>{(selected.ra / 15).toFixed(2)}h</strong></div><div><span>Declination</span><strong>{selected.dec.toFixed(1)}°</strong></div></div>{selected.type !== 'Star' && <div className="guide-stars"><h4>Bright reference stars</h4>{guideCandidates.map((star) => <button key={star.id} className={guide?.id === star.id ? 'chosen' : ''} onClick={() => setGuideId(star.id)}><span>{star.name}</span><span>{star.distance.toFixed(1)}° away {guide?.id === star.id && <Check size={13} />}</span></button>)}{!guideCandidates.length && <p>No bright reference stars above the horizon.</p>}<div className="equipment">{selected.mag > 6 ? 'Telescope target' : selected.mag > 3 ? 'Binocular target' : 'Naked-eye / binocular target'}</div></div>}{selectedHeight <= 0 && <div className="below-notice">Not above your horizon at this time.</div>}{selectedHeight > 0 && condition.altitude > -18 && <div className="below-notice">{condition.label}: faint objects may be washed out.</div>}</>}</div></div></section>
        <footer className="workspace-footer"><span>ASTRONOMY ENGINE <span>/</span> EQUATOR OF DATE</span><span>Horizon visibility, not a weather or light-pollution forecast.</span></footer>
      </div>
    </main>
    <dialog ref={locationDialog} className="location-dialog" onCancel={(event) => event.preventDefault()}><div className="dialog-heading"><Compass size={30} strokeWidth={1.4} /><span>OBSERVER SETUP</span></div><h2>Your place under the stars.</h2><div className="latitude-display">{Math.abs(location.latitude).toFixed(2)}<span>° {location.latitude < 0 ? 'S' : 'N'}</span></div>{locationOpen && locationFields}<button className="primary-button" onClick={() => setLocationOpen(false)}>Set observing location<ArrowRight size={16} /></button></dialog>
  </div>
}