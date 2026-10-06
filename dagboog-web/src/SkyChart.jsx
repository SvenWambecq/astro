import { solarAltitude } from './astro.js'

const WIDTH = 880
const HEIGHT = 250
const MARGIN = { top: 18, right: 20, bottom: 42, left: 52 }
const Y_MIN = -10
const Y_MAX = 90

function chartX(hour) {
  return MARGIN.left + (hour / 24) * (WIDTH - MARGIN.left - MARGIN.right)
}

function chartY(altitude) {
  return MARGIN.top + ((Y_MAX - altitude) / (Y_MAX - Y_MIN)) * (HEIGHT - MARGIN.top - MARGIN.bottom)
}

function linePath(points) {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')
}

function visibleAreaPath(points) {
  if (points.length === 0) return ''
  const horizonY = chartY(0)
  const first = points[0]
  const last = points[points.length - 1]
  return `${linePath(points)} L ${last[0].toFixed(2)} ${horizonY.toFixed(2)} L ${first[0].toFixed(2)} ${horizonY.toFixed(2)} Z`
}

export default function SkyChart({ latitude, declination, daylight }) {
  const samples = Array.from({ length: 481 }, (_, index) => {
    const hour = index / 20
    return { hour, altitude: solarAltitude(latitude, declination, hour) }
  })
  const fullPath = linePath(samples.map(({ hour, altitude }) => [chartX(hour), chartY(altitude)]))
  const daylightSamples = samples.filter(({ altitude }) => altitude >= 0)
  const daylightPath = linePath(daylightSamples.map(({ hour, altitude }) => [chartX(hour), chartY(altitude)]))
  const daylightArea = visibleAreaPath(daylightSamples.map(({ hour, altitude }) => [chartX(hour), chartY(altitude)]))
  const noon = samples[240].altitude

  return (
    <svg className="altitude-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Solar altitude over local solar time">
      {[0, 30, 60, 90].map((altitude) => (
        <g key={altitude}>
          <line className={altitude === 0 ? 'chart-horizon' : 'chart-grid'} x1={MARGIN.left} y1={chartY(altitude)} x2={WIDTH - MARGIN.right} y2={chartY(altitude)} />
          <text className="chart-tick" x={MARGIN.left - 10} y={chartY(altitude) + 4} textAnchor="end">{altitude}°</text>
        </g>
      ))}
      {[0, 6, 12, 18, 24].map((hour) => (
        <g key={hour}>
          <line className="chart-grid vertical" x1={chartX(hour)} y1={MARGIN.top} x2={chartX(hour)} y2={HEIGHT - MARGIN.bottom} />
          <text className="chart-tick" x={chartX(hour)} y={HEIGHT - 18} textAnchor="middle">{String(hour).padStart(2, '0')}</text>
        </g>
      ))}
      {daylight.sunrise !== null && daylight.sunset !== null && (
        <g>
          <line className="sun-event" x1={chartX(daylight.sunrise)} y1={MARGIN.top} x2={chartX(daylight.sunrise)} y2={HEIGHT - MARGIN.bottom} />
          <line className="sun-event" x1={chartX(daylight.sunset)} y1={MARGIN.top} x2={chartX(daylight.sunset)} y2={HEIGHT - MARGIN.bottom} />
          <text className="event-label" x={chartX(daylight.sunrise)} y={MARGIN.top + 13} textAnchor="middle">RISE</text>
          <text className="event-label" x={chartX(daylight.sunset)} y={MARGIN.top + 13} textAnchor="middle">SET</text>
        </g>
      )}
      {daylightArea && <path className="daylight-fill" d={daylightArea} />}
      <path className="altitude-full" d={fullPath} />
      <path className="altitude-day" d={daylightPath} />
      <circle className="noon-point" cx={chartX(12)} cy={chartY(noon)} r="5" />
      <text className="chart-axis-label" x={WIDTH / 2} y={HEIGHT - 1} textAnchor="middle">LOCAL SOLAR TIME</text>
      <text className="chart-axis-label" x="16" y={HEIGHT / 2} textAnchor="middle" transform={`rotate(-90 16 ${HEIGHT / 2})`}>ALTITUDE</text>
    </svg>
  )
}