# Changelog

Versions follow [semantic versioning](https://semver.org/): a clock written for `v1.x.y` keeps working with any later `v1`
release; breaking changes get a new major version. Clocks pin an exact commit (or a release tag). Tags are lowercase from
`v1.1.0` on.

## v1.1.0 (2026-11)

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
