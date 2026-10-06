import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, SunMedium } from 'lucide-react'
import EarthFrame from './EarthFrame.jsx'
import ObserverSky from './ObserverSky.jsx'
import SkyChart from './SkyChart.jsx'
import {
  dayOfYear,
  daylightGeometry,
  dateFromDayOfYear,
  daysInYear,
  formatAngle,
  solarDeclination,
} from './astro.js'
import './App.css'

const DEFAULT_DATE = '2026-03-20'
const DEFAULT_LATITUDE = 52

function moveCalendarDate(dateValue, offset) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const nextDate = new Date(Date.UTC(year, month - 1, day + offset))
  return nextDate.toISOString().slice(0, 10)
}

function formatDateLabel(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatSolarTime(hour) {
  if (hour === null) return '--:--'
  const totalMinutes = Math.round(hour * 60)
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function App() {
  const [latitude, setLatitude] = useState(DEFAULT_LATITUDE)
  const [selectedDate, setSelectedDate] = useState(DEFAULT_DATE)
  const ordinal = dayOfYear(selectedDate)
  const year = Number(selectedDate.slice(0, 4))
  const declination = solarDeclination(selectedDate)
  const daylight = daylightGeometry(latitude, declination)
  const dateStatus = daylight.hours === 24
    ? 'Polar day'
    : daylight.hours === 0
      ? 'Polar night'
      : 'Sun above horizon'

  function setDayNumber(value) {
    const boundedDay = Math.max(1, Math.min(daysInYear(year), Number(value)))
    setSelectedDate(dateFromDayOfYear(year, boundedDay))
  }

  function setLatitudeValue(value) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) setLatitude(Math.max(-90, Math.min(90, parsed)))
  }

  function resetView() {
    setLatitude(DEFAULT_LATITUDE)
    setSelectedDate(DEFAULT_DATE)
  }

  return (
    <main className="app-shell">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Dagboog home">
          <span className="wordmark-mark"><SunMedium size={20} strokeWidth={1.8} /></span>
          <span>DAGBOOG <span className="wordmark-divider">/</span> FIELD MODEL</span>
        </a>
        <div className="masthead-meta">
          <span className="live-indicator" />
          <span>SPHERICAL ASTRONOMY</span>
          <span className="masthead-index">01—03</span>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">EARTH / OBSERVER / SUN</p>
          <h1>How long is the day?</h1>
          <p className="intro-copy">Follow latitude φ and solar declination δ from the Earth meridian to the local horizon.</p>
        </div>
        <button className="reset-button" type="button" onClick={resetView} title="Reset latitude and date" aria-label="Reset latitude and date">
          <RotateCcw size={15} strokeWidth={1.8} />
          <span>Reset</span>
        </button>
      </section>

      <section className="control-deck" aria-label="Visualization controls">
        <div className="control-group latitude-group">
          <div className="control-heading">
            <label htmlFor="latitude-slider">LATITUDE <span>φ</span></label>
            <span className="control-readout">{latitude.toFixed(1)}°</span>
          </div>
          <div className="control-row">
            <input
              id="latitude-slider"
              className="range-input latitude-range"
              type="range"
              min="-90"
              max="90"
              step="0.1"
              value={latitude}
              onChange={(event) => setLatitudeValue(event.target.value)}
              aria-label="Observer latitude, degrees"
            />
            <label className="number-field" htmlFor="latitude-number">
              <span className="visually-hidden">Latitude in degrees</span>
              <input
                id="latitude-number"
                type="number"
                min="-90"
                max="90"
                step="0.1"
                value={latitude}
                onChange={(event) => setLatitudeValue(event.target.value)}
              />
              <span>°</span>
            </label>
          </div>
          <div className="range-ends"><span>90° S</span><span>0°</span><span>90° N</span></div>
        </div>

        <div className="control-separator" aria-hidden="true" />

        <div className="control-group date-group">
          <div className="control-heading">
            <label htmlFor="day-slider">DATE <span>δ</span></label>
            <span className="control-readout date-readout">{formatDateLabel(selectedDate)}</span>
          </div>
          <div className="control-row date-controls-row">
            <button className="step-button" type="button" onClick={() => setSelectedDate(moveCalendarDate(selectedDate, -1))} title="Previous day" aria-label="Previous day">
              <ChevronLeft size={16} />
            </button>
            <input
              id="day-slider"
              className="range-input date-range"
              type="range"
              min="1"
              max={daysInYear(year)}
              step="1"
              value={ordinal}
              onChange={(event) => setDayNumber(event.target.value)}
              aria-label="Day of year; use left and right arrow keys to step by one day"
            />
            <button className="step-button" type="button" onClick={() => setSelectedDate(moveCalendarDate(selectedDate, 1))} title="Next day" aria-label="Next day">
              <ChevronRight size={16} />
            </button>
            <label className="date-field" htmlFor="calendar-date">
              <CalendarDays size={15} aria-hidden="true" />
              <span className="visually-hidden">Select calendar date</span>
              <input id="calendar-date" type="date" value={selectedDate} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} />
            </label>
          </div>
          <div className="range-ends"><span>JAN 01</span><span>DAY {ordinal} / {daysInYear(year)}</span><span>DEC 31</span></div>
        </div>
      </section>

      <section className="readout-strip" aria-live="polite">
        <div className="readout-cell"><span className="readout-label">DECLINATION</span><strong>{formatAngle(declination / (Math.PI / 180), 2)}</strong></div>
        <div className="readout-cell"><span className="readout-label">DAYLIGHT</span><strong>{daylight.hours.toFixed(2)} <small>h</small></strong></div>
        <div className="readout-cell"><span className="readout-label">SUNRISE</span><strong>{daylight.hours === 24 ? '—' : daylight.hours === 0 ? '—' : formatSolarTime(daylight.sunrise)}</strong></div>
        <div className="readout-cell"><span className="readout-label">SUNSET</span><strong>{daylight.hours === 24 ? '—' : daylight.hours === 0 ? '—' : formatSolarTime(daylight.sunset)}</strong></div>
        <div className="condition-chip"><span className={`condition-dot ${daylight.hours === 0 ? 'is-night' : ''}`} />{dateStatus}</div>
      </section>

      <section className="views-grid" aria-label="Linked reference-frame diagrams">
        <article className="view-panel earth-panel">
          <header className="panel-header">
            <div className="panel-title-wrap"><span className="panel-number">01</span><h2>Earth meridian</h2></div>
            <span className="panel-tag">φ / δ</span>
          </header>
          <p className="panel-subtitle">Observer latitude and Sun declination in one meridian section</p>
          <EarthFrame latitude={latitude} declination={declination} />
          <footer className="panel-footer"><span><i className="legend-dot observer-legend" />Observer</span><span><i className="legend-line horizon-legend" />Horizon</span><span><i className="legend-line sun-legend" />Sun direction</span></footer>
        </article>

        <article className="view-panel sky-panel">
          <header className="panel-header">
            <div className="panel-title-wrap"><span className="panel-number">02</span><h2>Observer’s sky</h2></div>
            <span className="panel-tag">LOCAL FRAME</span>
          </header>
          <p className="panel-subtitle">Daily circle against the observer’s horizon</p>
          <ObserverSky latitude={latitude} declination={declination} />
          <footer className="panel-footer"><span><i className="legend-line day-legend" />Day</span><span><i className="legend-line night-legend" />Night</span><span><i className="legend-line north-legend" />North</span></footer>
        </article>
      </section>

      <section className="chart-panel">
        <header className="panel-header chart-header">
          <div className="panel-title-wrap"><span className="panel-number">03</span><h2>Altitude through the solar day</h2></div>
          <span className="chart-meta">LOCAL SOLAR TIME · {daylight.hours.toFixed(2)} HOURS ABOVE HORIZON</span>
        </header>
        <SkyChart latitude={latitude} declination={declination} daylight={daylight} />
      </section>

      <footer className="page-footer">
        <span>DECLINATION MODEL: SIMPLE SEASONAL APPROXIMATION</span>
        <span>IDEAL HORIZON · REFRACTION OMITTED</span>
        <span>φ = {latitude.toFixed(1)}° <b>·</b> δ = {formatAngle(declination / (Math.PI / 180), 2)}</span>
      </footer>
    </main>
  )
}

export default App