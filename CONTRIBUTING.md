# Contributing to clock-core

clock-core is the shared code behind the Emissions, Renewables and Jobs clocks. A change here reaches every clock once
they upgrade to the new release, so changes need a little more care than in a single clock.

## Setup and checks

```sh
npm install        # TypeScript checker only; clock-core has no runtime dependencies
npm run check      # house style (no em or en dashes) + types + unit tests
```

The same checks run on every pull request.

## Rules

- **Only shared things belong here.** If only one clock needs it, keep it in that clock.
- **Pure functions get tests** in `test/clock-core.test.js`, with small hand-checkable numbers.
- **Types:** every export has JSDoc types; `npm run typecheck` runs TypeScript in strict mode.
- **Don't break clocks:** changing or removing an export, or a CSS class a clock uses, is a breaking change and needs a
  new major version (`v2.0.0`). Adding is fine in a minor version.
- **Test with a real clock** before releasing: in a clock's folder, run `CLOCK_CORE_DIR=../clock-core npm run smoke`.
- **Style:** professional but approachable; no em dashes or en dashes anywhere.

## Releasing

See [README.md](README.md#release): changelog and version in the pull request, smoke-test a clock against your checkout,
then bump each clock's pin in three places (two URLs in `index.html`, one in `package.json`).

More detail in the [developer notes](docs/README.md).

## Licence

By contributing, you agree that your contributions are licensed under the [MIT licence](LICENSE).
