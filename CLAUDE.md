# Notes for AI assistants working in this repository

- This is clock-core: the shared ES module (`clock-core.js`) and stylesheet (`clock-core.css`) used by the Emissions,
  Renewables and Jobs clocks (separate repositories). Read `docs/README.md`, then `docs/lessons-learned.md` and
  `docs/adding-a-clock.md`, before changing anything.
- No runtime dependencies, no build step. Every export has JSDoc types; keep `npm run typecheck` clean.
- Add a unit test in `test/clock-core.test.js` for every change to a pure function.
- Changing or removing an export or CSS class is a breaking change (new major version). Update `CHANGELOG.md` and
  `package.json` `version` with every change.
- Before finishing: `npm run check`, and run a clock's smoke test against this checkout
  (`CLOCK_CORE_DIR=../clock-core npm run smoke` in the clock's folder).
- Writing style: no em dashes or en dashes anywhere (text, comments, images). Professional but approachable.
