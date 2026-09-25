"""Interactive Plotly helpers for the Moon's orbit around Earth."""

from dataclasses import dataclass, field

import numpy as np
import plotly.graph_objects as go

from earth_moon_model import MOON_ORBIT_RADIUS_KM, Orbit3DSample, OrbitSample


DEFAULT_3D_SCENE_LIMIT_KM = MOON_ORBIT_RADIUS_KM * 1.22
SCENE_MARGIN = 1.1


@dataclass
class EarthMoonOrbitPlotly:
    """A Plotly figure used to display timestamped Moon-orbit samples."""

    figure: go.Figure
    samples: list[OrbitSample] = field(default_factory=list)


@dataclass
class EarthMoonOrbitPlotly3D:
    """A three-dimensional Plotly figure in the ecliptic reference frame."""

    figure: go.Figure
    samples: list[Orbit3DSample] = field(default_factory=list)
    vertical_exaggeration: float = 1.0
    sun_distance_compression: float = 1.0


def create_earth_moon_orbit_plotly() -> EarthMoonOrbitPlotly:
    """Create an interactive Earth-centred Plotly figure."""
    limit = MOON_ORBIT_RADIUS_KM * 1.22
    figure = go.Figure()
    figure.add_scatter(
        x=[0],
        y=[0],
        mode="markers",
        marker={"size": 34, "color": "#1976d2", "line": {"color": "#0d47a1", "width": 1.5}},
        name="Earth",
        hovertemplate="Earth<extra></extra>",
    )
    figure.add_scatter(
        x=[],
        y=[],
        mode="markers",
        marker={"size": 5},
        name="Moon path",
        hovertemplate="%{customdata[0]}<br>(%{x:,.0f}, %{y:,.0f}) km<extra>Moon path</extra>",
    )
    figure.add_scatter(
        x=[],
        y=[],
        mode="markers",
        marker={"size": 16, "color": "#cfd8dc", "line": {"color": "#546e7a", "width": 1}},
        name="Moon",
        hovertemplate="%{customdata[0]}<br>(%{x:,.0f}, %{y:,.0f}) km<extra>Moon</extra>",
    )
    figure.update_layout(
        template="plotly_white",
        plot_bgcolor="#f7f9fc",
        title="Earth-Moon system",
        hovermode="closest",
        legend={"x": 1, "xanchor": "right", "y": 1, "yanchor": "top"},
        xaxis={
            "title": "Distance from Earth (km)",
            "range": [-limit, limit],
            "scaleanchor": "y",
            "scaleratio": 1,
            "showgrid": True,
        },
        yaxis={"title": "Distance from Earth (km)", "range": [-limit, limit], "showgrid": True},
    )
    return EarthMoonOrbitPlotly(figure=figure)


def update_earth_moon_orbit_plotly(orbit_plot: EarthMoonOrbitPlotly, samples: list[OrbitSample]) -> None:
    """Update a Plotly figure from ``(timestamp, position)`` orbit samples."""
    if not samples:
        raise ValueError("samples must contain at least one orbit position")

    positions = np.asarray([position for _, position in samples])
    timestamps = [[f"{timestamp:%Y-%m-%d %H:%M UTC}"] for timestamp, _ in samples]
    trail_colors = [f"rgba(96, 125, 159, {alpha:.3f})" for alpha in np.linspace(0.1, 1, len(samples))]
    timestamp, position = samples[-1]

    orbit_plot.samples = samples
    orbit_plot.figure.data[1].update(
        x=positions[:, 0].tolist(),
        y=positions[:, 1].tolist(),
        customdata=timestamps,
        marker={"size": 5, "color": trail_colors},
    )
    orbit_plot.figure.data[2].update(x=[position[0]], y=[position[1]], customdata=[timestamps[-1]])
    orbit_plot.figure.update_layout(title=f"Earth-Moon system - {timestamp:%Y-%m-%d %H:%M UTC}")


def create_earth_moon_orbit_plotly_3d() -> EarthMoonOrbitPlotly3D:
    """Create an interactive Earth-centred 3D figure with the ecliptic as z=0."""
    limit = DEFAULT_3D_SCENE_LIMIT_KM
    figure = go.Figure()
    figure.add_surface(
        x=[[-limit, limit], [-limit, limit]],
        y=[[-limit, -limit], [limit, limit]],
        z=[[0, 0], [0, 0]],
        colorscale=[[0, "#dce8d8"], [1, "#dce8d8"]],
        opacity=0.35,
        showscale=False,
        hoverinfo="skip",
        name="Ecliptic plane",
    )
    figure.add_scatter3d(
        x=[0],
        y=[0],
        z=[0],
        mode="markers",
        marker={"size": 9, "color": "#1976d2", "line": {"color": "#0d47a1", "width": 1}},
        name="Earth",
        hovertemplate="Earth<extra></extra>",
    )
    figure.add_scatter3d(
        x=[],
        y=[],
        z=[],
        mode="markers",
        marker={"size": 3},
        name="Moon path",
        hovertemplate="%{customdata[0]}<br>(%{x:,.0f}, %{y:,.0f}, %{z:,.0f}) km<extra>Moon path</extra>",
    )
    figure.add_scatter3d(
        x=[],
        y=[],
        z=[],
        mode="markers",
        marker={"size": 6, "color": "#cfd8dc", "line": {"color": "#546e7a", "width": 1}},
        name="Moon",
        hovertemplate="%{customdata[0]}<br>(%{x:,.0f}, %{y:,.0f}, %{z:,.0f}) km<extra>Moon</extra>",
    )
    figure.add_scatter3d(
        x=[],
        y=[],
        z=[],
        mode="markers",
        marker={"size": 16, "color": "#f9a825", "line": {"color": "#f57f17", "width": 1}},
        name="Sun",
        hovertemplate="%{customdata[0]}<br>Earth-Sun distance: %{customdata[1]:,.0f} km<extra>Sun</extra>",
    )
    figure.update_layout(
        template="plotly_white",
        title="Earth-Moon system in the ecliptic frame",
        legend={"x": 1, "xanchor": "right", "y": 1, "yanchor": "top"},
        scene={
            "xaxis": {"title": "x (km)", "range": [-limit, limit]},
            "yaxis": {"title": "y (km)", "range": [-limit, limit]},
            "zaxis": {"title": "z above ecliptic (km)", "range": [-limit / 4, limit / 4]},
            "aspectmode": "manual",
            "aspectratio": {"x": 1, "y": 1, "z": 0.25},
            "camera": {"eye": {"x": 1.55, "y": -1.55, "z": 0.8}},
        },
    )
    return EarthMoonOrbitPlotly3D(figure=figure)


