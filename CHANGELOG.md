# Changelog

Versions follow [semantic versioning](https://semver.org/): a clock written for `v1.x.y` keeps working with any later `v1`
release; breaking changes get a new major version. Clocks pin an exact commit (or a release tag). Tags are lowercase from
`v1.1.0` on.

## v1.8.3 (2026-11)

- "Try again" now reloads the whole page, and a page showing the error reloads by itself when the device comes back
  online or the visitor returns to the tab. A phone woken from sleep could show the error and stay stuck on it,
  because retrying inside the stale page kept failing; only pulling down to refresh worked.
- `fetchText` checks with the source every time (`cache: "no-cache"`), so a bad copy kept by the browser can't keep a
  page broken. Clocks no longer wire #retry themselves: `setState("error")` does it.

## v1.8.2 (2026-11), commit `84e352e`

- Small, short phones (iPhone SE size): an even shorter stage and the answer's title only; the big counter shrinks
  so 12-digit numbers stay on one line at 320 px.

## v1.8.1 (2026-11), commit `c48c54e`

- Phones: the answer and the live number fit on the first screen. Shorter stage without the subtitle, the coloured dot
  on the same line as the answer (everywhere), only the answer's first sentence (`showAnswer` puts the rest in
  `span.answer-more`), a smaller "What can I do?", and a clock without a switch puts its "?" in the top row.

## v1.8.0 (2026-11), commit `1574546`

- "What can I do?": `wireActions` and the `Action` type: a small button under the answer opens three sourced actions.
- Visit counts: `startStats` and `track` (GoatCounter: no cookies, no personal data; never on localhost or in tests).
- Share card mode (`?embed=1&card=1`, `<html data-card>`): the widget laid out for a 1200 by 630 link preview, with the
  clock's address. Clocks refresh their preview picture weekly with it.
- New strings: `core.act.*`, `core.done`, `core.stats`.

## v1.7.0 (2026-11), commit `cff672a`

- "Add to your site" moves from the bottom of the page to the top: a small pill next to the language picker, in a
  shared `.top-tools` row (top corner on wide screens, its own row on phones). New string `core.embed.short`.
- Tablets and small windows: the header starts lower so the centred title never meets the corner tools.

## v1.6.0 (2026-11), commit `b8f5dd7`

Translation review by language: plainer, more natural French, Spanish and Arabic.

- New: `signedPct` ("+2.8%", "+2,8 %" in French), used for every signed percentage so French spacing is consistent.
- `pct` is isolated in right-to-left text, so percentages always read the same way in Arabic.
- `trendText` translates "n/a" (new key `core.na`).
- Reviewed wording of clock-core's own French, Spanish and Arabic strings (for example French "Dans le mauvais sens",
  Spanish "Casi", Arabic "عرض كل الدول").

## v1.5.0 (2026-11), commit `36b7aea`

Every clock in four languages, and as a widget for other websites.

- Languages: `LANGS`, `lang`, `locale`, `isRtl`, `asLang`, `addStrings`, `t`, `tOr`, `hasText`, `setLang`,
  `regionName`, `flagRegion`, `translatePage`, `addLangPicker`, `startLanguage`. English, French, Spanish and Arabic
  (right to left). `fmt` and `pct` follow the language; `signed` keeps its sign in front in right-to-left text.
  clock-core's own words (verdicts, "Show all", "Yearly data", errors) are translated.
- `verdict()` results now also carry a `key` ("onTrack", "close", "offTrack", "backwards"): compare that, not the text.
- Embeds: `isEmbed`, `clockUrl`, `wireEmbed` (the "Put this clock on your website" dialog, and the widget's link back).
- CSS: logical (start/end) properties throughout so pages mirror in Arabic; the globe picker; the embed dialog; the
  widget layout (`html[data-embed]`); pages stay hidden while `html[data-i18n="pending"]`.

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
