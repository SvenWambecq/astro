"""Simplified Jupiter-centred orbital model for the four Galilean moons."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import TypeAlias

import numpy as np
from astropy import units as u
from astropy.time import Time
from astroquery.jplhorizons import Horizons


ORBIT_REFERENCE_TIMESTAMP = datetime(2026, 1, 1, tzinfo=timezone.utc)


@dataclass(frozen=True)
class MoonOrbit:
    """Mean circular-orbit parameters for a Galilean moon."""

    name: str
    orbital_radius_km: float
    orbital_period_days: float
    color: str
    phase_degrees: float


GALILEAN_MOONS = (
    MoonOrbit("Io", 421_700, 1.769, "#d36f3b", 15),
    MoonOrbit("Europa", 671_100, 3.551, "#c9a45b", 105),
    MoonOrbit("Ganymede", 1_070_400, 7.155, "#7394aa", 210),
    MoonOrbit("Callisto", 1_882_700, 16.689, "#8b7468", 300),
)

Position = tuple[float, float]
MoonOrbitSample = tuple[datetime, Position]
Position3D: TypeAlias = tuple[float, float, float]
MoonOrbit3DSample: TypeAlias = tuple[datetime, Position3D]

HORIZONS_TARGET_IDS = {
    "Io": "501",
    "Europa": "502",
    "Ganymede": "503",
    "Callisto": "504",
}


@dataclass(frozen=True)
class GalileanMoonsEphemeris:
    """JPL Horizons moon positions in the J2000 ecliptic frame centred on Jupiter."""

    samples: dict[str, tuple[MoonOrbit3DSample, ...]]
    source: str = "JPL Horizons"
    reference_frame: str = "J2000 ecliptic, Jupiter-centred"

    @property
    def moon_orbit_samples(self) -> dict[str, list[MoonOrbit3DSample]]:
        """Return mutable sample lists suitable for existing plot renderers."""
        return {name: list(moon_samples) for name, moon_samples in self.samples.items()}


def moon_position_at(moon: MoonOrbit, timestamp: date | datetime) -> Position:
    """Return a moon's simplified circular-orbit position in kilometres."""
    elapsed_days = (_normalize_timestamp(timestamp) - ORBIT_REFERENCE_TIMESTAMP).total_seconds() / 86_400
    angle = 2 * np.pi * elapsed_days / moon.orbital_period_days + np.deg2rad(moon.phase_degrees)
    return (
        float(moon.orbital_radius_km * np.cos(angle)),
        float(moon.orbital_radius_km * np.sin(angle)),
    )


def moon_orbit_positions(
    moon: MoonOrbit,
    start_date: date | datetime,
    end_date: date | datetime,
    sample_interval: timedelta = timedelta(hours=2),
) -> list[MoonOrbitSample]:
    """Return inclusive timestamped positions for one Galilean moon."""
    start_timestamp = _normalize_timestamp(start_date)
    end_timestamp = _normalize_timestamp(end_date)
    if end_timestamp < start_timestamp:
        raise ValueError("end_date must not be earlier than start_date")
    if sample_interval <= timedelta(0):
        raise ValueError("sample_interval must be positive")

    samples: list[MoonOrbitSample] = []
    timestamp = start_timestamp
    while timestamp <= end_timestamp:
        samples.append((timestamp, moon_position_at(moon, timestamp)))
        timestamp += sample_interval
    if samples[-1][0] != end_timestamp:
        samples.append((end_timestamp, moon_position_at(moon, end_timestamp)))
    return samples


def galilean_orbit_positions(
    start_date: date | datetime,
    end_date: date | datetime,
    sample_interval: timedelta = timedelta(hours=2),
) -> dict[str, list[MoonOrbitSample]]:
    """Return timestamped simplified positions for all four Galilean moons."""
    return {
        moon.name: moon_orbit_positions(moon, start_date, end_date, sample_interval)
        for moon in GALILEAN_MOONS
    }


def load_galilean_moons_ephemeris(
    start_date: date | datetime,
    end_date: date | datetime,
    sample_interval: timedelta = timedelta(hours=2),
) -> GalileanMoonsEphemeris:
    """Load JPL Horizons moon vectors relative to Jupiter in kilometres.

    This makes one Horizons vector request per moon. It requires network access
    and the ``astroquery`` package.
    """
    timestamps = _sample_timestamps(start_date, end_date, sample_interval)
    start_timestamp = _normalize_timestamp(start_date)
    end_timestamp = _normalize_timestamp(end_date)
    step_hours = sample_interval.total_seconds() / 3_600
    epochs = {
        "start": start_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "stop": end_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "step": f"{step_hours:g}h",
    }
    samples: dict[str, tuple[MoonOrbit3DSample, ...]] = {}
    for moon in GALILEAN_MOONS:
        vectors = Horizons(
            id=HORIZONS_TARGET_IDS[moon.name],
            location="500@599",
            epochs=epochs,
        ).vectors(refplane="ecliptic", aberrations="geometric")
        if len(vectors) != len(timestamps):
            raise RuntimeError(f"Horizons returned {len(vectors)} samples for {moon.name}; expected {len(timestamps)}")
        x_coordinates = vectors["x"].quantity.to_value(u.km)
        y_coordinates = vectors["y"].quantity.to_value(u.km)
        z_coordinates = vectors["z"].quantity.to_value(u.km)
        samples[moon.name] = tuple(
            (timestamp, (float(x), float(y), float(z)))
            for timestamp, x, y, z in zip(timestamps, x_coordinates, y_coordinates, z_coordinates)
        )
    return GalileanMoonsEphemeris(samples=samples)


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


def _normalize_timestamp(timestamp: date | datetime) -> datetime:
    if isinstance(timestamp, datetime):
        if timestamp.tzinfo is None:
            return timestamp.replace(tzinfo=timezone.utc)
        return timestamp.astimezone(timezone.utc)
    return datetime.combine(timestamp, time.min, tzinfo=timezone.utc)
