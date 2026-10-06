export const OBLIQUITY_DEG = 23.43928
export const YEAR_DAYS = 365.2422
export const RAD = Math.PI / 180

export function dayOfYear(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number)
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000) + 1
}

export function dateFromDayOfYear(year, ordinal) {
  const date = new Date(Date.UTC(year, 0, ordinal))
  return date.toISOString().slice(0, 10)
}

export function daysInYear(year) {
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000
}

export function solarDeclination(dateValue) {
  const ordinal = dayOfYear(dateValue)
  const longitude = 2 * Math.PI * (ordinal - 80) / YEAR_DAYS
  const obliquity = OBLIQUITY_DEG * RAD
  return Math.asin(Math.sin(obliquity) * Math.sin(longitude))
}

export function daylightGeometry(latitudeDeg, declinationRad) {
  const latitude = latitudeDeg * RAD
  const cosLatitude = Math.cos(latitude)

  if (Math.abs(cosLatitude) < 1e-10) {
    if (Math.abs(declinationRad) < 1e-10) {
      return { hours: 12, hourAngle: Math.PI / 2, sunrise: 6, sunset: 18 }
    }
    const isPolarDay = Math.sign(latitudeDeg) === Math.sign(declinationRad)
    return isPolarDay
      ? { hours: 24, hourAngle: null, sunrise: null, sunset: null }
      : { hours: 0, hourAngle: null, sunrise: null, sunset: null }
  }

  const cosineHourAngle = -Math.tan(latitude) * Math.tan(declinationRad)
  if (cosineHourAngle <= -1) {
    return { hours: 24, hourAngle: null, sunrise: null, sunset: null }
  }
  if (cosineHourAngle >= 1) {
    return { hours: 0, hourAngle: null, sunrise: null, sunset: null }
  }

  const hourAngle = Math.acos(cosineHourAngle)
  const hours = 24 * hourAngle / Math.PI
  return {
    hours,
    hourAngle,
    sunrise: 12 - hours / 2,
    sunset: 12 + hours / 2,
  }
}

export function solarPosition(latitudeDeg, declinationRad, solarHour) {
  const latitude = latitudeDeg * RAD
  const hourAngle = (solarHour - 12) * 15 * RAD
  return {
    east: -Math.cos(declinationRad) * Math.sin(hourAngle),
    north: Math.cos(latitude) * Math.sin(declinationRad)
      - Math.sin(latitude) * Math.cos(declinationRad) * Math.cos(hourAngle),
    up: Math.sin(latitude) * Math.sin(declinationRad)
      + Math.cos(latitude) * Math.cos(declinationRad) * Math.cos(hourAngle),
  }
}

export function solarAltitude(latitudeDeg, declinationRad, solarHour) {
  const { up } = solarPosition(latitudeDeg, declinationRad, solarHour)
  return Math.asin(Math.max(-1, Math.min(1, up))) / RAD
}

export function formatAngle(degrees, digits = 1) {
  return `${degrees >= 0 ? '+' : ''}${degrees.toFixed(digits)}°`
}