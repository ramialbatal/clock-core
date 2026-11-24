# How it works

## Repositories

Each clock is its own open project, so people can contribute to one without touching the others or the personal site.

| Repository | Contents | Served at |
|---|---|---|
| `clock-core` | Shared ES module and stylesheet, released with version tags | jsDelivr CDN, pinned by tag or commit |
| `emissions-clock`, `renewables-clock`, `jobs-clock` | One clock each | GitHub Pages: `ramialbatal.github.io/<repo>/` |
| `ramialbatal.github.io` | Personal website only; links to the clocks | `ramialbatal.github.io` |

## Files in a clock

```
index.html            page text, goal section, method, sources, "?" pop-up; loads clock-core and js/app.js
css/theme.css         five colour variables + styles only this clock needs
js/config.js          settings (sources, columns, countries, goals), typed with JSDoc. Start here.
js/model.js           calculations as pure functions: no DOM, no network
js/app.js             loading, rendering, the ticker callback
test/model.test.js    unit tests for model.js (node --test, no dependencies)
scripts/smoke.js      end-to-end test in headless Chromium (same file in every clock)
scripts/check-style.js no em or en dashes (same file in every repository)
.github/workflows/ci.yml  style, types, unit tests and smoke test on every pull request and weekly
img/                  icon.svg, og-image.png (link preview, 1200×630)
```

