"""Matplotlib plot for the Galilean moons orbiting Jupiter."""

from dataclasses import dataclass, field
from datetime import datetime

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.collections import PathCollection
from matplotlib.text import Annotation, Text

from jupiter_galilean.galilean_moons_model import GALILEAN_MOONS, MoonOrbitSample


@dataclass
class GalileanMoonsPlot:
    """Matplotlib artists for a Jupiter-centred Galilean-moons plot."""

    figure: plt.Figure
    axes: plt.Axes
    trail_artists: dict[str, PathCollection]
    moon_artists: dict[str, PathCollection]
    title_artist: Text
    hover_annotation: Annotation
    samples: dict[str, list[MoonOrbitSample]] = field(default_factory=dict)


def create_galilean_moons_plot() -> GalileanMoonsPlot:
    """Create a Jupiter-centred plot ready for all four moon trajectories."""
    figure, axes = plt.subplots(figsize=(9, 9))
    limit = max(moon.orbital_radius_km for moon in GALILEAN_MOONS) * 1.16
    axes.set_facecolor("#f8f6f1")
    axes.set(
        xlim=(-limit, limit),
        ylim=(-limit, limit),
        aspect="equal",
        xlabel="Distance from Jupiter (km)",
        ylabel="Distance from Jupiter (km)",
    )
    axes.grid(alpha=0.22)
    axes.scatter(0, 0, s=1_500, color="#c77832", edgecolor="#814318", linewidth=1.5, zorder=4, label="Jupiter")

    trail_artists: dict[str, PathCollection] = {}
    moon_artists: dict[str, PathCollection] = {}
    for moon in GALILEAN_MOONS:
        trail_artists[moon.name] = axes.scatter([], [], s=10, color=moon.color, alpha=0.35, linewidths=0, zorder=2)
        moon_artists[moon.name] = axes.scatter(
            [], [], s=90, color=moon.color, edgecolor="#3d352f", linewidth=0.8, zorder=5, label=moon.name
        )

    title_artist = axes.set_title("Jupiter and the Galilean moons")
    hover_annotation = axes.annotate(
        "", xy=(0, 0), xytext=(12, 12), textcoords="offset points", bbox={"boxstyle": "round", "fc": "white", "ec": "#665c54"}
    )
    hover_annotation.set_visible(False)
    axes.legend(loc="upper right")

    orbit_plot = GalileanMoonsPlot(figure, axes, trail_artists, moon_artists, title_artist, hover_annotation)
    figure.canvas.mpl_connect("motion_notify_event", lambda event: _update_hover(event, orbit_plot))
    return orbit_plot


def update_galilean_moons_plot(orbit_plot: GalileanMoonsPlot, samples: dict[str, list[MoonOrbitSample]]) -> None:
    """Update all paths and current positions from timestamped moon samples."""
    expected_names = {moon.name for moon in GALILEAN_MOONS}
    if set(samples) != expected_names or any(not moon_samples for moon_samples in samples.values()):
        raise ValueError("samples must contain non-empty positions for Io, Europa, Ganymede, and Callisto")

    timestamps = {moon_samples[-1][0] for moon_samples in samples.values()}
    if len(timestamps) != 1:
        raise ValueError("the latest timestamp must match for all moons")

    orbit_plot.samples = samples
    for moon in GALILEAN_MOONS:
        moon_samples = samples[moon.name]
        positions = np.asarray([position for _, position in moon_samples])
        orbit_plot.trail_artists[moon.name].set_offsets(positions)
        orbit_plot.moon_artists[moon.name].set_offsets([positions[-1]])
    timestamp = timestamps.pop()
    orbit_plot.title_artist.set_text(f"Jupiter and the Galilean moons - {timestamp:%Y-%m-%d %H:%M UTC}")
    orbit_plot.figure.canvas.draw_idle()


def _update_hover(event, orbit_plot: GalileanMoonsPlot) -> None:
    annotation = orbit_plot.hover_annotation
    if event.inaxes != orbit_plot.axes:
        _set_annotation_visibility(annotation, False, orbit_plot.figure)
        return
    for moon in GALILEAN_MOONS:
        contains_point, details = orbit_plot.trail_artists[moon.name].contains(event)
        if contains_point:
            point_index = details["ind"][-1]
            timestamp, (x_coordinate, y_coordinate) = orbit_plot.samples[moon.name][point_index]
            annotation.xy = (x_coordinate, y_coordinate)
            annotation.set_text(f"{moon.name}\n{timestamp:%Y-%m-%d %H:%M UTC}\n({x_coordinate:,.0f}, {y_coordinate:,.0f}) km")
            _set_annotation_visibility(annotation, True, orbit_plot.figure)
            return
    _set_annotation_visibility(annotation, False, orbit_plot.figure)


def _set_annotation_visibility(annotation: Annotation, visible: bool, figure: plt.Figure) -> None:
    if annotation.get_visible() != visible:
        annotation.set_visible(visible)
        figure.canvas.draw_idle()
