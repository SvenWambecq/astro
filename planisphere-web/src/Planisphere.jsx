import { useRef } from 'react'
import { dateFromFields, dateFields, diskRotation, hemisphere, horizonPoints, horizontalToEquatorial, minutesForRotation, normalize, ofDate, pathFromPoints, project, RAD, sidereal } from './astro.js'

const RADIUS = 300
const ringPoint = (angle, radius, latitude) => project(angle, 90 - hemisphere(latitude) * (180 - Math.abs(latitude)), latitude, 0, radius)

function RingLabel({ angle, radius, latitude, children, className = '' }) {
  const point = ringPoint(angle, radius, latitude)
  return <text x={point[0]} y={point[1]} textAnchor="middle" dominantBaseline="central" transform={`rotate(${hemisphere(latitude) * angle},${point[0]},${point[1]})`} className={className}>{children}</text>
}

export default function Planisphere({ stars, lines, date, latitude, longitude, offset, options, selected, guide, onSelect, onDateChange }) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const lst = sidereal(date, longitude)
  const pole = hemisphere(latitude)
  const rotation = diskRotation(lst, latitude)
  const horizon = pathFromPoints(horizonPoints(latitude), true)
  const fields = dateFields(date, offset)
  const year = Number(fields.day.slice(0, 4))
  const selectedPoint = selected ? project(selected.ra, selected.dec, latitude) : null
  const guidePoint = guide ? project(guide.ra, guide.dec, latitude) : null

  function pointerAngle(event) {
    const bounds = svgRef.current.getBoundingClientRect()
    return Math.atan2(event.clientY - bounds.top - bounds.height / 2, event.clientX - bounds.left - bounds.width / 2) / RAD
  }

  function beginDrag(event) {
    if (event.button !== 0 || event.target.closest('[data-object]')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { angle: pointerAngle(event), time: date.getTime() }
  }

  function drag(event) {
    if (!dragRef.current) return
    const angle = pointerAngle(event)
    const delta = normalize(angle - dragRef.current.angle + 180) - 180
    const time = dragRef.current.time + minutesForRotation(delta, latitude) * 60000
    dragRef.current = { angle, time }
    onDateChange(new Date(time))
  }

  const declinations = [-60, -30, 0, 30, 60].filter((dec) => 90 - pole * dec <= 180 - Math.abs(latitude))
  const months = Array.from({ length: 12 }, (_, month) => {
    const day = `${year}-${String(month + 1).padStart(2, '0')}-15`
    return { angle: sidereal(dateFromFields(day, '00:00', offset), longitude), label: new Date(Date.UTC(year, month, 15)).toLocaleString('en', { month: 'short', timeZone: 'UTC' }) }
  })
  const dayTicks = Array.from({ length: 12 }, (_, month) => [1, 5, 10, 15, 20, 25].map((day) => ({ day, angle: sidereal(dateFromFields(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, '00:00', offset), longitude) }))).flat()
  const zenith = project(lst, latitude, latitude, lst)
  const cardinalLabels = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]]

  return <svg ref={svgRef} className="planisphere" viewBox="-400 -400 800 800" aria-label="Rotating planisphere star chart" onPointerDown={beginDrag} onPointerMove={drag} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}>
    <defs>
      <clipPath id="sky-window"><path d={horizon} /></clipPath>
      <clipPath id="star-disk"><circle r={RADIUS} /></clipPath>
      <radialGradient id="sky-ink"><stop offset="0" stopColor="#1b3033" /><stop offset="1" stopColor="#0e191e" /></radialGradient>
    </defs>
    <circle r="389" className="outer-disk" />
    <circle r="369" className="ring-border" />
    {Array.from({ length: 96 }, (_, index) => {
      const angle = -index * 15.0410686 / 4
      const inner = ringPoint(angle, index % 4 === 0 ? 370 : 375, latitude)
      const outer = ringPoint(angle, 380, latitude)
      return <line key={index} x1={inner[0]} y1={inner[1]} x2={outer[0]} y2={outer[1]} className="hour-tick" />
    })}
    {Array.from({ length: 24 }, (_, hour) => <RingLabel key={hour} angle={-hour * 15.0410686} radius={358} latitude={latitude} className="hour-label">{String(hour).padStart(2, '0')}</RingLabel>)}
    <g transform={`rotate(${rotation})`} className="date-disk">
      <circle r="344" className="calendar-disk" />
      <circle r="308" className="ring-border" />
      {dayTicks.map(({ day, angle }, index) => {
        const inner = ringPoint(angle, day === 1 ? 309 : 312, latitude)
        const outer = ringPoint(angle, 319, latitude)
        return <line key={index} x1={inner[0]} y1={inner[1]} x2={outer[0]} y2={outer[1]} className="date-tick" />
      })}
      {months.map((month) => <RingLabel key={month.label} angle={month.angle} radius={331} latitude={latitude} className="month-label">{month.label.toUpperCase()}</RingLabel>)}
      {dayTicks.filter(({ day }) => day === 1 || day === 10 || day === 20).map(({ day, angle }, index) => <RingLabel key={index} angle={angle} radius={303} latitude={latitude} className="day-label">{day}</RingLabel>)}
    </g>
    <circle r={RADIUS} className="mask-disk" />
    <path d={horizon} fill="url(#sky-ink)" />
    <g clipPath={options.mask ? 'url(#sky-window)' : 'url(#star-disk)'}>
      {!options.mask && <circle r={RADIUS} fill="url(#sky-ink)" />}
      {options.altitude && [30, 60].map((height) => <path key={height} d={pathFromPoints(horizonPoints(latitude, height), true)} className="altitude-grid" />)}
      <g transform={`rotate(${rotation})`}>
        {options.grid && <g className="equatorial-grid">
          {declinations.map((dec) => <circle key={dec} r={(90 - pole * dec) / (180 - Math.abs(latitude)) * RADIUS} className={dec === 0 ? 'equator' : ''} />)}
          {Array.from({ length: 24 }, (_, hour) => { const point = project(hour * 15, pole * (Math.abs(latitude) - 90), latitude); return <line key={hour} x1="0" y1="0" x2={point[0]} y2={point[1]} /> })}
        </g>}
        {options.lines && lines.map((line, lineIndex) => <g key={`${line.id}-${lineIndex}`} className="constellation-lines">{line.geometry.coordinates.map((segment, index) => <path key={index} d={pathFromPoints(segment.map(([ra, dec]) => { const current = ofDate(ra, dec, date); return project(current.ra, current.dec, latitude) }))} />)}</g>)}
        {stars.filter((star) => star.mag <= options.magnitude && 90 - pole * star.dec <= 180 - Math.abs(latitude)).map((star) => {
          const point = project(star.ra, star.dec, latitude)
          const size = Math.max(0.55, 2.9 - star.mag * 0.43)
          return <g key={star.id} transform={`translate(${point[0]},${point[1]})`}>
            <circle r={size} fill={star.color > 1 ? '#f3cc9b' : star.color < 0 ? '#c2dcf8' : '#edf3e8'} />
            {(star.mag < 2.2 || star.id === '11767') && <circle r="9" fill="transparent" data-object={star.id} onClick={() => onSelect(star.id)} className="star-hit"><title>{star.name || star.designation} | magnitude {star.mag}</title></circle>}
            {options.labels && star.name && (star.mag < 1.8 || star.id === '11767') && <text transform={`rotate(${-rotation})`} x="7" y="-6" className="star-label">{star.name}</text>}
          </g>
        })}
        {options.targets && options.targetList.map((target) => { const point = project(target.ra, target.dec, latitude); return <g key={target.id} transform={`translate(${point[0]},${point[1]})`} data-object={target.id} onClick={() => onSelect(target.id)} className="target-marker"><circle r="4" /><circle r="11" stroke="none" fill="transparent" /><text x="8" y="4" transform={`rotate(${-rotation})`}>{target.designation}</text><title>{target.name}</title></g> })}
        {selectedPoint && <g className="selection-marker">
          {guidePoint && <line x1={guidePoint[0]} y1={guidePoint[1]} x2={selectedPoint[0]} y2={selectedPoint[1]} />}
          <circle cx={selectedPoint[0]} cy={selectedPoint[1]} r="12" />
          <circle cx={selectedPoint[0]} cy={selectedPoint[1]} r="3" />
        </g>}
      </g>
      <g className="zenith"><path d={`M${zenith[0] - 5},${zenith[1]} h10 M${zenith[0]},${zenith[1] - 5} v10`} /><text x={zenith[0] + 9} y={zenith[1] + 4}>Zenith</text></g>
    </g>
    <path d={horizon} className="horizon-border" />
    {options.grid && declinations.map((dec) => { const point = project(lst, dec, latitude, lst); return <text key={dec} x="5" y={point[1] - 4} className="declination-label" clipPath="url(#sky-window)">{dec > 0 ? '+' : ''}{dec}°</text> })}
    {cardinalLabels.map(([label, azimuth]) => {
      const equatorial = horizontalToEquatorial(azimuth + 0.001, 0, latitude)
      const point = project(equatorial.ra, equatorial.dec, latitude)
      const center = project(0, latitude, latitude)
      const direction = [point[0] - center[0], point[1] - center[1]]
      const length = Math.hypot(...direction) || 1
      const position = [point[0] + direction[0] / length * 15, point[1] + direction[1] / length * 15]
      return <text key={label} x={position[0]} y={position[1]} className={`cardinal ${label.length === 1 ? 'major' : ''}`} textAnchor="middle" dominantBaseline="central">{label}</text>
    })}
    <circle r="3" className="pivot" />
    <path d="M-4,-389 L4,-389 L0,-382 Z" className="index-marker" />
  </svg>
}