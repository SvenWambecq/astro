"""Run a Jupiter and Galilean-moons orbital plot."""

from datetime import datetime, timedelta, timezone

import matplotlib.pyplot as plt

from jupiter_galilean.galilean_moons_model import galilean_orbit_positions
from jupiter_galilean.galilean_moons_plot import create_galilean_moons_plot, update_galilean_moons_plot


def main() -> None:
    end_time = datetime.now(timezone.utc)
    samples = galilean_orbit_positions(end_time - timedelta(days=17), end_time)
    orbit_plot = create_galilean_moons_plot()
    update_galilean_moons_plot(orbit_plot, samples)
    plt.show()


if __name__ == "__main__":
    main()