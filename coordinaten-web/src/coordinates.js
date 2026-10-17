export const RAD = Math.PI / 180
export const DEG = 180 / Math.PI
export const SIDEREAL_TO_SOLAR = 0.9972695663
export const SIDEREAL_DAY_MS = 86400000 * SIDEREAL_TO_SOLAR
const HOUR_MS = 3600000

export function wrap360(degrees) {
  return ((degrees % 360) + 360) % 360
}

export function wrap180(degrees) {
  return wrap360(degrees + 180) - 180
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function julianDate(timeMs) {
  return timeMs / 86400000 + 2440587.5
}

// Mean sidereal time (IAU 1982); nutation is omitted.
export function greenwichSiderealTime(timeMs) {
  const days = julianDate(timeMs) - 2451545.0
  const centuries = days / 36525
  return wrap360(
    280.46061837
    + 360.98564736629 * days
    + 0.000387933 * centuries ** 2
    - centuries ** 3 / 38710000,
  )
}

export function localSiderealTime(timeMs, longitudeDeg) {
  return wrap360(greenwichSiderealTime(timeMs) + longitudeDeg)
}

export function hourAngleFromRightAscension(siderealDeg, rightAscensionDeg) {
  return wrap360(siderealDeg - rightAscensionDeg)
}

export function rightAscensionFromHourAngle(siderealDeg, hourAngleDeg) {
  return wrap360(siderealDeg - hourAngleDeg)
}

/** Unit vector in the observer's east-north-up frame for an hour angle and declination. */
export function equatorialVector(hourAngleDeg, declinationDeg, latitudeDeg) {
  const hourAngle = hourAngleDeg * RAD
  const declination = declinationDeg * RAD
  const latitude = latitudeDeg * RAD
  return {
    east: -Math.cos(declination) * Math.sin(hourAngle),
    north: Math.sin(declination) * Math.cos(latitude)
      - Math.cos(declination) * Math.cos(hourAngle) * Math.sin(latitude),
    up: Math.sin(declination) * Math.sin(latitude)
      + Math.cos(declination) * Math.cos(hourAngle) * Math.cos(latitude),
  }
}

/** Unit vector in the observer's east-north-up frame; azimuth counts from north through east. */
export function horizontalVector(azimuthDeg, altitudeDeg) {
  const azimuth = azimuthDeg * RAD
  const altitude = altitudeDeg * RAD
  return {
    east: Math.cos(altitude) * Math.sin(azimuth),
    north: Math.cos(altitude) * Math.cos(azimuth),
    up: Math.sin(altitude),
  }
}

export function horizontalFromVector({ east, north, up }) {
  const length = Math.hypot(east, north, up) || 1
  const altitude = Math.asin(clamp(up / length, -1, 1)) * DEG
  const azimuth = Math.hypot(east, north) < 1e-12 ? 0 : wrap360(Math.atan2(east, north) * DEG)
  return { azimuth, altitude }
}

/** Returns the azimuth from north through east, plus altitude. */
export function equatorialToHorizontal(hourAngleDeg, declinationDeg, latitudeDeg) {
  return horizontalFromVector(equatorialVector(hourAngleDeg, declinationDeg, latitudeDeg))
}

/** Expects an azimuth from north through east. */
export function horizontalToEquatorial(azimuthDeg, altitudeDeg, latitudeDeg) {
  const { east, north, up } = horizontalVector(azimuthDeg, altitudeDeg)
  const latitude = latitudeDeg * RAD
  const sinDeclination = north * Math.cos(latitude) + up * Math.sin(latitude)
  const towardMeridian = up * Math.cos(latitude) - north * Math.sin(latitude)
  const declination = Math.asin(clamp(sinDeclination, -1, 1)) * DEG
  const hourAngle = Math.hypot(east, towardMeridian) < 1e-12
    ? 0
    : wrap360(Math.atan2(-east, towardMeridian) * DEG)
  return { hourAngle, declination }
}

/** Converts a north-based azimuth to the chosen origin; both conventions run N → E → S → W. */
export function azimuthForOrigin(azimuthFromNorthDeg, origin) {
  return origin === 'south' ? wrap360(azimuthFromNorthDeg - 180) : wrap360(azimuthFromNorthDeg)
}

export function azimuthFromOrigin(azimuthDeg, origin) {
  return origin === 'south' ? wrap360(azimuthDeg + 180) : wrap360(azimuthDeg)
}

export function equatorialToHorizontalAt(star, observer, timeMs) {
  const sidereal = localSiderealTime(timeMs, observer.longitude)
  const hourAngle = hourAngleFromRightAscension(sidereal, star.rightAscension)
  return equatorialToHorizontal(hourAngle, star.declination, observer.latitude)
}

/** Ideal horizon (altitude 0°): no refraction, no apparent size. */
export function diurnalGeometry(declinationDeg, latitudeDeg) {
  const upperAltitude = 90 - Math.abs(latitudeDeg - declinationDeg)
  const lowerAltitude = Math.abs(latitudeDeg + declinationDeg) - 90
  const culmination = Math.abs(latitudeDeg - declinationDeg) < 1e-9
    ? 'zenith'
    : declinationDeg < latitudeDeg ? 'south' : 'north'

  if (lowerAltitude >= 0) {
    return { kind: 'circumpolar', semiArc: 180, upperAltitude, lowerAltitude, culmination }
  }
  if (upperAltitude < 0) {
    return { kind: 'never', semiArc: 0, upperAltitude, lowerAltitude, culmination }
  }

  const cosine = -Math.tan(latitudeDeg * RAD) * Math.tan(declinationDeg * RAD)
  const semiArc = Math.acos(clamp(cosine, -1, 1)) * DEG
  return { kind: 'rises', semiArc, upperAltitude, lowerAltitude, culmination, cosine }
}

/** The upper transit closest to timeMs, with the rising and setting around it. */
export function transitEvents(timeMs, star, observer) {
  const sidereal = localSiderealTime(timeMs, observer.longitude)
  const degreesUntilTransit = wrap180(star.rightAscension - sidereal)
  const transit = timeMs + degreesUntilTransit / 15 * HOUR_MS * SIDEREAL_TO_SOLAR
  const geometry = diurnalGeometry(star.declination, observer.latitude)
  const halfArcMs = geometry.semiArc / 15 * HOUR_MS * SIDEREAL_TO_SOLAR
  return {
    ...geometry,
    transit,
    rise: geometry.kind === 'rises' ? transit - halfArcMs : null,
    set: geometry.kind === 'rises' ? transit + halfArcMs : null,
    hoursAbove: 2 * geometry.semiArc / 15 * SIDEREAL_TO_SOLAR,
  }
}

/** Point on Earth where the object stands in the zenith. */
export function substellarPoint(timeMs, star) {
  return {
    latitude: star.declination,
    longitude: wrap180(star.rightAscension - greenwichSiderealTime(timeMs)),
  }
}

export function angularDistance(latitudeA, longitudeA, latitudeB, longitudeB) {
  const a = latitudeA * RAD
  const b = latitudeB * RAD
  const deltaLongitude = (longitudeB - longitudeA) * RAD
  const cosine = Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.cos(b) * Math.cos(deltaLongitude)
  return Math.acos(clamp(cosine, -1, 1)) * DEG
}

// Low-precision solar position (about 0.01°), good enough for twilight shading.
export function sunEquatorial(timeMs) {
  const days = julianDate(timeMs) - 2451545.0
  const meanLongitude = 280.46 + 0.9856474 * days
  const meanAnomaly = (357.528 + 0.9856003 * days) * RAD
  const longitude = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD
  const obliquity = (23.439 - 0.0000004 * days) * RAD
  return {
    rightAscension: wrap360(Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude)) * DEG),
    declination: Math.asin(Math.sin(obliquity) * Math.sin(longitude)) * DEG,
  }
}

