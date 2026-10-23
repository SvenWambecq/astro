import { SiderealTime, Rotation_EQJ_EQD, RotateVector, VectorFromSphere, Spherical, EquatorFromVector, Observer, Equator, Horizon, Illumination } from 'astronomy-engine'

export const RAD = Math.PI / 180
export const normalize = (angle) => ((angle % 360) + 360) % 360
export const hemisphere = (latitude) => latitude < 0 ? -1 : 1
export const sidereal = (date, longitude) => normalize(SiderealTime(date) * 15 + longitude)
export const diskRotation = (lst, latitude) => -hemisphere(latitude) * lst

export function project(ra, dec, latitude, lst = 0, radius = 300) {
  const pole = hemisphere(latitude)
  const distance = (90 - pole * dec) / (180 - Math.abs(latitude)) * radius
  const angle = (ra - lst) * RAD
  return [-distance * Math.sin(angle), pole * distance * Math.cos(angle)]
}

export function horizontalToEquatorial(azimuth, altitude, latitude, lst = 0) {
  const az = azimuth * RAD
  const alt = altitude * RAD
  const lat = latitude * RAD
  const dec = Math.asin(Math.max(-1, Math.min(1, Math.sin(lat) * Math.sin(alt) + Math.cos(lat) * Math.cos(alt) * Math.cos(az)))) / RAD
  const hourAngle = Math.atan2(-Math.cos(alt) * Math.sin(az), Math.cos(lat) * Math.sin(alt) - Math.sin(lat) * Math.cos(alt) * Math.cos(az)) / RAD
  return { ra: normalize(lst - hourAngle), dec }
}

export function altitude(ra, dec, latitude, lst) {
  const sine = Math.sin(latitude * RAD) * Math.sin(dec * RAD) + Math.cos(latitude * RAD) * Math.cos(dec * RAD) * Math.cos((lst - ra) * RAD)
  return Math.asin(Math.max(-1, Math.min(1, sine))) / RAD
}

export function horizonPoints(latitude, elevation = 0) {
  if (elevation === 0) {
    if (latitude === 0) {
      return Array.from({ length: 361 }, (_, index) => project(90 - index / 2, -90, latitude))
    }
    return Array.from({ length: 721 }, (_, index) => {
      const ra = index / 2
      const dec = Math.atan(-Math.cos(latitude * RAD) * Math.cos(ra * RAD) / Math.sin(latitude * RAD)) / RAD
      return project(ra, dec, latitude)
    })
  }
  return Array.from({ length: 721 }, (_, index) => {
    const equatorial = horizontalToEquatorial(index * 0.5 + 0.001, elevation, latitude)
    return project(equatorial.ra, equatorial.dec, latitude)
  })
}

export const pathFromPoints = (points, closed = false) => points.map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(3)},${point[1].toFixed(3)}`).join(' ') + (closed ? ' Z' : '')

export function ofDate(ra, dec, date, rotation = Rotation_EQJ_EQD(date)) {
  const equatorial = EquatorFromVector(RotateVector(rotation, VectorFromSphere(new Spherical(dec, ra, 1), date)))
  return { ra: equatorial.ra * 15, dec: equatorial.dec }
}

export function separation(first, second) {
  const cosine = Math.sin(first.dec * RAD) * Math.sin(second.dec * RAD) + Math.cos(first.dec * RAD) * Math.cos(second.dec * RAD) * Math.cos((first.ra - second.ra) * RAD)
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / RAD
}

export function dateFromFields(day, clock, offset) {
  const date = new Date(`${day}T${clock}:00Z`)
  return new Date(date.getTime() - offset * 3600000)
}

export function dateFields(date, offset) {
  const text = new Date(date.getTime() + offset * 3600000).toISOString()
  return { day: text.slice(0, 10), clock: text.slice(11, 16) }
}

export function skyCondition(date, latitude, longitude) {
  const observer = new Observer(latitude, longitude, 0)
  const sun = Equator('Sun', date, observer, true, true)
  const height = Horizon(date, observer, sun.ra, sun.dec).altitude
  return { altitude: height, label: height >= 0 ? 'Daylight' : height > -6 ? 'Civil twilight' : height > -12 ? 'Nautical twilight' : height > -18 ? 'Astronomical twilight' : 'Dark sky' }
}

export function planetPositions(date, latitude, longitude) {
  const observer = new Observer(latitude, longitude, 0)
  return [
    { name: 'Mercury', color: '#d6c9b9' },
    { name: 'Venus', color: '#fff0b3' },
    { name: 'Mars', color: '#ff9c79' },
    { name: 'Jupiter', color: '#f5d2a1' },
    { name: 'Saturn', color: '#e8d794' },
    { name: 'Uranus', color: '#99e1da' },
    { name: 'Neptune', color: '#9bbdff' },
  ].map((planet) => {
    const equatorial = Equator(planet.name, date, observer, true, true)
    return {
      ...planet,
      id: `planet-${planet.name.toLowerCase()}`,
      designation: planet.name,
      type: 'Planet',
      ra: normalize(equatorial.ra * 15),
      dec: equatorial.dec,
      mag: Illumination(planet.name, date).mag,
    }
  })
}

export function dateRingAngle(date, longitude) {
  const midnight = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  return sidereal(midnight, longitude)
}

export const minutesForRotation = (degrees, latitude) => -degrees * hemisphere(latitude) / 360 * 86164.0905 / 60