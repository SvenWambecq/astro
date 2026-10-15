import { useId } from 'react'

const VIEW = { width: 520, height: 390, cx: 260, cy: 188, radius: 150, earthRadius: 38 }

function pointAt(angle, radius) {
  return [VIEW.cx + radius * Math.cos(angle), VIEW.cy - radius * Math.sin(angle)]
}

function arcPoints(angle, radius, count = 32) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const current = angle * index / count
    const [x, y] = pointAt(current, radius)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
}

function removeEarthOcclusion(start, end, chordY) {
  if (start >= end) return []
  const verticalOffset = chordY - VIEW.cy
  if (Math.abs(verticalOffset) >= VIEW.earthRadius) return [[start, end]]

  const halfWidth = Math.sqrt(VIEW.earthRadius ** 2 - verticalOffset ** 2)
  const earthStart = VIEW.cx - halfWidth
  const earthEnd = VIEW.cx + halfWidth
  const segments = []
  if (start < earthStart) segments.push([start, Math.min(end, earthStart)])
  if (end > earthEnd) segments.push([Math.max(start, earthEnd), end])
  return segments.filter(([left, right]) => left < right)
}

export default function EarthFrame({ latitude, declination }) {
  const arrowId = useId()
  const phi = latitude * Math.PI / 180
  const earthObserver = pointAt(phi, VIEW.earthRadius)
  const zenithTip = pointAt(phi, VIEW.radius * 1.02)
  const horizonDirection = [-Math.sin(phi), -Math.cos(phi)]
  const horizonStart = [VIEW.cx - VIEW.radius * horizonDirection[0], VIEW.cy - VIEW.radius * horizonDirection[1]]
  const horizonEnd = [VIEW.cx + VIEW.radius * horizonDirection[0], VIEW.cy + VIEW.radius * horizonDirection[1]]

  const sun = pointAt(declination, VIEW.radius)
  const chordY = VIEW.cy - VIEW.radius * Math.sin(declination)
  const halfChord = VIEW.radius * Math.cos(declination)
  const horizonCrossing = VIEW.cx - VIEW.radius * Math.tan(phi) * Math.sin(declination)
  const clippedCrossing = Math.max(VIEW.cx - halfChord, Math.min(VIEW.cx + halfChord, horizonCrossing))
  const chordSegments = [
    ...removeEarthOcclusion(VIEW.cx - halfChord, clippedCrossing, chordY).map((segment) => ({ segment, night: true })),
    ...removeEarthOcclusion(clippedCrossing, VIEW.cx + halfChord, chordY).map((segment) => ({ segment, night: false })),
  ]

  return (
    <svg className="earth-diagram" viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img" aria-label="Earth-centered meridian showing latitude, solar declination, horizon, and daily arc">
      <defs>
        <marker id={arrowId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="#253d38" />
        </marker>
        <clipPath id={`${arrowId}-sphere`}>
          <circle cx={VIEW.cx} cy={VIEW.cy} r={VIEW.radius} />
        </clipPath>
      </defs>

      <circle className="celestial-rim" cx={VIEW.cx} cy={VIEW.cy} r={VIEW.radius} />
      <line className="equator" x1={VIEW.cx - VIEW.radius} y1={VIEW.cy} x2={VIEW.cx + VIEW.radius} y2={VIEW.cy} />
      <line className="axis-line" x1={VIEW.cx} y1={VIEW.cy - VIEW.radius} x2={VIEW.cx} y2={VIEW.cy + VIEW.radius} />
      <text className="diagram-label pole-label" x={VIEW.cx + 7} y={VIEW.cy - VIEW.radius + 4}>NCP</text>
      <text className="diagram-label equator-label" x={VIEW.cx - VIEW.radius + 5} y={VIEW.cy - 8}>EQUATOR</text>

      <circle className="earth-disc" cx={VIEW.cx} cy={VIEW.cy} r={VIEW.earthRadius} />
      <line className="earth-equator" x1={VIEW.cx - VIEW.earthRadius} y1={VIEW.cy} x2={VIEW.cx + VIEW.earthRadius} y2={VIEW.cy} />
      <line className="earth-axis" x1={VIEW.cx} y1={VIEW.cy - VIEW.earthRadius} x2={VIEW.cx} y2={VIEW.cy + VIEW.earthRadius} />
      <text className="earth-label" x={VIEW.cx - 20} y={VIEW.cy + 4}>EARTH</text>

      <line className="horizon-line" x1={horizonStart[0]} y1={horizonStart[1]} x2={horizonEnd[0]} y2={horizonEnd[1]} />
      <text className="diagram-label horizon-label" x={VIEW.cx + horizonDirection[0] * 104 + 7} y={VIEW.cy + horizonDirection[1] * 104 - 5}>HORIZON</text>

      <line className="zenith-ray" x1={VIEW.cx} y1={VIEW.cy} x2={zenithTip[0]} y2={zenithTip[1]} markerEnd={`url(#${arrowId})`} />
      <circle className="observer-dot" cx={earthObserver[0]} cy={earthObserver[1]} r="6" />
      <text className="diagram-label zenith-label" x={zenithTip[0] + 7} y={zenithTip[1] + 1}>ZENITH</text>

      <polyline className="phi-arc" points={arcPoints(phi, 47)} />
      <text className="angle-label phi-label" x={pointAt(phi / 2, 59)[0]} y={pointAt(phi / 2, 59)[1] - 1}>φ</text>

      <line className="sun-direction" x1={VIEW.cx} y1={VIEW.cy} x2={sun[0]} y2={sun[1]} />
      <line className="delta-guide" x1={sun[0]} y1={VIEW.cy} x2={sun[0]} y2={sun[1]} />
      <polyline className="delta-arc" points={arcPoints(declination, 90)} />
      <text className="angle-label delta-label" x={pointAt(declination / 2, 102)[0]} y={pointAt(declination / 2, 102)[1] - 2}>δ</text>
      <circle className="sun-dot" cx={sun[0]} cy={sun[1]} r="6.5" />
      <text className="diagram-label sun-label" x={sun[0] + 10} y={sun[1] - 8}>SUN</text>

      <g clipPath={`url(#${arrowId}-sphere)`}>
        {chordSegments.map(({ segment: [x1, x2], night }, index) => (
          <line key={`${night ? 'night' : 'day'}-${index}`} className={`daily-chord ${night ? 'night' : 'day'}`} x1={x1} y1={chordY} x2={x2} y2={chordY} />
        ))}
      </g>

      <g className="earth-legend" transform="translate(22 338)">
        <line className="daily-chord day" x1="0" y1="0" x2="28" y2="0" />
        <text className="legend-label" x="36" y="4">DAY</text>
        <line className="daily-chord night" x1="92" y1="0" x2="120" y2="0" />
        <text className="legend-label" x="128" y="4">NIGHT</text>
      </g>
    </svg>
  )
}