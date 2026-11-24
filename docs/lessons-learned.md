# Lessons learned

Things that didn't work the first time, why, and what we do now. Most of them were silent: the page loaded, but the
numbers were wrong or a country was missing. Check this list before adding a data source.

## Data sources

### A redirect broke cross-origin loading
- **What happened:** the Renewables Clock first used OWID's `electricity-prod-source-stacked` chart. The browser
  refused to load it ("blocked by CORS policy"), although the same URL worked with `curl`.
- **Why:** that slug now answers with a 301 redirect to `electricity-mix?...`, and the redirect response has no
  `Access-Control-Allow-Origin` header. Browsers check the header on every hop.
- **Now:** use the final URL directly. When adding a source, run
  `curl -sI "<url>" | grep -iE '^(HTTP|location|access-control)'` and make sure there is no redirect and the CORS
  header is there.

### The "filtered" CSV silently dropped a country
- **What happened:** Saudi Arabia was missing from the Renewables Clock, with no error.
- **Why:** OWID's `csvType=filtered` drops every year that has any blank cell. Saudi Arabia has no hydro figure, so all
  its recent years disappeared. A `time=` filter made it worse.
- **Now:** for multi-column data, download `csvType=full` (about 150 KB compressed here) and filter rows in the browser.
  After loading, each clock logs configured countries with no data, with a `console.warn` that starts "No" and ends
  "data for:" (for example "No emissions data for: SAU"); the smoke test fails on it. Keep that check in new clocks.

### Multi-dimension charts ignore the country filter after a redirect
- **What happened:** some redirected chart URLs returned every country even with `country=~CHN~USA`.
- **Now:** always filter by code in code, even when you also filter in the URL.

### Carried-forward values
- **What happened:** some OWID charts (for example the electricity share charts) add an `…__original_year` column.
  A "2025" row can really be the 2024 value repeated.
- **Now:** prefer charts without that column. If you must use one, treat a row whose `original_year` differs from its
  year as missing, or trends will be wrong.

