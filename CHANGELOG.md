# Changelog

Versions follow [semantic versioning](https://semver.org/): a clock pinned to `v1.x.y` keeps working with any later
`v1` release; breaking changes get a new major version.

## v1.0.0 (2026-11)

First release as a standalone package, moved out of the `shared/` folder of `ramialbatal.github.io`.

- ES module with named exports (no globals), JSDoc types checked by TypeScript.
- New: `escapeHtml`, `seriesByCode`, `interpolateMidYear`, `showVerdict`; `project` takes an optional year for testing.
- Unit tests for formats, CSV parsing, models and verdicts (`npm test`).
- `clock-core.css` (was `clock-base.css`); the Emissions Clock's diagram styles moved to that clock.
