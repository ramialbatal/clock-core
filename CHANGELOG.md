# Changelog

Versions follow [semantic versioning](https://semver.org/): a clock written for `v1.x.y` keeps working with any later `v1`
release; breaking changes get a new major version. Clocks pin an exact commit (or a release tag). Tags are lowercase from
`v1.1.0` on.

## v1.4.0 (2026-11)

Scenes: an animated picture behind the top of each clock, so the page shows what it is about at a glance.

- New: `startScene` (returns `stop` and `redraw`; handles pixel density, resizing, pauses off screen and in hidden tabs, a still frame for "reduce
  motion", errors hide the picture and leave the page working), `seeded` (repeatable random numbers for layouts),
  `SceneFrame` and `Scene` types.
- CSS: `.has-scene` and `.scene`: the header becomes a stage for the picture, which fades into the page below it;
  text on top of it gets a dark backing.

## v1.3.0 (2026-11), commit `ec72aee`

The plain-language design, shared by all clocks: answer first, a few traffic lights, details on demand.

- New: `Tone` and `Message` types, `TONE_ICON`, `message`, `showAnswer`, `statusCard`, `badge`, `wireShowAll`.
- CSS: answer banner, traffic-light status cards, badges, "More" fold-outs (`details.more-info`), "Show all" list,
  folding "How we calculate this" (`details.method`). Markup is documented at the top of that CSS block.

## v1.2.0 (2026-11), commit `93c4576`

- New shared helpers, moved out of the clocks: `restOfWorld` (lagging places count with their projection; never
  below 0), `changeClass` (good / bad / neutral, as displayed) and `trendText` ("▲ +1.2%").
- Docs: no hard-coded pins in examples; verdict thresholds documented; fixes from a newcomer-agent review.

## v1.1.0 (2026-11), commit `a797dbe`

Fixes from a full code review. No breaking changes.

- Ticker: an error in the callback is logged and the clock keeps ticking (it used to stop for good).
- Data: `parseCsv` handles line breaks inside quoted cells; new strict `num`; `seriesByCode` skips bad years and
  partly numeric cells (they used to become NaN or a wrong number), keeps the first of duplicate rows, takes a `where`
  filter; new `namesByCode`; `fetchText` reports HTTP errors for relative URLs correctly.
- Models: `project` uses the nearest year inside the trend window when one is missing (it used to fall back to the
  whole history) and returns 0 growth for non-positive values; `neededGrowth` handles a passed deadline; `verdict`
  works for falling goals and treats flat growth as "Off track", not "Going backwards".
- Display: new `shown` and `shownSign` to compare values as displayed; `signed`, `sparkline` and verdicts follow that
  rule; `sparkline` places points by year and takes a screen-reader `label`; `sortInto` puts missing values last;
  `showVerdict` keeps other classes; `setState` shows a generic message for an empty error.
- CSS: merged duplicate rules; "reduce motion" now also stops the fade, pop-up and button animations.
- Tooling: `npm test` works on Node 20 and Windows (`node --test`).

## v1.0.0 (2026-11), tagged `V1.0.0`, commit `7f64264`

First release as a standalone package, moved out of the `shared/` folder of `ramialbatal.github.io`.

- ES module with named exports (no globals), JSDoc types checked by TypeScript.
- New: `escapeHtml`, `seriesByCode`, `interpolateMidYear`, `showVerdict`; `project` takes an optional year for testing.
- Unit tests for formats, CSV parsing, models and verdicts (`npm test`).
- `clock-core.css` (was `clock-base.css`); the Emissions Clock's diagram styles moved to that clock.
