import starCatalog from '../public/data/stars.6.json'
import starNames from '../public/data/starnames.json'
import constellationLines from '../public/data/constellations.lines.json'

export const LOCATIONS = [
  { name: 'Hove, Belgium', latitude: 51.15, longitude: 4.47 },
  { name: 'Greenwich, United Kingdom', latitude: 51.477, longitude: 0 },
  { name: 'La Palma, Spain', latitude: 28.76, longitude: -17.89 },
  { name: 'Quito, Ecuador', latitude: -0.18, longitude: -78.47 },
  { name: 'Cape Town, South Africa', latitude: -33.92, longitude: 18.42 },
  { name: 'Sydney, Australia', latitude: -33.87, longitude: 151.21 },
  { name: 'North Pole', latitude: 90, longitude: 0 },
  { name: 'South Pole', latitude: -90, longitude: 0 },
]

export const TARGETS = [
  { id: 'm31', name: 'Andromeda Galaxy', designation: 'M31', type: 'Galaxy', ra: 10.6847, dec: 41.269, mag: 3.4 },
  { id: 'm42', name: 'Orion Nebula', designation: 'M42', type: 'Nebula', ra: 83.822, dec: -5.391, mag: 4.0 },
  { id: 'm45', name: 'Pleiades', designation: 'M45', type: 'Open cluster', ra: 56.75, dec: 24.117, mag: 1.6 },
  { id: 'm13', name: 'Hercules Cluster', designation: 'M13', type: 'Globular cluster', ra: 250.423, dec: 36.461, mag: 5.8 },
  { id: 'm57', name: 'Ring Nebula', designation: 'M57', type: 'Planetary nebula', ra: 283.396, dec: 33.029, mag: 8.8 },
  { id: 'm27', name: 'Dumbbell Nebula', designation: 'M27', type: 'Planetary nebula', ra: 299.902, dec: 22.721, mag: 7.4 },
  { id: 'm81', name: "Bode's Galaxy", designation: 'M81', type: 'Galaxy', ra: 148.888, dec: 69.065, mag: 6.9 },
  { id: 'm51', name: 'Whirlpool Galaxy', designation: 'M51', type: 'Galaxy', ra: 202.47, dec: 47.195, mag: 8.4 },
  { id: 'ngc869', name: 'Double Cluster', designation: 'NGC 869', type: 'Open cluster', ra: 34.75, dec: 57.133, mag: 3.7 },
  { id: 'm44', name: 'Beehive Cluster', designation: 'M44', type: 'Open cluster', ra: 130.1, dec: 19.667, mag: 3.7 },
  { id: 'm8', name: 'Lagoon Nebula', designation: 'M8', type: 'Nebula', ra: 270.925, dec: -24.38, mag: 6.0 },
  { id: 'ngc5139', name: 'Omega Centauri', designation: 'NGC 5139', type: 'Globular cluster', ra: 201.697, dec: -47.479, mag: 3.9 },
  { id: 'ngc104', name: '47 Tucanae', designation: 'NGC 104', type: 'Globular cluster', ra: 6.024, dec: -72.081, mag: 4.1 },
  { id: 'ngc3372', name: 'Carina Nebula', designation: 'NGC 3372', type: 'Nebula', ra: 161.265, dec: -59.685, mag: 1.0 },
]

export async function loadCatalog(signal) {
  signal?.throwIfAborted()
  return {
    stars: starCatalog.features.map((star) => ({
      id: String(star.id), ra: star.geometry.coordinates[0], dec: star.geometry.coordinates[1],
      mag: star.properties.mag, color: Number(star.properties.bv),
      name: starNames[star.id]?.name || '', designation: starNames[star.id]?.desig || `HIP ${star.id}`, constellation: starNames[star.id]?.c || '', type: 'Star',
    })),
    lines: constellationLines.features,
  }
}