## How a page loads

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ramialbatal/clock-core@7f64264169149b91d119f75504cf419cf42475c2/clock-core.css">
<link rel="stylesheet" href="css/theme.css">
<script type="importmap">{ "imports": { "clock-core": "https://cdn.jsdelivr.net/gh/ramialbatal/clock-core@7f64264169149b91d119f75504cf419cf42475c2/clock-core.js" } }</script>
<script type="module" src="js/app.js"></script>
```

The clocks currently pin clock-core v1.0.0 by its commit (`@7f64264…`), because that release was tagged `V1.0.0`
with a capital V and jsDelivr treats tag names as case-sensitive. A tag or a commit both work; a commit never moves.

The import map lets every module write `import * as C from "clock-core"`. In Node (tests, type checking) the same
name resolves to the `clock-core` dev dependency, installed from the same release tag. To upgrade clock-core, change
the version in both URLs and in `package.json`.

1. The body starts with `data-state="loading"`; CSS shows only `.loading-only` content.
2. `app.js` starts the fetches. Each loader is wrapped in `C.once()`: it runs once and is reused, and a failure clears
   the cache so "Try again" refetches.
3. When data arrives, `render()` builds the world figures, goal section and cards, then calls `C.startTicker(fn)`.
4. `C.setState("ready")` reveals `.ready-only` content; on failure `C.setState("error", message)` shows the error box.
5. The ticker calls `fn(nowMs)` about 10 times a second; `C.setText` writes only text that changed.

Optional data (renewable capacity, the carbon budget series) loads in parallel and is allowed to fail: its section
stays hidden and the rest of the page works.

GitHub Pages caches files for about 10 minutes, so after a merge visitors may see the old version briefly. There are no
`?v=` cache-busting queries any more.

## clock-core

See the table in the [clock-core README](../README.md#whats-inside). Highlights:

- **Models:** `project(series, n, maxGrowth, year)` grows the latest year by its latest trend (capped);
  `interpolateMidYear(series, t)` turns yearly averages into a level at any moment; `neededGrowth` and `verdict`
  produce goal verdicts with the same words everywhere.
- **Safety:** `escapeHtml` for any data text put into HTML; `signed` never shows "-0".
- **Display:** `sparkline` colours follow which direction is good; `startTicker` reloads the page at New Year.
- **Styles:** `clock-core.css` reads five variables each clock sets in `theme.css`: `--accent`, `--accent-2`,
  `--tint`, `--glow`, `--on-accent`. Meaning colours: `.good` / `.bad` (use these when "higher" isn't automatically
  good); `.up` / `.down` on sparklines mean good / bad as decided by `sparkline`'s `good` option.

## Data sources

| Clock | What | Endpoint | Notes |
|---|---|---|---|
| Emissions | CO₂ by country | OWID grapher `annual-co2-emissions-per-country.csv` (filtered) | Global Carbon Project |
| Emissions | Methane by country | OWID grapher `methane-emissions.csv` | Jones et al. |
| Emissions | World total CO₂ incl. land use | OWID grapher `annual-co2-including-land-use.csv` | For the carbon budget bars |
| Emissions | Remaining carbon budgets | typed into `js/config.js` | **Update every November** from the new Global Carbon Budget |
| Renewables | Generation by source, all countries | OWID grapher `electricity-mix.csv?frequency=annual&metric=by_source&source=total&csvType=full` | Ember + Energy Institute. Full CSV on purpose (about 150 KB compressed). |
| Renewables | Installed renewable capacity | `api.ourworldindata.org/v1/indicators/1305907.data.json` + `.metadata.json` | IRENA. End-of-year GW. Metadata maps entity ids to codes. |
| Jobs | Employed, unemployed, rate | `rplumber.ilo.org/data/indicator/?id=…&ref_area=X01+CHN+…&format=.csv` | ILO modelled estimates, thousands of people, ages 15+. `X01` = world, `X92` = EU-27. |

All of these send `Access-Control-Allow-Origin: *`, which is why the pages need no server.

## Models

### Projecting a yearly figure (Emissions, Renewables generation)

```
growth  = (value[last] / value[last - n])^(1/n) - 1        n = trendYears (1 = latest year-on-year change)
used    = min(growth, maxGrowth)                           Renewables caps at 50% a year
annual  = value[last] × (1 + used)^(this year - last)
so far  = annual × fraction of the year elapsed (UTC)
```

### Carbon budget (Emissions, `budgetModel`)

- `used(t)` = total CO₂ since 1 January 2016 (Paris Agreement), using official years and the projection.
- The published budget counts from 1 January of `budget.from` (2027 for the 2026 edition), so remaining today =
  budget + emissions still to come before that date.
- Bar total = used up to `from` + budget. "Runs out" = remaining ÷ this year's rate. Remaining is shown in tonnes so
  it visibly ticks.
- Pace check: straight line from 2019 to a 48% cut in 2030; compare this year's emissions with where that line is now.

### Capacity goal (Renewables, `capacityModel`)

- IRENA values are end-of-year, so the 2025 value sits at 2026.0.
- Capacity now = latest value grown at its latest yearly growth, shown in kW so it visibly ticks.
- On-track path = compound growth from the 2022 value to 11,000 GW at the end of 2030; the bar marker shows it.
- Verdict compares latest growth with the growth needed from the latest value to the target.
- Cards apply the same test to tripling each country's own 2022 capacity (a rough guide; the pledge is global).

### Levels between yearly averages (Jobs, `jobsEntry`)

- Each ILO yearly average sits at mid-year; the level at any moment comes from `interpolateMidYear`.
- Net new jobs so far = employed now - employed on 1 January. New workers = growth of (employed + unemployed).
- Keeping-up ratio = net new jobs ÷ new workers over the calendar year. If the workforce shrinks, the ratio is
  meaningless, so the verdict uses whether unemployment falls.

## Displaying numbers

- Choose units so the main numbers visibly move (MWh not TWh, tonnes not gigatonnes, kW not GW).
- Colour by meaning, not direction: for emissions, up is bad; for renewables and jobs, up is good.
- Compare values **as displayed** when choosing a colour, so "4.2% (4.2%)" is never shown in red.

## Testing

| Command | What it does | Where |
|---|---|---|
| `npm run style` | No em or en dashes in any text file | every repository |
| `npm run typecheck` | TypeScript checks the JSDoc types (`jsconfig.json`, strict) | every repository |
| `npm test` | Unit tests for the pure functions | every repository |
| `npm run smoke` | Serves the clock, opens it in Chromium at 1280 and 375 px, checks data loads, counters tick, verdicts show, no sideways scroll, no dashes, no console errors | clocks |

`CLOCK_CORE_DIR=../clock-core npm run smoke` serves clock-core from a local checkout instead of the CDN, to test a
clock-core change before releasing it. The weekly scheduled run catches data sources that changed or went away.

## Publishing

- **A clock:** merge to `main`; GitHub Pages updates in a minute or two.
- **clock-core:** merge to `main`, update the changelog, create a GitHub release with a new tag, then bump the version
  in each clock (two URLs in `index.html`, one in `package.json`) through a pull request whose checks pass.
