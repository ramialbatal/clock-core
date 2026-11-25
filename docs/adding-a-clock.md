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
   `test/`, `scripts/` (unchanged), `.github/` (unchanged), `package.json`, `jsconfig.json`, `.gitignore`, `LICENSE`,
   `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` and the `AGENTS.md` link to it (`ln -s CLAUDE.md AGENTS.md`).
3. Set the five colour variables in `theme.css`, the `smoke` settings in `package.json` (which elements must tick,
   which verdicts must show), and the texts.
4. Turn on GitHub Pages (Settings, Pages, "Deploy from a branch", `main`, `/ (root)`).
   Before you do, check that the clock-core URLs in `index.html` return 200: Pages takes over the address immediately.
5. Link it from the other clocks' footers, the personal site and the GitHub profile, and add it to "The world right now"
   (`clocks/index.html` in the website repository: its address and its name in all four languages).
6. Make it findable: add `sitemap.xml`, `llms.txt` and the `google-site-verification` meta tag (copy them from another
   clock), add the new sitemap to `robots.txt` in the website repository, then submit it in Google Search Console
   (property `https://ramialbatal.github.io/`) and request indexing for the new address.
7. Describe each dataset in the page's structured data (`isBasedOn`) with a `description` and, where known, a
   `license`; Google flags datasets without a description.

## 3. Reuse, don't copy

- **Never paste a helper into a clock that exists in clock-core** (CSV parsing, formats, sparklines, history toggle,
  sorting, ticker, help pop-up, state, verdicts). If you need something new that a second clock could use, add it to
  clock-core with a test, release a new version, and bump the clock to it.
- `theme.css` holds only the colour variables and styles truly specific to that clock.
- `config.js` holds everything someone might want to change without reading the code. Hand-entered figures get a
  comment with their source and when to update them.
- Use the same country list as the other clocks unless there's a reason not to, so pages can be compared. A country
  entry needs `code` and `flag` (and `name` where the source has no display names, as in the Jobs Clock); also update
  the country list in `llms.txt`.

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
  `ok` / `near` / `bad`). For goals measured as a pace (growth or cut per year), use `C.verdict` and its words: On
  track, Close, Off track, Going backwards. Goals of another kind may use clearer words of their own (the Jobs Clock's
  Keeping up / Close / Falling behind), as long as `ok` / `near` / `bad` mean the same thing.
- State every verdict's thresholds on the page (for example "Close means at least 85% of the pace needed").
- Colour by meaning (`.good` / `.bad`), and compare values as displayed.
- Every bar must answer "how full, out of what?". No decorative bars.
- Escape data text with `C.escapeHtml` before putting it into HTML.
- Show sources and the "fetched at" time on the page. Test at 375 px.

## 7. Plain language first

- Lead with the answer a non-technical visitor needs: is this good or bad, getting better or worse, how close are
  we? One colour (green, amber, red), a short title, one sentence. See [Page layout](how-it-works.md#page-layout-answer-first-details-on-demand).
- Show at most three traffic-light cards and one number per country card. Everything else goes behind "More".
- No jargon in what a visitor sees first ("budget", "trend", "GtCO₂", "projected" belong behind "More").
- Put all wording in `js/messages.js` (built with `C.message`) and test it.
- Write every visible word in all four languages: keys in `index.html` (`data-i18n`), words used by the code in
  `js/i18n/en.js`, translations in `fr.js`, `es.js`, `ar.js`, with `test/i18n.test.js` copied from a clock. See
  [Languages](how-it-works.md#languages).
- Give the header a scene (`js/scene.js`) that shows the topic at a glance, without getting in the way of the
  text. See [Scenes](how-it-works.md#scenes-the-picture-behind-the-header).

## 8. Writing style

- **No em dashes or en dashes**, in text, code comments, alt text, `<title>`, share descriptions and images. Use
  commas, colons, brackets, full stops, or "to" for ranges ("2015 to 2025"; in tight spaces "2015-25").
- Professional but approachable. Explain terms the first time ("carbon budget", "net new jobs").
- Say what the numbers don't show (for example, unemployment leaves out people who stopped looking).

## 9. Checklist before merging

- [ ] `npm run check` passes (style, types, unit tests); new calculations have tests.
- [ ] `npm run smoke` passes (data loads, counters tick, verdicts show, no sideways scroll at 375 px, no console errors).
- [ ] Every configured country has data, or the gap is explained.
- [ ] The page leads with a plain-language answer and at most three traffic lights; details sit behind "More".
- [ ] All four languages complete (`npm test`), and screenshots checked in Arabic (right to left) on a phone.
- [ ] `js/actions.js` has three sourced actions, in all four languages; the `clock-stats` meta, `npm run og-image`
      and `.github/workflows/og-image.yml` are in place (copy them from a clock).
- [ ] The widget (`?embed=1`) shows the answer and the counter and fits a 360 by 300 frame.
- [ ] The header scene reads at a glance and the title stays easy to read over it, on a laptop and at 375 px
      (screenshots of both), with "reduce motion" on too.
- [ ] The goal section shows target, where we should be now, actual pace and a verdict, with sources.
- [ ] Link preview image (`img/og-image.png`, 1200×630) regenerated if the header changed, and checked by eye for dashes.
- [ ] README (data, method, goal, licences) and these notes updated if anything changed.
- [ ] New clocks: sitemap, `llms.txt`, verification tag, sitemap listed in the website's `robots.txt` and submitted.
- [ ] New clocks: listed on the website's `clocks/` page, and the widget fits its 300 px frame (`npm run smoke`).
