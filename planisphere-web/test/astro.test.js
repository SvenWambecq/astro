import test from 'node:test'
import assert from 'node:assert/strict'
import { Equator, Horizon, Illumination, Observer } from 'astronomy-engine'
import { altitude, diskRotation, horizontalToEquatorial, sidereal, horizonPoints, project, dateFields, dateFromFields, ofDate, RAD, separation, minutesForRotation, planetPositions } from '../src/astro.js'

const date = new Date('2026-10-23T20:00:00Z')

test('All seven planets use observer-specific equatorial coordinates of date and current magnitudes', () => {
  for (const latitude of [-90, -34, 0, 51, 90]) {
    for (const timestamp of ['1900-01-01T00:00:00Z', date, '2100-12-31T23:59:00Z']) {
      const instant = new Date(timestamp)
      const longitude = 4.47
      const observer = new Observer(latitude, longitude, 0)
      const planets = planetPositions(instant, latitude, longitude)
      assert.equal(planets.length, 7)
      assert.equal(new Set(planets.map((planet) => planet.id)).size, 7)
      assert.ok(!planets.some((planet) => planet.name === 'Earth'))
      for (const planet of planets) {
        const expected = Equator(planet.name, instant, observer, true, true)
        assert.ok(planet.ra >= 0 && planet.ra < 360)
        assert.ok(Math.abs(planet.ra - expected.ra * 15) < 1e-9)
        assert.equal(planet.dec, expected.dec)
        assert.ok(Number.isFinite(planet.mag))
        assert.equal(planet.mag, Illumination(planet.name, instant).mag)
        const horizon = Horizon(instant, observer, expected.ra, expected.dec)
        assert.ok(Math.abs(altitude(planet.ra, planet.dec, latitude, sidereal(instant, longitude)) - horizon.altitude) < 1e-6)
      }
    }
  }
})

test('Planets move against the star field as the selected date advances', () => {
  const later = new Date('2026-11-23T20:00:00Z')
  const first = planetPositions(date, 51.15, 4.47)
  const second = planetPositions(later, 51.15, 4.47)
  const star = { ra: 68.98, dec: 16.51 }
  const firstStar = ofDate(star.ra, star.dec, date)
  const secondStar = ofDate(star.ra, star.dec, later)
  assert.ok(separation(firstStar, secondStar) < 0.01)
  for (const [index, planet] of first.entries()) {
    assert.ok(separation(planet, second[index]) > 0.01, `${planet.name} must move relative to the stars`)
  }
  assert.ok(Math.abs(separation(first[2], firstStar) - separation(second[2], secondStar)) > 1)
})

for (const latitude of [-90, -51, -0.01, 0, 0.01, 51, 90]) {
  test(`Horizon and altitude agree with Astronomy Engine at latitude ${latitude}`, () => {
    const longitude = 4.47
    const lst = sidereal(date, longitude)
    const observer = new Observer(latitude, longitude, 0)
    for (let azimuth = 0.1; azimuth < 360; azimuth += 17) {
      for (const height of [0, 25, 70]) {
        const equatorial = horizontalToEquatorial(azimuth, height, latitude, lst)
        const actual = Horizon(date, observer, equatorial.ra / 15, equatorial.dec)
        assert.ok(Math.abs(actual.altitude - height) < 1e-6)
        assert.ok(Math.abs(altitude(equatorial.ra, equatorial.dec, latitude, lst) - height) < 1e-6)
      }
    }
    assert.ok(horizonPoints(latitude).every((point) => point.every(Number.isFinite)))
  })
}

test('Poles, meridian and east have consistent sky-facing projection', () => {
  assert.equal(Math.hypot(...project(0, 90, 51)), 0)
  assert.ok(project(0, 0, 51)[1] > 0)
  assert.ok(project(90, 0, 51)[0] < 0)
  assert.ok(project(0, 0, -51)[1] < 0)
  assert.ok(project(90, 0, -51)[0] < 0)
})

test('SVG disk rotation equals direct projection in both hemispheres', () => {
  for (const latitude of [-90, -51, 0, 51, 90]) {
    for (const lst of [0, 43, 190, 359]) {
      const point = project(123, -15, latitude)
      const angle = diskRotation(lst, latitude) * RAD
      const rotated = [point[0] * Math.cos(angle) - point[1] * Math.sin(angle), point[0] * Math.sin(angle) + point[1] * Math.cos(angle)]
      const direct = project(123, -15, latitude, lst)
      assert.ok(Math.hypot(rotated[0] - direct[0], rotated[1] - direct[1]) < 1e-9)
    }
  }
})

test('Explicit UTC offsets round-trip across dates and fractional zones', () => {
  for (const offset of [-12, -3.5, 0, 2, 5.75, 14]) {
    const fields = dateFields(date, offset)
    assert.equal(dateFromFields(fields.day, fields.clock, offset).toISOString(), date.toISOString())
  }
  assert.equal(dateFromFields('2026-01-01', '00:30', 2).toISOString(), '2025-12-31T22:30:00.000Z')
})

test('Precession preserves separation and angular wrap', () => {
  const first = { ra: 359, dec: 40 }
  const second = { ra: 1, dec: 40 }
  assert.ok(separation(first, second) < 2)
  assert.ok(Math.abs(separation(ofDate(first.ra, first.dec, date), ofDate(second.ra, second.dec, date)) - separation(first, second)) < 1e-9)
})

test('Disk rotation follows a sidereal day in either hemisphere', () => {
  assert.ok(Math.abs(minutesForRotation(360, 51) + 1436.068175) < 1e-6)
  assert.equal(minutesForRotation(15, -51), -minutesForRotation(15, 51))
})

test('Actual horizon polygon includes visible stars and excludes hidden stars, even at the equator', () => {
  function contains(polygon, point) {
    let inside = false
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
      const currentPoint = polygon[index]
      const previousPoint = polygon[previous]
      if ((currentPoint[1] > point[1]) !== (previousPoint[1] > point[1]) && point[0] < (previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1]) / (previousPoint[1] - currentPoint[1]) + currentPoint[0]) inside = !inside
    }
    return inside
  }
  for (const latitude of [-90, -51, -0.01, 0, 0.01, 51, 90]) {
    const polygon = horizonPoints(latitude)
    for (let ra = 3; ra < 360; ra += 13) {
      for (let dec = -85; dec < 90; dec += 10) {
        const height = altitude(ra, dec, latitude, 0)
        if (Math.abs(height) < 2) continue
        assert.equal(contains(polygon, project(ra, dec, latitude)), height > 0, `latitude ${latitude}, RA ${ra}, dec ${dec}, altitude ${height}`)
      }
    }
  }
})