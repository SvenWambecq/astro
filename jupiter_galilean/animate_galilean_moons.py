"""Display an interactive Three.js animation of Jupiter's Galilean moons."""

from datetime import datetime, timedelta, timezone

from jupiter_galilean.galilean_moons_model import galilean_orbit_positions, load_galilean_moons_ephemeris
from jupiter_galilean.galilean_moons_threejs import GalileanMoonsThreeJS


def create_widget(days: int = 17) -> GalileanMoonsThreeJS:
    """Create a widget that samples the last ``days`` of moon positions."""
    end_time = datetime.now(timezone.utc)
    samples = galilean_orbit_positions(end_time - timedelta(days=days), end_time)
    return GalileanMoonsThreeJS(samples)


def create_jpl_widget(days: int = 17) -> GalileanMoonsThreeJS:
    """Create a widget using JPL Horizons vectors rather than the simplified orbits."""
    end_time = datetime.now(timezone.utc)
    ephemeris = load_galilean_moons_ephemeris(end_time - timedelta(days=days), end_time)
    return GalileanMoonsThreeJS(ephemeris.moon_orbit_samples)


widget = create_widget()
widget