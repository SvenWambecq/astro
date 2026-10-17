const hms = (hours, minutes, seconds) => (hours + minutes / 60 + seconds / 3600) * 15
const dms = (degrees, minutes, seconds) => Math.sign(degrees || 1) * (Math.abs(degrees) + minutes / 60 + seconds / 3600)

// J2000.0 catalogue positions.
export const STARS = [
  { id: 'vega', name: 'Vega', constellation: 'Lyra', rightAscension: hms(18, 36, 56.3), declination: dms(38, 47, 1) },
  { id: 'polaris', name: 'Polaris', constellation: 'Ursa Minor', rightAscension: hms(2, 31, 49.1), declination: dms(89, 15, 51) },
  { id: 'deneb', name: 'Deneb', constellation: 'Cygnus', rightAscension: hms(20, 41, 25.9), declination: dms(45, 16, 49) },
  { id: 'altair', name: 'Altair', constellation: 'Aquila', rightAscension: hms(19, 50, 47), declination: dms(8, 52, 6) },
  { id: 'capella', name: 'Capella', constellation: 'Auriga', rightAscension: hms(5, 16, 41.4), declination: dms(45, 59, 53) },
  { id: 'arcturus', name: 'Arcturus', constellation: 'Boötes', rightAscension: hms(14, 15, 39.7), declination: dms(19, 10, 57) },
  { id: 'aldebaran', name: 'Aldebaran', constellation: 'Taurus', rightAscension: hms(4, 35, 55.2), declination: dms(16, 30, 33) },
  { id: 'betelgeuse', name: 'Betelgeuse', constellation: 'Orion', rightAscension: hms(5, 55, 10.3), declination: dms(7, 24, 25) },
  { id: 'rigel', name: 'Rigel', constellation: 'Orion', rightAscension: hms(5, 14, 32.3), declination: dms(-8, 12, 6) },
  { id: 'sirius', name: 'Sirius', constellation: 'Canis Major', rightAscension: hms(6, 45, 8.9), declination: dms(-16, 42, 58) },
  { id: 'spica', name: 'Spica', constellation: 'Virgo', rightAscension: hms(13, 25, 11.6), declination: dms(-11, 9, 41) },
  { id: 'antares', name: 'Antares', constellation: 'Scorpius', rightAscension: hms(16, 29, 24.5), declination: dms(-26, 25, 55) },
  { id: 'fomalhaut', name: 'Fomalhaut', constellation: 'Piscis Austrinus', rightAscension: hms(22, 57, 39), declination: dms(-29, 37, 20) },
  { id: 'm31', name: 'M31', constellation: 'Andromeda galaxy', rightAscension: hms(0, 42, 44.3), declination: dms(41, 16, 9) },
  { id: 'm101', name: 'M101', constellation: 'Pinwheel galaxy · Ursa Major', rightAscension: hms(14, 3, 12.6), declination: dms(54, 20, 56) },
  { id: 'vernal', name: 'Vernal equinox ♈', constellation: 'Reference point: α = 0h, δ = 0°', rightAscension: 0, declination: 0 },
]

export const LOCATIONS = [
  { id: 'hove', name: 'Hove (Urania)', latitude: dms(51, 9, 0), longitude: dms(4, 28, 0) },
  { id: 'uccle', name: 'Ukkel (Royal Observatory)', latitude: 50.7976, longitude: 4.3583 },
  { id: 'greenwich', name: 'Greenwich', latitude: 51.4769, longitude: 0 },
  { id: 'quito', name: 'Quito (equator)', latitude: -0.1807, longitude: -78.4678 },
  { id: 'la-palma', name: 'La Palma (GTC)', latitude: 28.7564, longitude: -17.8919 },
  { id: 'paranal', name: 'Paranal (VLT)', latitude: -24.6272, longitude: -70.4042 },
  { id: 'sydney', name: 'Sydney', latitude: -33.8688, longitude: 151.2093 },
  { id: 'north-pole', name: 'North Pole', latitude: 90, longitude: 0 },
]
