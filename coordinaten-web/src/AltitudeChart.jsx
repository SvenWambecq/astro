import { SIDEREAL_DAY_MS, equatorialToHorizontalAt, skyCondition, sunAltitude, transitEvents } from './coordinates.js'

const VIEW = { width: 1000, height: 250, left: 44, right: 14, top: 16, bottom: 34 }
const HOUR_MS = 3600000
const WINDOW_HOURS = 12
const SAMPLES = 288

const plotWidth = VIEW.width - VIEW.left - VIEW.right
const plotHeight = VIEW.height - VIEW.top - VIEW.bottom
const yFor = (altitude) => VIEW.top + (90 - altitude) / 180 * plotHeight

function eventTimes(base, start, end) {
  if (base === null) return []
  return [-1, 0, 1].map((k) => base + k * SIDEREAL_DAY_MS).filter((time) => time >= start && time <= end)
}

export default function AltitudeChart({ timeMs, star, observer, formatTime, onSeek }) {
  const start = timeMs - WINDOW_HOURS * HOUR_MS
  const end = timeMs + WINDOW_HOURS * HOUR_MS
  const xFor = (time) => VIEW.left + (time - start) / (end - start) * plotWidth

  const samples = Array.from({ length: SAMPLES + 1 }, (_, index) => {
    const time = start + (end - start) * index / SAMPLES
    return { time, altitude: equatorialToHorizontalAt(star, observer, time).altitude }
  })
  const path = samples.map(({ time, altitude }, index) => `${index ? 'L' : 'M'}${xFor(time).toFixed(1)},${yFor(altitude).toFixed(1)}`).join(' ')

  const bands = []
  for (let index = 0; index < SAMPLES; index += 1) {
    const middle = (samples[index].time + samples[index + 1].time) / 2
    const condition = skyCondition(sunAltitude(middle, observer))
    const last = bands.at(-1)
    if (last && last.condition === condition) last.to = samples[index + 1].time
    else bands.push({ condition, from: samples[index].time, to: samples[index + 1].time })
  }

  const hourTicks = []
  const firstHour = new Date(start)
  firstHour.setMinutes(0, 0, 0)
  for (let tick = firstHour.getTime() + HOUR_MS; tick <= end; tick += HOUR_MS) {
    if (new Date(tick).getHours() % 3 === 0) hourTicks.push(tick)
  }

  const events = transitEvents(timeMs, star, observer)
  const markers = [
    ...eventTimes(events.transit, start, end).map((time) => ({ time, kind: 'transit', label: 'Transit' })),
    ...eventTimes(events.rise, start, end).map((time) => ({ time, kind: 'rise', label: 'Rise' })),
    ...eventTimes(events.set, start, end).map((time) => ({ time, kind: 'set', label: 'Set' })),
  ]
  const currentAltitude = equatorialToHorizontalAt(star, observer, timeMs).altitude

  function handleClick(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width * VIEW.width
    if (x < VIEW.left || x > VIEW.width - VIEW.right) return
    onSeek(start + (x - VIEW.left) / plotWidth * (end - start))
  }

  return (
    <svg
      className="altitude-chart"
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      role="img"
      aria-label={`Altitude of ${star.name} from 12 hours before to 12 hours after the selected time, with daylight and twilight shading. Click to jump to a time.`}
      onClick={handleClick}
    >
      <defs>
        <clipPath id="above-horizon">
          <rect x={VIEW.left} y={VIEW.top} width={plotWidth} height={yFor(0) - VIEW.top} />
        </clipPath>
      </defs>

      {bands.map((band) => (
        <rect key={band.from} className={`sky-band ${band.condition}`} x={xFor(band.from)} y={VIEW.top} width={Math.max(0, xFor(band.to) - xFor(band.from))} height={plotHeight} />
      ))}

      {[-60, -30, 30, 60, 90].map((altitude) => (
        <g key={altitude}>
          <line className="chart-grid" x1={VIEW.left} x2={VIEW.width - VIEW.right} y1={yFor(altitude)} y2={yFor(altitude)} />
          <text className="chart-tick" x={VIEW.left - 7} y={yFor(altitude) + 3} textAnchor="end">{altitude > 0 ? `+${altitude}` : altitude}°</text>
        </g>
      ))}
      {hourTicks.map((tick) => (
        <g key={tick}>
          <line className="chart-grid vertical" x1={xFor(tick)} x2={xFor(tick)} y1={VIEW.top} y2={VIEW.top + plotHeight} />
          <text className="chart-tick" x={xFor(tick)} y={VIEW.height - 15} textAnchor="middle">{formatTime(tick)}</text>
        </g>
      ))}

      <line className="chart-horizon" x1={VIEW.left} x2={VIEW.width - VIEW.right} y1={yFor(0)} y2={yFor(0)} />
      <text className="chart-axis-label" x={VIEW.left + 6} y={yFor(0) - 6}>HORIZON</text>

      <path className="altitude-full" d={path} />
      <path className="altitude-up" d={path} clipPath="url(#above-horizon)" />

      {markers.map((marker) => (
        <g key={`${marker.kind}-${marker.time}`} className={`chart-event ${marker.kind}`}>
          <line x1={xFor(marker.time)} x2={xFor(marker.time)} y1={VIEW.top} y2={VIEW.top + plotHeight} />
          <text x={xFor(marker.time) + 4} y={marker.kind === 'transit' ? VIEW.top + 11 : yFor(0) + 14}>{marker.label} {formatTime(marker.time)}</text>
        </g>
      ))}

      <line className="now-line" x1={xFor(timeMs)} x2={xFor(timeMs)} y1={VIEW.top} y2={VIEW.top + plotHeight} />
      <circle className="now-point" cx={xFor(timeMs)} cy={yFor(currentAltitude)} r="5" />
      <text className="chart-axis-label" x={VIEW.width - VIEW.right} y={VIEW.height - 2} textAnchor="end">LOCAL TIME · CLICK TO JUMP</text>
    </svg>
  )
}
