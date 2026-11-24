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

Every clock is written for a visitor who is not technical and reads quickly (think of a grandparent or a
12-year-old opening it by chance). Top to bottom:

0. **The scene** (`canvas.scene` behind `header.top`): an animated picture that shows the topic before a word is
   read: smoke over chimneys for emissions, a sun, turbines and green hills for renewables, a town starting its working
   day for jobs. See [Scenes](#scenes-the-picture-behind-the-header).
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

## Scenes: the picture behind the header

Each clock draws its own picture in `js/scene.js`, a function returning a `Scene` (`layout` after each resize, `draw`
for each frame). `app.js` starts it with
`C.startScene(document.querySelector("canvas.scene"), myScene(), { groundAt: document.querySelector("header.top") })`.

- **Markup:** `<body class="has-scene">` with `<canvas class="scene" aria-hidden="true">` as its first child. The CSS
  makes the header a "stage" (`--stage-h`) and fades the picture into the page below it.
- **The horizon** is the bottom of the header (`f.ground`). Put landmarks (chimneys, hills, buildings) just above it,
  keep the top of the sky dark and plain for the title, and keep bright things (a sun) out of the middle column, where
  the text is. Check at 375 px wide: the stage is shorter there.
- **Cheap to draw:** build anything that depends on the size in `layout` (use `C.seeded` so it looks the same on every
  visit), pre-render soft shapes once and stamp them with `drawImage`, keep particles to a few hundred. `startScene`
  draws at 30 frames a second, caps pixel density at 2 and pauses off screen and in hidden tabs.
- **Still frames:** with "reduce motion" the scene draws once, with `dt` 0. Things that move must already be in place
  on that frame (warm up particles in `layout`), and a scene that follows the page's view (gas, source) should snap to
  it when `dt` is 0. Call the returned `redraw()` after switching the view.
- **Errors** are logged once and hide the canvas; the clock keeps working. The smoke test fails if the canvas did not
  paint.

## Languages

Every clock speaks English, French, Spanish and Arabic. Arabic is written right to left.

- **Choosing the language.** An inline script at the top of `index.html` picks it before anything is drawn: `?lang=`
  in the address, then the visitor's last choice (`localStorage` "clock-lang"), then the browser's languages, then
  English. It sets `<html lang dir>`, points the canonical address at that language, and hides the page
  (`data-i18n="pending"`) until the translation is in, so nobody sees English flash by. The globe picker
  (`addLangPicker`) saves the choice and reloads with `?lang=`, keeping the `#view`.
- **Text in the page.** Visible text in `index.html` stays in English and carries a key: `data-i18n="key"` (the
  element's HTML is replaced) or `data-i18n-attr="aria-label:key; title:key2"`. A translation keeps every element with
  an `id` or a `data-` fill attribute that the English has, so the live numbers still land in it.
- **Text from the code.** Code reads words with `C.t("key", { n: 3 })`. Each clock keeps them in `js/i18n/en.js`
  (registered with `addStrings` in `messages.js`). Words that live in `config.js` (a gas's name) use
  `C.tOr("gas.ch4.label", gas.label)`. Never compare translated text: compare keys (verdicts have `verdict.key`).
- **Translations.** `js/i18n/fr.js`, `es.js`, `ar.js` hold every `en.js` key and every page key. They load on demand
  (`startLanguage`), and `test/i18n.test.js` checks each has every key, the same `{placeholders}` and the same ids
  and `data-` slots. Formulas may stay in their Latin symbols.
- **Numbers and names.** `setLang` switches `fmt` and `pct` to the language (French `1 234,5`, Spanish `1.234,5`;
  Arabic keeps Western digits so counters stay readable). `signed` isolates its sign in right-to-left text. Country
  names come from the browser (`regionName(flagRegion(flag), englishName)`), so config.js needs no translations.
- **Right to left.** clock-core.css uses start/end (logical) properties, so layouts mirror by themselves; numbers stay
  left to right. In page code, position things with `style.insetInlineStart`, never `left`.
- **Search engines.** Each page lists its languages with `<link rel="alternate" hreflang>` and the sitemap lists the
  `?lang=` addresses.

## Embeds: the clock on other websites

`?embed=1` turns a clock into a small widget: the scene strip with the clock's name, the coloured answer and the live
number, plus "Open the full clock". The inline script marks it (`<html data-embed>`) and clock-core.css hides the
rest. `wireEmbed(footer)` adds a small "Add to your site" button to the top row, next to the language picker (the
footer is only a fallback); it opens "Put this clock on your website": a dialog with the one-line
`<iframe>` code (in the language and view on screen), a Copy button and a live preview. The smoke test checks the
widget fits a 360 by 300 frame.

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
| `npm run smoke` | Serves the clock, opens it in Chromium at 1280 and 375 px, checks data loads, counters tick, verdicts show, the header picture paints, each language (Arabic right to left) and the widget, no sideways scroll, no dashes, no console errors | clocks |

`CLOCK_CORE_DIR=../clock-core npm run smoke` serves clock-core from a local checkout instead of the CDN, to test a
clock-core change before releasing it. The weekly scheduled run catches data sources that changed or went away.

## Publishing

- **A clock:** merge to `main`; GitHub Pages updates in a minute or two.
- **clock-core:** see the release steps in its [README](../README.md#release): changelog and version in the pull
  request, then each clock bumps its pin (two URLs in `index.html`, one in `package.json`) through a pull request whose
  checks pass. A release tag is optional; the clocks pin the merge commit.
