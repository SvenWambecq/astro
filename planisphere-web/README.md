# Planisphere

A latitude-aware SVG planisphere with rotating sky and horizon disks, date/time
controls, bright stars, constellation lines, moving planets, and deep-sky finding
targets.

## Develop and Build

Use Node.js 22.12 or newer. From this directory:

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run build:singlefile
```

- `dist/` is the normal website build. Serve this directory with a web server.
- `dist-singlefile/index.html` is the self-contained download. Open it directly
  in a browser, including offline. No server, CDN, fonts, or catalogue requests
  are needed. Fonts use locally installed faces or the browser fallback.
- Browser geolocation may need HTTPS or localhost and permission. Offline
  geolocation depends on the browser/device; coordinates and location presets
  remain available without it.

Both builds include third-party license notices in a non-executable text element
in the HTML. The catalogue's original notice is also retained under `public/data/`.
External attribution links are optional and need the internet only when opened.

## Chart Navigation

- Use the minus/plus controls to zoom between 100% and 600%.
- Scroll over the chart to zoom toward the pointer, or pinch with two fingers.
- Drag to pan when zoomed in. At 100%, dragging rotates the disk and changes
  the observing time as before.
- The circular-arrow **Reset zoom** button restores the complete disk at 100%.
  Zooming, panning, and resetting do not change the observing time.

## Planets

Mercury, Venus, Mars, Jupiter, Saturn, Uranus, and Neptune are calculated with
Astronomy Engine for the selected date, time, latitude, and longitude. Positions
use observer-specific equatorial coordinates of date, matching the star chart.
Changing the date moves planets against the constellations; changing the time
also rotates the sky with respect to the horizon. Advance by days or weeks to
make planetary motion easier to see.

Use the **Planets** layer switch to show or hide their named markers. They obey
the horizon mask but are independent of the star limiting-magnitude slider.
The **Planets** finder tab and object search include all seven, even when below
the horizon. Selecting one shows its current magnitude, altitude, coordinates,
and nearby bright reference stars. Uranus and Neptune generally need optical
aid; a plotted marker does not imply naked-eye visibility.

Markers are symbolic, not true angular sizes; Saturn's ring icon is not an
orientation model. The ephemerides are bundled and work offline in the single
HTML file, without additional downloads.

## Publish With GitHub Pages

The repository-level workflow `.github/workflows/deploy-planisphere-pages.yml`
builds and deploys the app whenever changes to this app are pushed to `main`.
It can also be started manually from the repository's Actions tab.

1. Commit the app, its lockfile, and both new workflows, then push to GitHub.
2. Open the repository's **Settings > Pages**.
3. Set **Build and deployment > Source** to **GitHub Actions**.
4. Open **Actions > Deploy planisphere to GitHub Pages > Run workflow** if the
   initial push has already occurred, and wait for deployment to succeed.

For `SvenWambecq/astro`, the expected addresses after deployment are:

- Website: https://svenwambecq.github.io/astro/planisphere-web/
- Offline file: https://svenwambecq.github.io/astro/planisphere-web/planisphere.html
- App index: https://svenwambecq.github.io/astro/

The offline download is linked from the app index. Visitors can use the website
without downloading anything. GitHub Pages availability depends on repository
visibility and the account's plan. Pages content is generally public; do not
publish secrets or private data.

GitHub Pages hosts one deployment per repository. This workflow currently
publishes the planisphere and a small app index, not the other astronomy apps.
If you later publish those apps, add their builds to this same workflow rather
than creating competing Pages deployments. Relative asset URLs support GitHub
project subpaths without a custom domain.

## Create a Downloadable GitHub Release

After committing and pushing the code, tag the commit to publish:

```sh
git tag planisphere-web-v0.1.0
git push astro planisphere-web-v0.1.0
```

`astro` is this workspace's configured remote; use your own remote name in a
clone where it differs. Use a new version tag for subsequent releases.

The **Release planisphere HTML** workflow validates the app and attaches
`planisphere.html` to the GitHub Release automatically. This is separate from
Pages: a release is a versioned download, while Pages is the live website.

## Redistribution

Star data and constellation lines come from
[d3-celestial](https://github.com/ofrohn/d3-celestial) / Hipparcos. Preserve the
included BSD notice. React, React DOM, Scheduler, Astronomy Engine, and Lucide
notices are embedded in the generated HTML as well. This setup does not select
a license for your original app code; choose a suitable license before inviting
others to reuse or contribute to that code.