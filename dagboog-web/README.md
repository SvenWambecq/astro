# Dagboog Web

A standalone React prototype of the solar day-arc notebook. The browser app calculates an approximate solar declination from the selected date and shows three linked reference frames: Earth around the Sun, the Earth meridian, and the local observer sky, plus solar altitude through the day.

The Sun-centered view shows a circular orbit with equinox and solstice markers, a fixed 23.44-degree axial tilt, Earth's equator, and an observer arrow at the selected latitude at local solar noon. Date changes move Earth around the orbit without changing its axis direction. Orbit phase uses the same seasonal approximation as solar declination; marker dates are approximate, and body sizes and distances are not to scale. Drag either 3D view to rotate it or scroll to zoom.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use the latitude slider or numeric field, and use the day-of-year slider or calendar picker. The controls stay synchronized.

## Standalone HTML

```sh
npm install
npm run build:singlefile
```

Share `dist-singlefile/index.html`. It includes the app's JavaScript and CSS;
recipients can open it directly in a modern browser, even offline, without
Node.js or a server. All interactive controls and visualizations remain available.
The unused files in `public/` are excluded from this build.

The regular `npm run build` output remains in `dist/` for web hosting.

## Verify

```sh
npm run lint
npm run build
npm run preview
```

## GitHub Pages

Vite is configured with a relative asset base, so the built `dist/` output can be hosted from a repository subpath. Build with `npm run build`, then publish `dist/` with a GitHub Pages Actions workflow. When this folder remains inside a larger repository, configure the workflow to run npm commands in `dagboog-web/` and upload `dagboog-web/dist/`.

The calculations use a simple seasonal declination approximation and an ideal horizon; atmospheric refraction is omitted.