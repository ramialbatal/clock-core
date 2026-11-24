# Adding a clock (or a feature)

Rules and a checklist for new work, so the clocks stay consistent, fast and honest. If a rule gets in the way, change
the rule here first rather than quietly breaking it in one clock.

## 1. Before writing code: the data

- **Find an official, comparable source** for every country you show (UN agencies, IEA/IRENA, Global Carbon Project,
  ILO, World Bank). Prefer one request that covers all countries over one request per country.
- **Check it loads in a browser:**
  ```
  curl -sI "<url>" | grep -iE '^(HTTP|location|access-control)'
  ```
  You need `HTTP 200` (no redirect) and `access-control-allow-origin: *`. If there's a redirect, use the final URL.
- **Check coverage:** every configured country, the years you need, and the world aggregate. Look for blank cells and
  carried-forward values (see [Lessons learned](lessons-learned.md#data-sources)).
- **Check size:** under about 200 KB compressed per request is fine:
  `curl -s -H 'Accept-Encoding: gzip, br' -o /dev/null -w '%{size_download}\n' "<url>"`.
- **Check the licence** and record it in the README's licence table and the page's structured data.
- **Find the goal at the same time.** Prefer a target governments signed up to (Paris, COP, UN SDGs). Make sure the
  goal and the data measure the same thing (capacity vs generation, net vs gross). If no numeric target exists, say
  so and show direction instead.

## 2. A new clock: start from an existing one

1. Create an empty public repository named `<topic>-clock`.
2. Copy the structure of the closest clock: `index.html`, `css/theme.css`, `js/config.js`, `js/model.js`, `js/app.js`,
   `test/`, `scripts/` (unchanged), `.github/` (unchanged), `package.json`, `jsconfig.json`, `LICENSE`,
   `CONTRIBUTING.md`, `CLAUDE.md`.
3. Set the five colour variables in `theme.css`, the `smoke` settings in `package.json` (which elements must tick,
   which verdicts must show), and the texts.
4. Turn on GitHub Pages (Settings, Pages, "Deploy from a branch", `main`, `/ (root)`).
5. Link it from the other clocks' footers, the personal site and the GitHub profile.

## 3. Reuse, don't copy

- **Never paste a helper into a clock that exists in clock-core** (CSV parsing, formats, sparklines, history toggle,
  sorting, ticker, help pop-up, state, verdicts). If you need something new that a second clock could use, add it to
  clock-core with a test, release a new version, and bump the clock to it.
- `theme.css` holds only the colour variables and styles truly specific to that clock.
- `config.js` holds everything someone might want to change without reading the code. Hand-entered figures get a
  comment with their source and when to update them.
- Use the same country list as the other clocks unless there's a reason not to, so pages can be compared.

## 4. Reading data well

- Wrap each loader in `C.once()` so it runs once and "Try again" works; load independent sources in parallel.
- Make secondary data optional: if it fails, hide its section and keep the clock working.
- Convert units once, right after parsing (`C.seriesByCode(..., { scale: 1000 })` for "thousands of people").
- Filter by country code in code, even if the URL filters too. Log configured countries that came back empty.
- Don't keep data in `localStorage` or cookies: the sources update themselves, and stale copies would show old numbers.

## 5. Modelling honestly

- Put every calculation in `js/model.js` as a pure function, and add a test with small hand-checkable numbers.
- Use `C.project()` for "latest year grown by the latest trend". Set `maxGrowth` when a series can grow fast from a
  small base. If the source already publishes estimates for this year (like the ILO), use them instead.
- Make yearly figures continuous the same way across clocks: flows are spread evenly over the year; stocks of people
  use `C.interpolateMidYear`; end-of-year stocks (capacity) sit at 1 January of the next year.
- Put the formula on the page in plain words, and say "this is a model, not a measurement".
- Every verdict must be reproducible from numbers shown on the page.

## 6. Displaying data well

- One `C.startTicker()` per page; inside it, update with `C.setText` only. No `setInterval`, no extra animation loops.
- Pick units so the last digit of each live number moves at least about once a second. The smoke test checks it.
- Use the shared goal markup (`.goal`, `.goal-row`, `.goal-bar` with `<i>` fill and `<span>` marker, `.verdict` with
  `ok` / `near` / `bad`) and the same verdict words: On track, Close, Off track, Going backwards.
- Colour by meaning (`.good` / `.bad`), and compare values as displayed.
- Every bar must answer "how full, out of what?". No decorative bars.
- Escape data text with `C.escapeHtml` before putting it into HTML.
- Show sources and the "fetched at" time on the page. Test at 375 px.

## 7. Writing style

- **No em dashes or en dashes**, in text, code comments, alt text, `<title>`, share descriptions and images. Use
  commas, colons, brackets, full stops, or "to" for ranges ("2015 to 2025"; in tight spaces "2015-25").
- Professional but approachable. Explain terms the first time ("carbon budget", "net new jobs").
- Say what the numbers don't show (for example, unemployment leaves out people who stopped looking).

## 8. Checklist before merging

- [ ] `npm run check` passes (style, types, unit tests); new calculations have tests.
- [ ] `npm run smoke` passes (data loads, counters tick, verdicts show, no sideways scroll at 375 px, no console errors).
- [ ] Every configured country has data, or the gap is explained.
- [ ] The goal section shows target, where we should be now, actual pace and a verdict, with sources.
- [ ] Link preview image (`img/og-image.png`, 1200×630) regenerated if the header changed, and checked by eye for dashes.
- [ ] README (data, method, goal, licences) and these notes updated if anything changed.