export function sunAltitude(timeMs, observer) {
  return equatorialToHorizontalAt(sunEquatorial(timeMs), observer, timeMs).altitude
}

export function skyCondition(sunAltitudeDeg) {
  if (sunAltitudeDeg > 0) return 'day'
  if (sunAltitudeDeg > -6) return 'civil'
  if (sunAltitudeDeg > -12) return 'nautical'
  if (sunAltitudeDeg > -18) return 'astronomical'
  return 'night'
}

function splitSexagesimal(value, decimals) {
  const scale = 10 ** decimals
  let units = Math.round(Math.abs(value) * 3600 * scale)
  const whole = Math.floor(units / (3600 * scale))
  units -= whole * 3600 * scale
  const minutes = Math.floor(units / (60 * scale))
  const seconds = (units - minutes * 60 * scale) / scale
  return { negative: value < 0 && (whole > 0 || minutes > 0 || seconds > 0), whole, minutes, seconds }
}

const pad = (value, width = 2) => String(value).padStart(width, '0')
const padSeconds = (seconds, decimals) => seconds.toFixed(decimals).padStart(decimals ? 3 + decimals : 2, '0')

export function formatHms(degrees, decimals = 0) {
  const { whole, minutes, seconds } = splitSexagesimal(wrap360(degrees) / 15, decimals)
  return `${pad(whole % 24)}h ${pad(minutes)}m ${padSeconds(seconds, decimals)}s`
}

