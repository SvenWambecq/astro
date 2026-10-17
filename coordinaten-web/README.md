# Coördinaten Web

A standalone React and three.js companion to the coordinates lesson. It follows one star through the Earth-oriented coordinate systems and shows how they connect:

| System | Coordinates | Reference circle | Zero point | Depends on place and time? |
|---|---|---|---|---|
| Geographic | latitude φ, longitude λ | Earth’s equator | Greenwich meridian | Fixed on Earth |
| Horizon | azimuth A, altitude h | Horizon | North point (or south) | Yes |
| Local equatorial | hour angle H, declination δ | Celestial equator | Meridian crossing M | H yes, δ no |
| Equatorial | right ascension α, declination δ | Celestial equator | Vernal equinox ♈ | No; used in catalogues |

The systems are linked by sidereal time: `t = GMST + λ` and `H = t − α`.

## Views

1. **Observer’s celestial sphere** — 3D sphere with the horizon, meridian, celestial poles, celestial equator, ♈ and the star’s daily circle. Coloured arcs show A and h, H and δ, and the nested t and α arcs that make `H = t − α` visible. Drag the star to move it; drag elsewhere to rotate the view. Optional horizon or equatorial grids are available.
2. **Coordinate systems** — Editable cards for each system. Changing any value updates every view. Fields accept decimal or sexagesimal input, including the Dutch hemisphere notation used in the slides (`18h36m56s`, `5 34 32`, `+38°47'01"`, `51,15`, `51°09' NB`, `4°28' OL`). Press Enter to apply, Escape to cancel, or ↑/↓ to nudge (Shift for ×10). Azimuth can be counted from north or south.
3. **Earth and sky** — Globe showing the observer and the Greenwich meridian. The direction to ♈ illustrates `GMST` and `t`. The point directly under the star lies at latitude δ and longitude α − GMST; its angular distance from the observer is the zenith distance 90° − h.
4. **Step by step** — The conversion chain from α, δ to A, h with live values, plus the meridian altitude (`h = δ − φ + 90°`) and rise/set hour angle (`cos H₀ = −tan φ · tan δ`).
5. **Altitude through the day** — The star’s altitude 12 hours before and after the selected time. Shading shows daylight and twilight; rising, transit and setting are marked. Click to jump to a time.

Time is entered in your device’s time zone and can play forward at several speeds.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

On phones and narrow screens (up to 900px), choose Sky / Systems / Earth / Steps / Day to show one view at a time. A sticky time bar stays at the bottom of the screen.

## Standalone HTML

```sh
npm run build:singlefile
```

Share `dist-singlefile/index.html`. It includes the app’s JavaScript and CSS and works offline, opened directly in a browser.

## Verify

```sh
npm test
npm run lint
npm run build
```

`npm test` checks the coordinate math with Node’s built-in test runner, including a worked example from Meeus, *Astronomical Algorithms* (examples 12.a, 12.b and 13.b).

## Accuracy and simplifications

- Mean sidereal time (IAU 1982); nutation is ignored, so results are accurate to about 0.01°.
- Catalogue positions are J2000.0 and are used without precession. By 2026, this shifts positions by up to about 0.4°.
- Uses an ideal horizon with no refraction. Rising and setting refer to the object’s centre at altitude 0°.
- Twilight shading uses a low-precision Sun position.
