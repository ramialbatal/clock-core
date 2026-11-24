# Developer notes

How the clocks were built, how they work, what went wrong along the way, and the rules for adding to them. These
notes cover clock-core and all three clocks.

| Project | Live page | Repository |
|---|---|---|
| Emissions Clock | https://ramialbatal.github.io/emissions-clock/ | [ramialbatal/emissions-clock](https://github.com/ramialbatal/emissions-clock) |
| Renewables Clock | https://ramialbatal.github.io/renewables-clock/ | [ramialbatal/renewables-clock](https://github.com/ramialbatal/renewables-clock) |
| Jobs Clock | https://ramialbatal.github.io/jobs-clock/ | [ramialbatal/jobs-clock](https://github.com/ramialbatal/jobs-clock) |
| Shared code | | [ramialbatal/clock-core](https://github.com/ramialbatal/clock-core) (this repository) |

## Read in this order

1. [How we built it](how-we-built-it.md): the story and the main decisions, in the order they were made.
2. [How it works](how-it-works.md): repositories, files, data flow, the models behind each counter and goal bar.
3. [Lessons learned](lessons-learned.md): what didn't work, and what we changed because of it. Read this before
   touching any data source.
4. [Adding a clock](adding-a-clock.md): rules and a checklist for new clocks or features, so we don't duplicate code,
   read data badly or show numbers that mislead.

## The short version

- **Static pages, no server, no build step.** Each clock is plain HTML, CSS and ES modules. Data is fetched live in
  the visitor's browser from public APIs that allow cross-origin requests.
- **Official yearly data, turned into a live counter.** A yearly figure is projected to this year where needed and
  spread evenly over the year. The counters are a model, not a measurement, and every page says so.
- **Every counter needs a reference point.** Each clock has a goal section: a bar that fills toward an official
  target, a pace check, and a verdict badge.
- **One shared core, pinned by version.** Helpers used by more than one clock live in clock-core and are loaded from a
  release (`clock-core@v1.0.0`). Never copy them into a clock.
- **Tested.** Calculations are pure functions in each clock's `js/model.js`, with unit tests. A smoke test opens every
  page in a real browser with real data. Both run on every pull request.
- **House style:** no em dashes or en dashes anywhere (text, code comments, images). `npm run style` checks it.