export function formatDms(degrees, { signed = true, decimals = 0, wholeWidth = 2 } = {}) {
  const { negative, whole, minutes, seconds } = splitSexagesimal(degrees, decimals)
  const sign = negative ? '−' : signed ? '+' : ''
  return `${sign}${pad(whole, wholeWidth)}° ${pad(minutes)}′ ${padSeconds(seconds, decimals)}″`
}

export function formatDecimalDegrees(degrees, { signed = true, digits = 3 } = {}) {
  const fixed = Math.abs(degrees).toFixed(digits)
  const isZero = Number(fixed) === 0
  const sign = degrees < 0 && !isZero ? '−' : signed ? '+' : ''
  return `${sign}${fixed}°`
}

export function formatDecimalHours(degrees, digits = 4) {
  return `${(wrap360(degrees) / 15).toFixed(digits)}h`
}

/**
 * kind: 'hours' (0h–24h), 'degrees' (signed), 'positive' (0°–360°), 'latitude', 'longitude'.
 * mode: 'sexagesimal' or 'decimal'.
 */
export function formatAngle(degrees, kind, mode = 'sexagesimal') {
  if (kind === 'hours') return mode === 'decimal' ? formatDecimalHours(degrees) : formatHms(degrees)
  if (kind === 'positive') {
    const wrapped = wrap360(degrees)
    return mode === 'decimal'
      ? formatDecimalDegrees(wrapped, { signed: false })
      : formatDms(wrapped, { signed: false, wholeWidth: 3 })
  }
  if (kind === 'latitude' || kind === 'longitude') {
    const suffix = kind === 'latitude' ? (degrees < 0 ? 'S' : 'N') : (degrees < 0 ? 'W' : 'E')
    const magnitude = Math.abs(degrees)
    const text = mode === 'decimal'
      ? formatDecimalDegrees(magnitude, { signed: false })
      : formatDms(magnitude, { signed: false, wholeWidth: kind === 'longitude' ? 3 : 2 })
    return `${text} ${suffix}`
  }
  return mode === 'decimal' ? formatDecimalDegrees(degrees) : formatDms(degrees)
}

const SUFFIXES = {
  latitude: [['NB', 1], ['ZB', -1], ['N', 1], ['S', -1], ['Z', -1]],
  longitude: [['OL', 1], ['WL', -1], ['E', 1], ['O', 1], ['W', -1]],
}

/**
 * Parses decimal or sexagesimal input and returns degrees, or null when invalid.
 * Accepts e.g. "5h34m32s", "5 34 32", "5:34:32", "+22°00'52\"", "51,15", "4°28' OL".
 * For kind 'hours', plain numbers are hours unless a degree sign is present.
 */
export function parseAngle(text, kind = 'degrees') {
  if (typeof text !== 'string') return null
  let value = text.trim().toUpperCase().replace(/[−–]/g, '-').replace(/,/g, '.')
  if (!value) return null

  let sign = 1
  for (const [suffix, factor] of SUFFIXES[kind] ?? []) {
    if (value.endsWith(suffix)) {
      sign = factor
      value = value.slice(0, -suffix.length).trim()
      break
    }
  }

  const signMatch = value.match(/^([+-])\s*/)
  if (signMatch) {
    if (signMatch[1] === '-') sign *= -1
    value = value.slice(signMatch[0].length)
  }

  const hasDegreeSign = value.includes('°')
  const marks = kind === 'hours' ? /[°'′"″:HMS]/g : /[°'′"″:]/g
  const body = value.replace(marks, ' ').trim()
  if (!/^(\d+\.?\d*|\.\d+)(\s+(\d+\.?\d*|\.\d+)){0,2}$/.test(body)) return null

  const parts = body.split(/\s+/).map(Number)
  if (parts.slice(0, -1).some((part) => !Number.isInteger(part))) return null
  if (parts.slice(1).some((part) => part >= 60)) return null

  const magnitude = parts.reduce((total, part, index) => total + part / 60 ** index, 0)
  const degrees = kind === 'hours' && !hasDegreeSign ? magnitude * 15 : magnitude
  return sign * degrees
}