def update_earth_moon_orbit_plotly_3d(
    orbit_plot: EarthMoonOrbitPlotly3D,
    samples: list[Orbit3DSample],
    sun_position: tuple[float, float, float] | None = None,
    sun_distance_compression: float = 1.0,
) -> None:
    """Update a 3D ecliptic figure and optionally show a distance-compressed Sun."""
    if not samples:
        raise ValueError("samples must contain at least one orbit position")
    if sun_distance_compression <= 0:
        raise ValueError("sun_distance_compression must be positive")

    positions = np.asarray([position for _, position in samples])
    timestamps = [[f"{timestamp:%Y-%m-%d %H:%M UTC}"] for timestamp, _ in samples]
    trail_colors = [f"rgba(96, 125, 159, {alpha:.3f})" for alpha in np.linspace(0.1, 1, len(samples))]
    timestamp, position = samples[-1]

    orbit_plot.samples = samples
    orbit_plot.figure.data[2].update(
        x=positions[:, 0].tolist(),
        y=positions[:, 1].tolist(),
        z=positions[:, 2].tolist(),
        customdata=timestamps,
        marker={"size": 3, "color": trail_colors},
    )
    orbit_plot.figure.data[3].update(
        x=[position[0]], y=[position[1]], z=[position[2]], customdata=[timestamps[-1]]
    )
    if sun_position is None:
        orbit_plot.figure.data[4].update(x=[], y=[], z=[], customdata=[])
        _set_3d_scene_limits(orbit_plot, DEFAULT_3D_SCENE_LIMIT_KM, DEFAULT_3D_SCENE_LIMIT_KM / 4)
        title = "Earth-Moon system"
    else:
        displayed_sun_position = [coordinate / sun_distance_compression for coordinate in sun_position]
        sun_distance = float(np.linalg.norm(sun_position))
        compression_label = "" if sun_distance_compression == 1 else f" ({sun_distance_compression:g}x closer)"
        orbit_plot.sun_distance_compression = sun_distance_compression
        orbit_plot.figure.data[4].update(
            x=[displayed_sun_position[0]],
            y=[displayed_sun_position[1]],
            z=[displayed_sun_position[2]],
            customdata=[[f"{timestamp:%Y-%m-%d %H:%M UTC}", sun_distance]],
            name=f"Sun{compression_label}",
        )
        horizontal_limit = max(
            DEFAULT_3D_SCENE_LIMIT_KM,
            max(abs(displayed_sun_position[0]), abs(displayed_sun_position[1])) * SCENE_MARGIN,
        )
        vertical_limit = max(
            DEFAULT_3D_SCENE_LIMIT_KM / 4,
            abs(displayed_sun_position[2]) * SCENE_MARGIN,
        )
        _set_3d_scene_limits(orbit_plot, horizontal_limit, vertical_limit)
        title = "Earth-Moon-Sun system"
    orbit_plot.figure.update_layout(title=f"{title} - {timestamp:%Y-%m-%d %H:%M UTC}")


def set_earth_moon_orbit_vertical_exaggeration(
    orbit_plot: EarthMoonOrbitPlotly3D, exaggeration: float
) -> None:
    """Set the visual z-axis exaggeration without changing orbit coordinates."""
    if exaggeration <= 0:
        raise ValueError("exaggeration must be positive")

    orbit_plot.vertical_exaggeration = exaggeration
    orbit_plot.figure.update_layout(
        scene={"aspectmode": "manual", "aspectratio": {"x": 1, "y": 1, "z": 0.25 * exaggeration}}
    )


def _set_3d_scene_limits(orbit_plot: EarthMoonOrbitPlotly3D, horizontal_limit: float, vertical_limit: float) -> None:
    """Resize the visible ecliptic plane and scene bounds around Earth."""
    orbit_plot.figure.data[0].update(
        x=[[-horizontal_limit, horizontal_limit], [-horizontal_limit, horizontal_limit]],
        y=[[-horizontal_limit, -horizontal_limit], [horizontal_limit, horizontal_limit]],
    )
    orbit_plot.figure.update_layout(
        scene={
            "xaxis": {"range": [-horizontal_limit, horizontal_limit]},
            "yaxis": {"range": [-horizontal_limit, horizontal_limit]},
            "zaxis": {"range": [-vertical_limit, vertical_limit]},
        }
    )