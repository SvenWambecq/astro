"""Reusable plotting helpers for the Moon's orbit around Earth."""

from dataclasses import dataclass, field

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.collections import PathCollection
from matplotlib.text import Annotation, Text

from earth_moon_model import MOON_ORBIT_RADIUS_KM, OrbitSample


@dataclass
class EarthMoonOrbitPlot:
    """Matplotlib artists used to display timestamped Moon-orbit samples."""

    figure: plt.Figure
    axes: plt.Axes
    trail_artist: PathCollection
    moon_artist: PathCollection
    title_artist: Text
    hover_annotation: Annotation
    samples: list[OrbitSample] = field(default_factory=list)


def create_earth_moon_orbit_plot() -> EarthMoonOrbitPlot:
    """Create an Earth-centred plot ready to display Moon-orbit samples."""
    figure, axes = plt.subplots(figsize=(8, 8))
    axes.set_facecolor("#f7f9fc")
    limit = MOON_ORBIT_RADIUS_KM * 1.22
    axes.set(
        xlim=(-limit, limit),
        ylim=(-limit, limit),
        aspect="equal",
        xlabel="Distance from Earth (km)",
        ylabel="Distance from Earth (km)",
    )
    axes.grid(alpha=0.25)
    axes.scatter(
        0,
        0,
        s=1_200,
        color="#1976d2",
        edgecolor="#0d47a1",
        linewidth=1.5,
        zorder=3,
        label="Earth",
    )
    trail_artist = axes.scatter([], [], s=12, linewidths=0, zorder=2, label="Moon path")
    moon_artist = axes.scatter(
        [],
        [],
        s=150,
        color="#cfd8dc",
        edgecolor="#546e7a",
        linewidth=1,
        zorder=4,
        label="Moon",
    )
    title_artist = axes.set_title("")
    hover_annotation = axes.annotate(
        "",
        xy=(0, 0),
        xytext=(12, 12),
        textcoords="offset points",
        bbox={"boxstyle": "round", "fc": "white", "ec": "#546e7a"},
    )
    hover_annotation.set_visible(False)
    axes.legend(loc="upper right")

    orbit_plot = EarthMoonOrbitPlot(
        figure=figure,
        axes=axes,
        trail_artist=trail_artist,
        moon_artist=moon_artist,
        title_artist=title_artist,
        hover_annotation=hover_annotation,
    )
    figure.canvas.mpl_connect("motion_notify_event", lambda event: _update_hover(event, orbit_plot))
    return orbit_plot


def update_earth_moon_orbit_plot(orbit_plot: EarthMoonOrbitPlot, samples: list[OrbitSample]) -> None:
    """Update a plot in place from ``(timestamp, position)`` orbit samples."""
    if not samples:
        raise ValueError("samples must contain at least one orbit position")

    positions = np.asarray([position for _, position in samples])
    trail_alpha = np.linspace(0, 1, len(samples))
    trail_colors = [(0.376, 0.49, 0.624, alpha) for alpha in trail_alpha]
    timestamp, position = samples[-1]

    orbit_plot.samples = samples
    orbit_plot.trail_artist.set_offsets(positions)
    orbit_plot.trail_artist.set_facecolors(trail_colors)
    orbit_plot.moon_artist.set_offsets([position])
    orbit_plot.title_artist.set_text(f"Earth-Moon system - {timestamp:%Y-%m-%d %H:%M UTC}")
    orbit_plot.figure.canvas.draw_idle()


def plot_to_png(orbit_plot: EarthMoonOrbitPlot) -> bytes:
    """Render the current plot as PNG bytes for standard notebook image widgets."""
    import io

    image_buffer = io.BytesIO()
    orbit_plot.figure.savefig(image_buffer, format="png", dpi=100)
    return image_buffer.getvalue()


def _update_hover(event, orbit_plot: EarthMoonOrbitPlot) -> None:
    """Show timestamp and coordinates when hovering a Moon-path point."""
    annotation = orbit_plot.hover_annotation
    if event.inaxes != orbit_plot.axes or not orbit_plot.samples:
        _set_annotation_visibility(annotation, False, orbit_plot.figure)
        return

    contains_point, details = orbit_plot.trail_artist.contains(event)
    if not contains_point:
        _set_annotation_visibility(annotation, False, orbit_plot.figure)
        return

    point_index = details["ind"][-1]
    timestamp, (x_coordinate, y_coordinate) = orbit_plot.samples[point_index]
    annotation.xy = (x_coordinate, y_coordinate)
    annotation.set_text(
        f"{timestamp:%Y-%m-%d %H:%M UTC}\n"
        f"({x_coordinate:,.0f}, {y_coordinate:,.0f}) km"
    )
    _set_annotation_visibility(annotation, True, orbit_plot.figure)


def _set_annotation_visibility(annotation: Annotation, visible: bool, figure: plt.Figure) -> None:
    """Update annotation visibility only when it changes."""
    if annotation.get_visible() != visible:
        annotation.set_visible(visible)
        figure.canvas.draw_idle()