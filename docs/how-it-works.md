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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ramialbatal/clock-core@<pin>/clock-core.css">
<link rel="stylesheet" href="css/theme.css">
<script type="importmap">{ "imports": { "clock-core": "https://cdn.jsdelivr.net/gh/ramialbatal/clock-core@<pin>/clock-core.js" } }</script>
<script type="module" src="js/app.js" onerror="clockLoadFailed()"></script>
```

`<pin>` is an exact commit (what the clocks use; it never moves) or a lowercase release tag. Each clock's current pin
is in its `index.html`; `CHANGELOG.md` lists the commit of every clock-core version. If the code can't load (CDN
down, very old browser), a small inline script, `clockLoadFailed()`, shows the error box instead of the spinner.

The import map lets every module write `import * as C from "clock-core"`. In Node (tests, type checking) the same
name resolves to the `clock-core` dev dependency in `package.json`, pinned to the same commit. To upgrade clock-core,
change the pin in all three places (two URLs, one dev dependency) and check the CDN URL returns 200.

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
| Emissions | Per person (CO₂, methane) | OWID grapher `co-emissions-per-capita.csv`, `per-capita-methane-emissions.csv` | Same sources, for the "per person" figure |
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
- Verdict (`C.verdict`, values as displayed): On track if latest growth ≥ the growth needed from the latest value to
  the target; Close if it is at least 85% of it; Off track if lower; Going backwards if negative. "Tripled" once the
  multiple, as displayed, reaches 3.0.
- Cards apply the same test to tripling each country's own 2022 capacity (a rough guide; the pledge is global).

### Levels between yearly averages (Jobs, `jobsEntry`)

- Each ILO yearly average sits at mid-year; the level at any moment comes from `interpolateMidYear`.
- Net new jobs so far = employed now - employed on 1 January. New workers = growth of (employed + unemployed).
- Keeping-up ratio = net new jobs ÷ new workers over the calendar year, shown as jobs per 100 new workers (never below
  0). Keeping up at 100 or more, Close at 90 or more, otherwise Falling behind. If the workforce shrinks, the ratio is
  meaningless, so the verdict is whether unemployment (in thousands, as displayed) falls.
- UN goal check: "Improving" if the ILO's estimate of unemployed people for next year is lower than this year's (in
  millions, as displayed), else "Getting worse".

## Page layout: answer first, details on demand

Every clock is written for a visitor who is not technical and reads quickly. Top to bottom:

1. **The answer** (`section.answer`, filled by `C.showAnswer`): an icon, a short title and one sentence, in a colour:
   green (good), amber (warning) or red (bad). For example 🔴 "We're heading the wrong way".
2. **The live counter** (`section.hero`), with one human-scale line ("about 1,248 more every second").
3. **Where we stand** (`section.standing`): two or three traffic-light cards from `C.statusCard`, each one short
   title and one sentence.
4. **Countries**: a coloured badge (`C.badge`) and one number per card; the first six show, the rest behind
   "Show all" (`C.wireShowAll`).
5. **Details on demand**: `details.more-info` ("More", "What do these mean?") and `details.method` ("How we
   calculate this") hold every number, chart, method and source.

All visitor-facing wording lives in each clock's `js/messages.js`, as pure functions that turn numbers into a
`Message` (tone, icon, title, text), with tests in `test/messages.test.js`. The page code only displays them.

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
- **clock-core:** see the release steps in its [README](../README.md#release): changelog and version in the pull
  request, then each clock bumps its pin (two URLs in `index.html`, one in `package.json`) through a pull request whose
  checks pass. A release tag is optional; the clocks pin the merge commit.