### Capacity vs generation
- The COP28 goal is about **installed capacity** (GW), but the Renewables Clock counts **generation** (TWh). Tracking
  the goal needed a second source (IRENA via OWID's indicator API). Check that a goal and the data use the same measure.

### Units and scales differ between sources
- ILO figures are in **thousands** of people; OWID CO₂ is in **tonnes**; electricity is in **TWh**; capacity is in
  **GW**. Convert once, right after loading, and name the unit in variable names or comments.

### Some figures are not in any API
- The remaining carbon budgets are only published in the Global Carbon Budget key messages (a PDF), and the PDF does
  not say which date they count from. We followed the convention of each edition (counting from 1 January of the next
  year) and said so on the page. **Hand-entered figures need a comment saying where they came from and when to update
  them.**

### Gross job flows don't exist globally
- "Jobs created vs jobs lost" isn't measured for the world. We used net change and said so on the page, instead of
  presenting net change as if it were gross hiring.

## Models

### Compounding from a tiny base explodes
- **What happened:** Saudi solar grew 163% in its latest year. Projected two years ahead, that tripled the estimate.
- **Now:** the Renewables Clock caps projection growth at 50% a year (`maxGrowth`), while the card still shows the real
  trend. Any clock that compounds growth over more than one year needs a cap.

### Ratios break when the denominator changes sign
- Jobs per new worker is meaningless when the workforce shrinks (EU, Japan, China). Those countries are judged on
  whether unemployment falls instead, and sorting places them sensibly.

### Per-country versions of global goals can mislead
- Tripling each country's own capacity isn't what COP28 asked for: hydro-rich countries like Canada or Brazil aren't
  expected to triple. We show it as a rough guide and say so.

## Display

### Numbers that never move
- The carbon budget "Gt left" with three decimals changed once every 12 minutes. Now it's in tonnes. **Pick the unit
  from the rate:** the last displayed digit should change at least about once a second.

### Colours that contradict the numbers
- India showed "4.2% (4.2%)" in red, because the unrounded rates differed by 0.03. Compare values as displayed.
- The "since you opened this page" counter showed "-0". clock-core's `signed` now drops the sign on a rounded zero.

### Bars that measure nothing
- A full-width bar under "unemployed now" looked meaningful but wasn't. Every bar must answer "how full, out of what?".
  Remove decoration that looks like data.

### Dashes
- The house style forbids em and en dashes. They also hide in **images** (the old Emissions Clock preview image had
  one) and in **JavaScript strings** used as placeholders. `npm run style` checks every text file and the smoke test
  checks the rendered page; check images by eye.
- Writing the dash characters into the style checker itself made it flag its own source. It builds them from
  character codes instead.

## Code

### Copy-paste clocks
- The second and third clocks started as copies of the first. Within a day, a fix had to be made three times. Shared
  code now lives in clock-core, loaded from a pinned release.

### Untested arithmetic
- The carbon budget's "emissions between two dates" was wrong when the start date fell mid-year. The page never hit
  that case, but a unit test did. Calculations now live in `js/model.js` with tests written from hand-checked numbers.

### Units chosen without checking the rate
- Renewable capacity grows about 25 kW a second, so a counter in MW changed once every 40 seconds. The smoke test now
  fails any live number that doesn't change within a few seconds.

### Redrawing every frame
- The first versions rewrote every number about 60 times a second. Now the ticker runs about 10 times a second and
  `setText` skips unchanged values.

### Pictures behind text
- The first renewables scene put the sun right behind the subtitle on phones, where the stage is shorter. Scenes now
  keep bright things low and to the side, and every scene is checked in screenshots at laptop and phone width.
- Thin, pale smoke read as friendly clouds, and a clean orange sun as a pretty sunset. To say "this is bad", the
  emissions scene needed dense, dark plumes coming visibly out of chimneys and a dim sun behind brown haze.
- Tiny dark figures in front of dark buildings were invisible. People in the jobs scene wear coloured clothes.

### Translating without breaking the logic
- The emissions page decided its headline by comparing the verdict's text with "Off track". Once verdicts were
  translated, that comparison would have silently failed in every other language. Verdicts now carry a `key`, and
  code compares keys, never words.
- A local variable named `t` (time) hid the translate function `t` inside two functions. The type checker caught it;
  name time variables `ty` or `now`.
- Translated paragraphs can drop the element a live number is written into, and the page then fails quietly. The
  i18n test compares each translation's ids and `data-` slots with the English, and the smoke test compares the ids on
  the translated page.
- Arabic numbers: the browser's default Arabic format uses Eastern Arabic digits, which made counters jump in width.
  The Arabic locale is `ar-u-nu-latn` (Western digits), and a leading + or - is kept in front with isolation marks.

### Year rollover
- `YEAR` is read once at page load. A tab open across New Year kept counting the old year. The ticker now reloads the
  page when the year changes.

## From the full code review (November 2026)

A review of all four repositories found about 80 issues. None had visibly broken a page, but several would have. The
patterns worth remembering:

- **Compare values as displayed, everywhere.** About ten places coloured or judged a raw number while showing a
  rounded one ("0.0 pts" in green, "about 10.0 years" in red). Use `shown` / `shownSign` from clock-core for every
  colour, arrow, word ("up from" / "down from") and verdict.
- **Words must follow the numbers.** "Up from 16.2%" was hard-coded and became wrong when the hydro share fell.
- **Countries whose data lags behind** the world's latest year were counted as zero, inflating "Rest of world". Use
  each country's projection for the missing year, and only subtract years every country has.
- **Pre-filled future rows:** OWID fills some not-yet-reported years with a few zeros; a row with fewer than half its
  cells filled is treated as not reported.
- **Switching views must never show one view's numbers under another's labels:** show the spinner until the new
  view's data has loaded the first time.
- **Optional data must not block the page**, and "Try again" must retry it too.
- **One error must not freeze the page:** the ticker logs errors and keeps going; a page whose code can't load (CDN
  down, old browser) shows the error box instead of spinning forever.
- **CSS rules of equal weight: the later one wins.** A colour for "jobs lost" was silently overridden.
- **Strict parsing:** `parseFloat("1,234")` is 1, and a blank year becomes year 0. Use `num` and let bad cells be
  skipped.
- **Every setting in `config.js` must be read by the code**, and every calculation must live in `model.js` with a test.

### CSS errors are silent
- Moving the plain-language styles into clock-core left a stray `*/` after a comment. Browsers skip the broken rule
  without any error, and the next rule was the one defining the tone colours, so every banner, card and badge lost
  its colour while all tests passed. Now a clock-core test checks that comments and braces in `clock-core.css`
  balance, and the smoke test fails if the answer banner has no colour stripe.

## Releasing

### Tag names are case-sensitive
- The first clock-core release was created as `V1.0.0`, while the clocks asked jsDelivr for `v1.0.0`, which returned
  404. Because GitHub Pages switched the addresses over as soon as Pages was turned on, two live clocks were briefly
  broken. Fix: pin the exact commit. Lessons: check the CDN URL returns 200 **before** turning on Pages, and use
  lowercase tags (`v1.1.0`).

## Tooling

- **Test in a real browser through a local server** (`npm run serve`), not by opening the file: CORS, ES modules
  and relative paths don't work on `file://`. `npm run smoke` does this automatically, including phone width and
  checking that counters tick.
- **Check the type checker really runs:** a first clean pass can mean it isn't looking at your files. Introduce a
  deliberate error once and see it fail.
- GitHub Pages only serves `main`. Changes on a branch are invisible until merged.
