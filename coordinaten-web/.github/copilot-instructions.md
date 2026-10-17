# Coordinate Explorer Instructions

- Keep this web prototype self-contained in this folder; do not import from `dagboog-web` or the parent Python project.
- Keep coordinate, time and formatting math in `src/coordinates.js` (pure functions, covered by `test/coordinates.test.js`); keep visualization components in their own `src/` files.
- Store angles internally in degrees. Store azimuth from north through east; convert only for display with `azimuthForOrigin`.
- Preserve the static relative asset base in `vite.config.js` for GitHub Pages subpath hosting.
- Validate changes with `npm test`, `npm run lint` and `npm run build`.
