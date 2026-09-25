"""Simplified and JPL-backed Earth-Moon orbital models."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import TypeAlias

import numpy as np
from astropy import units as u
from astropy.coordinates import BarycentricMeanEcliptic, SkyCoord, get_body_barycentric, solar_system_ephemeris
from astropy.time import Time


MOON_ORBIT_RADIUS_KM = 384_400
MOON_ORBIT_PERIOD_DAYS = 27.32
ORBIT_REFERENCE_TIMESTAMP = datetime(2026, 1, 1, tzinfo=timezone.utc)
ECLIPTIC_OBLIQUITY_DEGREES = 23.43928

Position: TypeAlias = tuple[float, float]
OrbitSample: TypeAlias = tuple[datetime, Position]
Position3D: TypeAlias = tuple[float, float, float]
Orbit3DSample: TypeAlias = tuple[datetime, Position3D]


@dataclass(frozen=True)
class EphemerisFrame:
    """Heliocentric J2000 mean-ecliptic positions at one UTC timestamp."""

    timestamp: datetime
    earth: Position3D
    moon: Position3D


@dataclass(frozen=True)
class EarthMoonEphemeris:
    """Timestamped Earth-Moon positions generated from a named JPL ephemeris."""

    frames: tuple[EphemerisFrame, ...]
    source: str
    reference_frame: str = "J2000 barycentric mean ecliptic, heliocentric origin"

    @property
    def moon_geocentric_samples(self) -> list[Orbit3DSample]:
        """Return measured Moon-minus-Earth vectors for existing renderers."""
        return [
            (frame.timestamp, _subtract_positions(frame.moon, frame.earth))
            for frame in self.frames
        ]

    @property
    def sun_geocentric_positions(self) -> list[Position3D]:
        """Return Sun-minus-Earth vectors for existing renderers."""
        return [tuple(-coordinate for coordinate in frame.earth) for frame in self.frames]


def load_earth_moon_ephemeris(
    start_date: date | datetime,
    end_date: date | datetime,
    sample_interval: timedelta = timedelta(hours=6),
    ephemeris: str = "de432s",
) -> EarthMoonEphemeris:
    """Load JPL-backed heliocentric Earth and Moon positions in kilometres."""
    timestamps = _sample_timestamps(start_date, end_date, sample_interval)
    astropy_times = Time(timestamps, scale="utc")

    with solar_system_ephemeris.set(ephemeris):
        earth_icrs = get_body_barycentric("earth", astropy_times)
        moon_icrs = get_body_barycentric("moon", astropy_times)
        sun_icrs = get_body_barycentric("sun", astropy_times)

    ecliptic_frame = BarycentricMeanEcliptic(equinox=Time("J2000"))
    earth_ecliptic = _transform_to_ecliptic(earth_icrs, ecliptic_frame)
    moon_ecliptic = _transform_to_ecliptic(moon_icrs, ecliptic_frame)
    sun_ecliptic = _transform_to_ecliptic(sun_icrs, ecliptic_frame)

    frames = tuple(
        EphemerisFrame(
            timestamp=timestamp,
            earth=_array_position(earth_ecliptic - sun_ecliptic, index),
            moon=_array_position(moon_ecliptic - sun_ecliptic, index),
        )
        for index, timestamp in enumerate(timestamps)
    )
    return EarthMoonEphemeris(frames=frames, source=ephemeris)


def moon_position(day):
    """Return the Moon position in a slightly elliptical, precessing orbit."""
    angle = 2 * np.pi * day / MOON_ORBIT_PERIOD_DAYS
    precession = 2 * np.pi * day / (8 * 365.25)
    major_axis = MOON_ORBIT_RADIUS_KM * 1.055
    minor_axis = MOON_ORBIT_RADIUS_KM * 0.945
    x = major_axis * np.cos(angle)
    y = minor_axis * np.sin(angle)
    return (
        x * np.cos(precession) - y * np.sin(precession),
        x * np.sin(precession) + y * np.cos(precession),
    )


def moon_position_at(timestamp: date | datetime) -> Position:
    """Return the Moon position at a calendar date or timestamp in UTC."""
    normalized_timestamp = _normalize_timestamp(timestamp)
    elapsed_days = (normalized_timestamp - ORBIT_REFERENCE_TIMESTAMP).total_seconds() / 86_400
    x_coordinate, y_coordinate = moon_position(elapsed_days)
    return float(x_coordinate), float(y_coordinate)


def moon_orbit_positions(
    start_date: date | datetime,
    end_date: date | datetime,
    sample_interval: timedelta = timedelta(hours=1),
) -> list[OrbitSample]:
    """Return inclusive ``(timestamp, (x, y))`` Moon-orbit samples in UTC."""
    start_timestamp = _normalize_timestamp(start_date)
    end_timestamp = _normalize_timestamp(end_date)

    if end_timestamp < start_timestamp:
        raise ValueError("end_date must not be earlier than start_date")
    if sample_interval <= timedelta(0):
        raise ValueError("sample_interval must be positive")

    samples: list[OrbitSample] = []
    timestamp = start_timestamp
    while timestamp <= end_timestamp:
        samples.append((timestamp, moon_position_at(timestamp)))
        timestamp += sample_interval

    if samples[-1][0] != end_timestamp:
        samples.append((end_timestamp, moon_position_at(end_timestamp)))

    return samples


def equatorial_to_ecliptic_position(position: Position3D) -> Position3D:
    """Rotate a J2000 equatorial position into the ecliptic reference frame."""
    x_coordinate, y_coordinate, z_coordinate = position
    obliquity = np.deg2rad(ECLIPTIC_OBLIQUITY_DEGREES)
    y_ecliptic = y_coordinate * np.cos(obliquity) + z_coordinate * np.sin(obliquity)
    z_ecliptic = -y_coordinate * np.sin(obliquity) + z_coordinate * np.cos(obliquity)
    return float(x_coordinate), float(y_ecliptic), float(z_ecliptic)


def _sample_timestamps(
    start_date: date | datetime,
    end_date: date | datetime,
    sample_interval: timedelta,
) -> list[datetime]:
    start_timestamp = _normalize_timestamp(start_date)
    end_timestamp = _normalize_timestamp(end_date)

    if end_timestamp < start_timestamp:
        raise ValueError("end_date must not be earlier than start_date")
    if sample_interval <= timedelta(0):
        raise ValueError("sample_interval must be positive")

    timestamps: list[datetime] = []
    timestamp = start_timestamp
    while timestamp <= end_timestamp:
        timestamps.append(timestamp)
        timestamp += sample_interval
    if timestamps[-1] != end_timestamp:
        timestamps.append(end_timestamp)
    return timestamps


def _transform_to_ecliptic(position, frame: BarycentricMeanEcliptic) -> np.ndarray:
    coordinate = SkyCoord(position, frame="icrs").transform_to(frame)
    return coordinate.cartesian.xyz.to_value(u.km)


def _array_position(positions: np.ndarray, index: int) -> Position3D:
    return tuple(float(coordinate) for coordinate in positions[:, index])


def _subtract_positions(left: Position3D, right: Position3D) -> Position3D:
    return tuple(left_coordinate - right_coordinate for left_coordinate, right_coordinate in zip(left, right))


def _normalize_timestamp(timestamp: date | datetime) -> datetime:
    """Convert date-only and naive values to UTC timestamps."""
    if isinstance(timestamp, datetime):
        if timestamp.tzinfo is None:
            return timestamp.replace(tzinfo=timezone.utc)
        return timestamp.astimezone(timezone.utc)
    return datetime.combine(timestamp, time.min, tzinfo=timezone.utc)