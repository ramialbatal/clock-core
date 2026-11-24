# clock-core

Shared, dependency-free JavaScript and CSS for live data clocks: data loading, projections, goal bars, verdicts and an
efficient ticker. It powers three open projects:

| Clock | Live | Code |
|---|---|---|
| Emissions Clock | https://ramialbatal.github.io/emissions-clock/ | [ramialbatal/emissions-clock](https://github.com/ramialbatal/emissions-clock) |
| Renewables Clock | https://ramialbatal.github.io/renewables-clock/ | [ramialbatal/renewables-clock](https://github.com/ramialbatal/renewables-clock) |
| Jobs Clock | https://ramialbatal.github.io/jobs-clock/ | [ramialbatal/jobs-clock](https://github.com/ramialbatal/jobs-clock) |

No framework, no build step: one ES module and one stylesheet, loaded straight into the browser.

## Use it

Pin a release tag or an exact commit (never `@main`), so a change here can't break a clock by surprise. The first
release was tagged `V1.0.0` (capital V), so the clocks pin its commit,
`7f64264169149b91d119f75504cf419cf42475c2`; later releases use lowercase tags such as `v1.1.0`:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ramialbatal/clock-core@7f64264169149b91d119f75504cf419cf42475c2/clock-core.css">
<script type="importmap">
  { "imports": { "clock-core": "https://cdn.jsdelivr.net/gh/ramialbatal/clock-core@7f64264169149b91d119f75504cf419cf42475c2/clock-core.js" } }
</script>
<script type="module" src="js/app.js"></script>
```

```js
// js/app.js
import * as C from "clock-core";

const rows = await C.fetchCsv(url);
const p = C.project(series, 1, 0.5);           // latest year grown by its latest trend, capped at 50%
C.startTicker((now) => C.setText(el, C.fmt[0].format(p.annual * C.yearFraction(now))));
```

The clock then sets its colours in its own `css/theme.css`: `--accent`, `--accent-2`, `--tint`, `--glow`, `--on-accent`.

## What's inside

| Group | Exports | Notes |
|---|---|---|
| Time (UTC) | `YEAR`, `yearStart`, `msPerYear`, `SEC_PER_YEAR`, `yearFraction`, `tYears` | `tYears` gives fractional years, e.g. 2026.89 |
| Formats | `fmt[0..3]`, `shown`, `shownSign`, `signed`, `pct`, `digits`, `escapeHtml` | Compare and colour with `shown` (value as displayed); `signed` never shows "-0"; escape any data text put into HTML |
| Data | `fetchText`, `fetchCsv`, `fetchJson`, `parseCsv`, `num`, `seriesByCode`, `namesByCode`, `once` | Strict parsing (bad cells are skipped, not misread); `once` caches a loader and retries after a failure |
| Models | `project`, `interpolateMidYear`, `neededGrowth`, `verdict` | Pure functions, unit tested; `verdict` works for rising and falling goals |
| Rendering | `sparkline`, `wireHistory`, `sortInto`, `showVerdict` | Sparkline colours follow which direction is good |
| Ticker | `startTicker`, `stopTicker`, `setText` | About 10 redraws a second, writes only changed text, survives errors, reloads at New Year |
| Page | `setState`, `wireHelp`, `fill`, `showVerdict` | Loading, ready and error states; the "?" pop-up; verdict badges |

Every export has JSDoc types in [`clock-core.js`](clock-core.js); editors and agents get type hints and checks for free.

## Develop

```sh
npm install        # installs the TypeScript checker only (no runtime dependencies)
npm run check      # style (no em or en dashes) + types + unit tests
```

The same checks run on every pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [developer notes](docs/README.md)
for how the clocks are built, lessons learned and rules for new code.

## Release

1. In the pull request: update `CHANGELOG.md` and `version` in `package.json`, run `npm run check`, and run each
   clock's smoke test against your checkout (`CLOCK_CORE_DIR=../clock-core npm run smoke` in the clock's folder).
2. After merging, optionally create a GitHub release with a **lowercase** tag such as `v1.2.0`.
3. In each clock, change the pin (a commit SHA or the tag) in three places: the two URLs in `index.html` and the
   `clock-core` dev dependency in `package.json`. Check the new CDN URL returns 200 first:
   `curl -sI https://cdn.jsdelivr.net/gh/ramialbatal/clock-core@<pin>/clock-core.js | head -1`.

## Licence

[MIT](LICENSE). Data used by the clocks comes from their own sources under their own licences (see each clock).
