import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  angularDistance,
  azimuthForOrigin,
  azimuthFromOrigin,
  diurnalGeometry,
  equatorialToHorizontal,
  equatorialToHorizontalAt,
  formatAngle,
  formatDms,
  formatHms,
  greenwichSiderealTime,
  horizontalToEquatorial,
  hourAngleFromRightAscension,
  localSiderealTime,
  parseAngle,
  rightAscensionFromHourAngle,
  substellarPoint,
  sunEquatorial,
  transitEvents,
  wrap180,
} from '../src/coordinates.js'

const close = (actual, expected, tolerance, message) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ''} expected ${expected}, got ${actual}`)
}
const closeAngle = (actual, expected, tolerance, message) => {
  close(wrap180(actual - expected), 0, tolerance, `${message ?? ''} expected ${expected}, got ${actual}`)
}

test('Greenwich mean sidereal time matches Meeus example 12.a and 12.b', () => {
  closeAngle(greenwichSiderealTime(Date.UTC(1987, 3, 10, 0, 0, 0)), (13 + 10 / 60 + 46.3668 / 3600) * 15, 1e-5)
  closeAngle(greenwichSiderealTime(Date.UTC(1987, 3, 10, 19, 21, 0)), 128.7378734, 1e-5)
})

test('local sidereal time adds east longitude', () => {
  const time = Date.UTC(2026, 9, 15, 19, 0, 0)
  closeAngle(localSiderealTime(time, 4.47), greenwichSiderealTime(time) + 4.47, 1e-9)
  closeAngle(localSiderealTime(time, -77), greenwichSiderealTime(time) - 77, 1e-9)
})

test('equatorial to horizontal matches Meeus example 13.b within mean-sidereal accuracy', () => {
  const observer = { latitude: 38 + 55 / 60 + 17 / 3600, longitude: -(77 + 3 / 60 + 56 / 3600) }
  const venus = { rightAscension: (23 + 9 / 60 + 16.641 / 3600) * 15, declination: -(6 + 43 / 60 + 11.61 / 3600) }
  const { azimuth, altitude } = equatorialToHorizontalAt(venus, observer, Date.UTC(1987, 3, 10, 19, 21, 0))
  close(altitude, 15.1249, 0.01, 'altitude')
  closeAngle(azimuthForOrigin(azimuth, 'south'), 68.0337, 0.01, 'azimuth from south')
})

test('meridian and cardinal directions', () => {
  const upper = equatorialToHorizontal(0, 20, 51)
  close(upper.altitude, 20 - 51 + 90, 1e-9, 'slide formula h = δ − φ + 90°')
  closeAngle(upper.azimuth, 180, 1e-9)

  const north = equatorialToHorizontal(0, 70, 51)
  close(north.altitude, 90 - (70 - 51), 1e-9)
  closeAngle(north.azimuth, 0, 1e-9)

  const west = equatorialToHorizontal(90, 0, 51)
  close(west.altitude, 0, 1e-9)
  closeAngle(west.azimuth, 270, 1e-9)

  const east = equatorialToHorizontal(270, 0, 51)
  closeAngle(east.azimuth, 90, 1e-9)

  close(equatorialToHorizontal(123, 51, 51).altitude, equatorialToHorizontal(123, 51, 51).altitude, 0)
  close(equatorialToHorizontal(0, 90, 51).altitude, 51, 1e-9, 'pole height equals latitude')
})

test('horizontal to equatorial round-trips', () => {
  for (const latitude of [-75, -33.9, 0, 28.7, 51.15, 89]) {
    for (const hourAngle of [0, 15, 97, 180, 263, 350]) {
      for (const declination of [-80, -20, 0, 38.8, 70]) {
        const horizontal = equatorialToHorizontal(hourAngle, declination, latitude)
        const equatorial = horizontalToEquatorial(horizontal.azimuth, horizontal.altitude, latitude)
        close(equatorial.declination, declination, 1e-9, `dec at φ=${latitude}, H=${hourAngle}`)
        closeAngle(equatorial.hourAngle, hourAngle, 1e-7, `H at φ=${latitude}, δ=${declination}`)
      }
    }
  }
})

test('hour angle and right ascension use H = t − α', () => {
  closeAngle(hourAngleFromRightAscension(300, 280), 20, 1e-12)
  closeAngle(hourAngleFromRightAscension(10, 350), 20, 1e-12)
  closeAngle(rightAscensionFromHourAngle(10, 20), 350, 1e-12)
})

test('azimuth origin conversion', () => {
  closeAngle(azimuthForOrigin(270, 'south'), 90, 1e-12)
  closeAngle(azimuthForOrigin(0, 'south'), 180, 1e-12)
  closeAngle(azimuthFromOrigin(90, 'south'), 270, 1e-12)
  closeAngle(azimuthFromOrigin(90, 'north'), 90, 1e-12)
})

test('diurnal geometry classifies stars and uses cos H₀ = −tan φ tan δ', () => {
  assert.equal(diurnalGeometry(60, 51.15).kind, 'circumpolar')
  assert.equal(diurnalGeometry(-60, 51.15).kind, 'never')
  const rising = diurnalGeometry(0, 51.15)
  assert.equal(rising.kind, 'rises')
  close(rising.semiArc, 90, 1e-9)
  // Circumpolar limit at Hove is 90° − 51.15° = 38.85°: Vega just sets, Deneb never does.
  assert.equal(diurnalGeometry(38.78, 51.15).kind, 'rises')
  assert.equal(diurnalGeometry(45.28, 51.15).kind, 'circumpolar')
  const sirius = diurnalGeometry(-16.72, 51.15)
  close(Math.cos(sirius.semiArc * Math.PI / 180), -Math.tan(51.15 * Math.PI / 180) * Math.tan(-16.72 * Math.PI / 180), 1e-12)
  assert.equal(diurnalGeometry(10, 90).kind, 'circumpolar')
  assert.equal(diurnalGeometry(-10, 90).kind, 'never')
})

test('transit and rise/set events place the star on the meridian and horizon', () => {
  const observer = { latitude: 51.15, longitude: 4.47 }
  const star = { rightAscension: 101.287, declination: -16.716 }
  const time = Date.UTC(2026, 9, 15, 19, 0, 0)
  const events = transitEvents(time, star, observer)
  assert.ok(Math.abs(events.transit - time) <= 12.1 * 3600000)
  closeAngle(equatorialToHorizontalAt(star, observer, events.transit).azimuth, 180, 1e-4)
  close(equatorialToHorizontalAt(star, observer, events.rise).altitude, 0, 1e-4)
  close(equatorialToHorizontalAt(star, observer, events.set).altitude, 0, 1e-4)
})

test('substellar point is 90° − h from the observer', () => {
  const observer = { latitude: 51.15, longitude: 4.47 }
  const star = { rightAscension: 279.234, declination: 38.784 }
  const time = Date.UTC(2026, 9, 15, 19, 0, 0)
  const point = substellarPoint(time, star)
  const { altitude } = equatorialToHorizontalAt(star, observer, time)
  close(angularDistance(observer.latitude, observer.longitude, point.latitude, point.longitude), 90 - altitude, 1e-9)
})

test('low-precision Sun is near the equinox in March', () => {
  const sun = sunEquatorial(Date.UTC(2026, 2, 20, 14, 46))
  close(sun.declination, 0, 0.05)
  closeAngle(sun.rightAscension, 0, 0.1)
})

test('sexagesimal formatting carries rounding', () => {
  assert.equal(formatHms(83.6333), '05h 34m 32s')
  assert.equal(formatHms(359.99999), '00h 00m 00s')
  assert.equal(formatDms(22.01444), '+22° 00′ 52″')
  assert.equal(formatDms(-16.716), '−16° 42′ 58″')
  assert.equal(formatDms(-0.00001), '+00° 00′ 00″')
  assert.equal(formatAngle(51.15, 'latitude'), '51° 09′ 00″ N')
  assert.equal(formatAngle(-77.5, 'longitude', 'decimal'), '77.500° W')
  assert.equal(formatAngle(400, 'positive'), '040° 00′ 00″')
})

test('angle parsing accepts decimal, sexagesimal and Dutch hemisphere notation', () => {
  close(parseAngle('5h34m32s', 'hours'), 83.6333333, 1e-6)
  close(parseAngle('5 34 32', 'hours'), 83.6333333, 1e-6)
  close(parseAngle('5:34:32', 'hours'), 83.6333333, 1e-6)
  close(parseAngle('5.5', 'hours'), 82.5, 1e-12)
  close(parseAngle('82.5°', 'hours'), 82.5, 1e-12)
  close(parseAngle('+22°00\'52"', 'degrees'), 22.0144444, 1e-6)
  close(parseAngle('-16 42 58', 'degrees'), -16.7161111, 1e-6)
  close(parseAngle('−16° 42′ 58″', 'degrees'), -16.7161111, 1e-6)
  close(parseAngle('51,15', 'latitude'), 51.15, 1e-12)
  close(parseAngle("51°09' NB", 'latitude'), 51.15, 1e-12)
  close(parseAngle('33 52 S', 'latitude'), -33.8666667, 1e-6)
  close(parseAngle("4°28' OL", 'longitude'), 4.4666667, 1e-6)
  close(parseAngle('77.5 W', 'longitude'), -77.5, 1e-12)
  assert.equal(parseAngle('', 'degrees'), null)
  assert.equal(parseAngle('abc', 'degrees'), null)
  assert.equal(parseAngle('10 75', 'degrees'), null)
  assert.equal(parseAngle('10.5 30', 'degrees'), null)
  assert.equal(parseAngle('10 N', 'degrees'), null)
})
