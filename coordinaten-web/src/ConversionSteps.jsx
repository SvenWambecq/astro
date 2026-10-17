import { RAD, azimuthForOrigin, formatAngle } from './coordinates.js'

const n = (value, digits = 4) => (value < 0 ? `−${Math.abs(value).toFixed(digits)}` : value.toFixed(digits))
const deg = (value, digits = 3) => `${n(value, digits)}°`

function signedHours(degrees, mode) {
  const text = formatAngle(Math.abs(degrees), 'hours', mode)
  return `${degrees < 0 ? '−' : '+'}${text}`
}

function Step({ index, title, formula, children, note }) {
  return (
    <li className="step">
      <span className="step-index" aria-hidden="true">{index}</span>
      <div className="step-body">
        <h3>{title}</h3>
        <p className="step-formula">{formula}</p>
        <div className="step-work">{children}</div>
        {note && <p className="step-note">{note}</p>}
      </div>
    </li>
  )
}

export default function ConversionSteps({ observer, star, gmst, siderealTime, hourAngle, horizontal, azimuthOrigin, mode, geometry }) {
  const phi = observer.latitude
  const delta = star.declination
  const alpha = star.rightAscension
  const H = hourAngle
  const fmtHours = (value) => formatAngle(value, 'hours', mode)
  const fmtDeg = (value) => formatAngle(value, 'degrees', mode)

  const sinTerm = Math.sin(phi * RAD) * Math.sin(delta * RAD)
  const cosTerm = Math.cos(phi * RAD) * Math.cos(delta * RAD) * Math.cos(H * RAD)
  const sinAltitude = sinTerm + cosTerm

  const azimuthY = Math.sin(H * RAD)
  const azimuthX = Math.cos(H * RAD) * Math.sin(phi * RAD) - Math.tan(delta * RAD) * Math.cos(phi * RAD)
  const azimuthFromSouth = azimuthForOrigin(horizontal.azimuth, 'south')
  const nearPole = Math.abs(Math.abs(delta) - 90) < 1e-6

  const wrapsAround = siderealTime - alpha < 0

  return (
    <ol className="steps-list">
      <Step index="1" title="Sidereal time" formula="t = GMST + λ">
        <p>t = {fmtHours(gmst)} {signedHours(observer.longitude, mode)}</p>
        <p className="step-result">t = <strong>{fmtHours(siderealTime)}</strong></p>
        <p className="step-aside">λ = {formatAngle(observer.longitude, 'longitude', mode)} ÷ 15 → time units. t is the hour angle of ♈.</p>
      </Step>

      <Step index="2" title="Right ascension → hour angle" formula="H = t − α">
        <p>H = {fmtHours(siderealTime)} − {fmtHours(alpha)}{wrapsAround ? ' + 24h' : ''}</p>
        <p className="step-result">H = <strong>{fmtHours(H)}</strong> <span className="step-aside">= {deg(H, 2)}</span></p>
      </Step>

      <Step index="3" title="Altitude" formula="sin h = sin φ · sin δ + cos φ · cos δ · cos H">
        <p>sin h = sin({deg(phi)}) · sin({deg(delta)}) + cos({deg(phi)}) · cos({deg(delta)}) · cos({deg(H, 2)})</p>
        <p>sin h = {n(sinTerm)} + {n(cosTerm)} = {n(sinAltitude)}</p>
        <p className="step-result">h = <strong>{fmtDeg(horizontal.altitude)}</strong> <span className="step-aside">{horizontal.altitude >= 0 ? 'above the horizon' : 'below the horizon'}</span></p>
      </Step>

      <Step
        index="4"
        title="Azimuth"
        formula="tan A = sin H / (cos H · sin φ − tan δ · cos φ)"
        note="The signs of numerator and denominator choose the quadrant. This formula counts from south, westward."
      >
        {nearPole ? (
          <p>The object is at a celestial pole: its azimuth equals the pole direction.</p>
        ) : (
          <p>tan A = {n(azimuthY)} / {n(azimuthX)}</p>
        )}
        <p className={azimuthOrigin === 'south' ? 'step-result' : ''}>A (from S) = {azimuthOrigin === 'south' ? <strong>{formatAngle(azimuthFromSouth, 'positive', mode)}</strong> : formatAngle(azimuthFromSouth, 'positive', mode)}</p>
        {azimuthOrigin === 'north' && (
          <p className="step-result">A (from N) = A (from S) + 180° = <strong>{formatAngle(horizontal.azimuth, 'positive', mode)}</strong></p>
        )}
      </Step>

      <Step
        index="5"
        title="On the meridian"
        formula="h = δ − φ + 90°"
        note="The slide formula holds when the star culminates south of the zenith (δ < φ). In general, h_max = 90° − |φ − δ|."
      >
        <p>h_max = 90° − |{deg(phi, 2)} − {deg(delta, 2)}|</p>
        <p className="step-result">
          Upper culmination: <strong>{fmtDeg(geometry.upperAltitude)}</strong>
          <span className="step-aside">{geometry.culmination === 'zenith' ? ' in the zenith' : ` toward the ${geometry.culmination}`}</span>
        </p>
        <p>Lower culmination: h_min = |φ + δ| − 90° = {fmtDeg(geometry.lowerAltitude)}</p>
      </Step>

      <Step index="6" title="Rising and setting" formula="cos H₀ = −tan φ · tan δ">
        {geometry.kind === 'rises' ? (
          <>
            <p>cos H₀ = −tan({deg(phi, 2)}) · tan({deg(delta, 2)}) = {n(geometry.cosine)}</p>
            <p className="step-result">H₀ = <strong>{fmtHours(geometry.semiArc)}</strong> <span className="step-aside">= {deg(geometry.semiArc, 2)}</span></p>
            <p>Above the horizon for 2H₀ = {(2 * geometry.semiArc / 15).toFixed(2)} sidereal hours.</p>
          </>
        ) : geometry.kind === 'circumpolar' ? (
          <p className="step-result"><strong>Circumpolar:</strong> |cos H₀| ≥ 1; the star never sets ({phi >= 0 ? `δ ≥ 90° − φ = ${deg(90 - phi, 2)}` : `δ ≤ −90° − φ = ${deg(-90 - phi, 2)}`}).</p>
        ) : (
          <p className="step-result"><strong>Never rises</strong> here: the whole daily circle stays below the horizon.</p>
        )}
        <p className="step-aside">Same formula as the day arc: cos D/2 = −tg φ · tg δ.</p>
      </Step>
    </ol>
  )
}
