// @ts-check
/**
 * clock-core: shared, dependency-free helpers for live data clocks
 * (Emissions Clock, Renewables Clock, Jobs Clock).
 *
 * Plain ES module, no build step. Clocks import it from jsDelivr, pinned to an exact commit or a release tag:
 *   import * as C from "https://cdn.jsdelivr.net/gh/ramialbatal/clock-core@<commit-or-tag>/clock-core.js";
 * (each clock maps the bare name "clock-core" to that URL with an import map).
 *
 * Sections: Time · Formatting · Data · Models · Rendering · Ticker · Page.
 * Pure functions (everything up to Rendering) also run in Node and are unit tested in test/clock-core.test.js.
 * The DOM helpers (Rendering, Ticker, Page) need a browser.
 */

/** @typedef {Record<number, number>} Series  Values by year, e.g. { 2024: 38.6e9, 2025: 39.0e9 }. */

/**
 * @typedef {object} Projection
 * @property {number[]} years      Years with data, ascending.
 * @property {number} lastYear     Latest year with data.
 * @property {number} lastValue    Value in the latest year.
 * @property {number} trendFrom    Start year of the trend window.
 * @property {number} growth       Real average yearly growth over the window (0.05 = 5%).
 * @property {number} gUsed        Growth used for projecting (growth, capped at maxGrowth).
 * @property {number} annual       Value for the current year (official or projected).
 * @property {(year: number) => number} at  Value for any year (official if known, else projected).
 * @property {Series} series       The input series.
 */

/**
 * A goal verdict. `cls` drives the badge colour: ok (green), near (amber), bad (red), "" (neutral).
 * @typedef {{ cls: "ok" | "near" | "bad" | "", text: string }} Verdict
 */

// ---- Time (all UTC) --------------------------------------------------------

/** The current year, read once at load. The ticker reloads the page when it changes. */
export const YEAR = new Date().getUTCFullYear();

/** @param {number} y */
export const yearStart = (y) => Date.UTC(y, 0, 1);

/** @param {number} y */
export const msPerYear = (y) => yearStart(y + 1) - yearStart(y);

/** Seconds in the current year. */
export const SEC_PER_YEAR = msPerYear(YEAR) / 1000;

/** Fraction of the current year elapsed, 0 to 1. */
export const yearFraction = (ms = Date.now()) => (ms - yearStart(YEAR)) / msPerYear(YEAR);

/** A moment as fractional years, e.g. 2026.89. */
export function tYears(ms = Date.now()) {
  const y = new Date(ms).getUTCFullYear();
  return y + (ms - yearStart(y)) / msPerYear(y);
}

// ---- Formatting --------------------------------------------------------------

/** @param {number} d */
const nf = (d) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Number formats with 0 to 3 decimals, e.g. fmt[1].format(4.25) === "4.3". */
export const fmt = /** @type {const} */ ({ 0: nf(0), 1: nf(1), 2: nf(2), 3: nf(3) });

/**
 * A value rounded the way it will be displayed with `d` decimals. Compare and colour with this,
 * never with the raw value, so "4.2% (4.2%)" can't show in red and "0.0" can't show in green.
 * @param {number} x
 * @param {number} [d]
 */
export function shown(x, d = 0) {
  const r = Math.round(x * 10 ** d) / 10 ** d;
  return r === 0 ? 0 : r;   // no -0
}

/**
 * Sign of a value as displayed with `d` decimals: 1, -1 or 0.
 * @param {number} x
 * @param {number} [d]
 */
export const shownSign = (x, d = 0) => Math.sign(shown(x, d));

/**
 * "+1,234" or "-1,234" (plain hyphen). No sign when the value rounds to zero.
 * @param {number} x
 * @param {Intl.NumberFormat} [f]
 */
export function signed(x, f = fmt[0]) {
  const s = f.format(Math.abs(x));
  return (/[1-9]/.test(s) ? (x > 0 ? "+" : "-") : "") + s;
}

/**
 * @param {number} x  Percentage value (4.9 means 4.9%).
 * @param {0|1|2|3} [d]
 */
export const pct = (x, d = 1) => fmt[d].format(x) + "%";

/**
 * Wrap each digit in a span so big counters don't jitter as digits change width.
 * @param {string} s
 */
export const digits = (s) => s.replace(/[0-9]/g, (d) => `<span class="d">${d}</span>`);

/**
 * Escape text before putting it inside HTML.
 * @param {unknown} s
 */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

// ---- Data ------------------------------------------------------------------------

const BOM = String.fromCharCode(0xfeff);

/**
 * CSV parser (RFC 4180): quoted cells, doubled quotes, commas and line breaks inside quotes, a leading BOM.
 * Returns one object per row, keyed by header; missing cells are "".
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let cur = "", q = false;
  const s = text.startsWith(BOM) ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const [head = [], ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/** @param {string} url */
export async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let host = url;
    try { host = new URL(res.url || url, globalThis.location?.href).hostname; } catch { /* keep the raw URL */ }
    throw new Error(`HTTP ${res.status} from ${host}`);
  }
  return res.text();
}

/** @param {string} url */
export const fetchCsv = async (url) => parseCsv(await fetchText(url));

/** @param {string} url */
export const fetchJson = async (url) => JSON.parse(await fetchText(url));

/**
 * Memoise an async loader. A failure clears the cache so "Try again" refetches.
 * @template T
 * @param {() => Promise<T>} loader
 * @returns {() => Promise<T>}
 */
export function once(loader) {
  /** @type {Promise<T> | null} */
  let p = null;
  return () => (p ||= loader().catch((err) => { p = null; throw err; }));
}

/**
 * Strict number parsing: "" and partly numeric cells ("1,234", "12e", "n/a") give NaN instead of a wrong value.
 * @param {string | undefined} s
 */
export const num = (s) => (s == null || s.trim() === "" ? NaN : Number(s));

/**
 * Turn rows into { code: { year: value } }, keeping only wanted codes, whole years from `fromYear`,
 * finite values, and rows passing `where`. A repeated code and year keeps the first row and warns.
 * @param {Record<string, string>[]} rows
 * @param {{ code: string, year: string, value: string, wanted?: Iterable<string>, fromYear?: number, scale?: number,
 *   where?: (row: Record<string, string>) => boolean }} cols
 * @returns {Record<string, Series>}
 */
export function seriesByCode(rows, { code, year, value, wanted, fromYear = -Infinity, scale = 1, where }) {
  const keep = wanted ? new Set(wanted) : null;
  /** @type {Record<string, Series>} */
  const out = {};
  let dupes = 0;
  for (const r of rows) {
    const c = r[code], y = num(r[year]), v = num(r[value]);
    if (!c || (keep && !keep.has(c)) || !Number.isInteger(y) || y < fromYear || !Number.isFinite(v)) continue;
    if (where && !where(r)) continue;
    const s = (out[c] ||= {});
    if (y in s) { dupes++; continue; }
    s[y] = v * scale;
  }
  if (dupes) console.warn(`seriesByCode: ${dupes} repeated code/year rows ignored (filter them with "where")`);
  return out;
}

/**
 * Display names by code, e.g. { CHN: "China" }, from rows with a code and a name column.
 * @param {Record<string, string>[]} rows
 * @param {{ code: string, name: string, wanted?: Iterable<string> }} cols
 * @returns {Record<string, string>}
 */
export function namesByCode(rows, { code, name, wanted }) {
  const keep = wanted ? new Set(wanted) : null;
  /** @type {Record<string, string>} */
  const out = {};
  for (const r of rows) if (r[code] && (!keep || keep.has(r[code])) && !(r[code] in out)) out[r[code]] = r[name];
  return out;
}

// ---- Models --------------------------------------------------------------------

/** @param {Series} series */
const sortedYears = (series) => Object.keys(series).map(Number).sort((a, b) => a - b);

/**
 * Latest-year projection: growth = average yearly change from the start of the trend window
 * (the earliest year at or after last - n) to the latest year, capped at maxGrowth for projecting;
 * value(Y) = value(last) * (1 + growth)^(Y - last). Growth is 0 when either end is not positive.
 * @param {Series} series
 * @param {number} [n]          Trend window in years (1 = latest year-on-year change).
 * @param {number} [maxGrowth]  Cap on the growth used for projecting (0.5 = 50% a year).
 * @param {number} [year]       The "current" year (defaults to YEAR; set it in tests).
 * @returns {Projection}
 */
export function project(series, n = 1, maxGrowth = Infinity, year = YEAR) {
  const years = sortedYears(series);
  const last = years[years.length - 1];
  const first = years.find((y) => y >= last - n) ?? last;
  const growth = last > first && series[first] > 0 && series[last] > 0
    ? Math.pow(series[last] / series[first], 1 / (last - first)) - 1 : 0;
  const gUsed = Math.min(growth, maxGrowth);
  /** @param {number} y */
  const at = (y) => series[y] ?? series[last] * Math.pow(1 + gUsed, y - last);
  return { years, lastYear: last, lastValue: series[last], trendFrom: first, growth, gUsed, annual: at(year), at, series };
}

/**
 * Level at fractional year t from yearly averages placed at mid-year (2026 -> 2026.5),
 * joined by straight lines and extended along the nearest segment at the ends.
 * @param {Series} series
 * @param {number} t
 */
export function interpolateMidYear(series, t) {
  const pts = sortedYears(series).map((y) => [y + 0.5, series[y]]);
  if (pts.length === 0) return NaN;
  if (pts.length === 1) return pts[0][1];
  let i = pts.findIndex(([x]) => x > t);
  if (i <= 0) i = i === 0 ? 1 : pts.length - 1;
  const [x0, v0] = pts[i - 1], [x1, v1] = pts[i];
  return v0 + ((v1 - v0) / (x1 - x0)) * (t - x0);
}

/**
 * Yearly growth needed to go from `from` to `to` in `years` years. At or past the deadline:
 * 0 if the target is already met (from >= to for a rising target), Infinity if not.
 * @param {number} from
 * @param {number} to
 * @param {number} years
 */
export function neededGrowth(from, to, years) {
  if (years > 0) return Math.pow(to / from, 1 / years) - 1;
  return from >= to ? 0 : Infinity;
}

/**
 * Verdict from actual vs needed change, in the target's direction (works for rising and falling goals):
 *   On track: at least as fast as needed. Close: within nearBand of it. Off track: right direction, too slow.
 *   Going backwards: moving the wrong way.
 * Pass values as displayed (see `shown`) so the verdict matches the numbers on the page.
 * @param {number} actual  e.g. growth per year (0.155) or change so far (-0.02)
 * @param {number} needed  same unit; negative for a reduction goal
 * @param {number} [nearBand]
 * @returns {Verdict}
 */
export function verdict(actual, needed, nearBand = 0.85) {
  const dir = needed < 0 ? -1 : 1;          // which way the goal wants things to move
  const a = actual * dir, n = needed * dir;  // flip a reduction goal into a rising one
  if (a >= n) return { cls: "ok", text: "On track" };
  if (a < 0) return { cls: "bad", text: "Going backwards" };
  if (a >= n * nearBand && a > 0) return { cls: "near", text: "Close" };
  return { cls: "bad", text: "Off track" };
}

// ---- Rendering (returns HTML strings or touches given elements) ---------------------

/**
 * Small line chart for a card header. Points are placed by year, so gaps show as gaps in time.
 * The caption colour follows `good` ("up" or "down" is good) and the change as displayed in `changeText`:
 * a change that displays as zero stays neutral.
 * @param {number[]} years
 * @param {number[]} values
 * @param {{ caption?: string, change?: number | null, changeText?: string, good?: "up" | "down",
 *   title?: string, label?: string }} [opts]  `label` is read by screen readers, e.g. "Annual emissions 2015 to 2025, +35%".
 */
export function sparkline(years, values, { caption = "", change = null, changeText = "", good = "up", title = "Show yearly values", label = "" } = {}) {
  if (values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const W = 120, H = 28, y0 = years[0], yspan = years[years.length - 1] - y0 || 1;
  const xy = values.map((v, i) => [((years[i] - y0) / yspan) * W, H - 3 - ((v - min) / span) * (H - 6)]);
  const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  const nonZero = changeText ? /[1-9]/.test(changeText) : change !== 0;
  const isGood = change == null || !nonZero ? null : (change > 0) === (good === "up");
  return `<figure class="spark-wrap" title="${escapeHtml(title)}">
      <svg class="spark" viewBox="-2 0 ${W + 4} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${pts}"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.2"/>
      </svg>
      <figcaption aria-hidden="${label ? "true" : "false"}">${escapeHtml(caption)} <b class="${isGood == null ? "" : isGood ? "up" : "down"}">${escapeHtml(changeText)}</b></figcaption>
      ${label ? `<span class="sr-only">${escapeHtml(label)}</span>` : ""}
    </figure>`;
}

/**
 * Wire a card's "Yearly data" button (and its line chart) to show or hide the history table.
 * @param {HTMLElement} card
 */
export function wireHistory(card) {
  const btn = card.querySelector(".more"), h = /** @type {HTMLElement | null} */ (card.querySelector(".history"));
  if (!btn || !h) return;
  const toggle = () => {
    h.hidden = !h.hidden;
    btn.setAttribute("aria-expanded", String(!h.hidden));
    if (btn.firstChild) btn.firstChild.textContent = h.hidden ? "Yearly data " : "Hide yearly data ";
    btn.classList.toggle("open", !h.hidden);
  };
  btn.addEventListener("click", toggle);
  card.querySelector(".spark-wrap")?.addEventListener("click", toggle);
}

/**
 * Sort cards by a key; cards whose entry has `rest: true` always stay last, and cards with a missing
 * (non-finite) numeric key go after the others.
 * @template {{ el: HTMLElement, e: { rest?: boolean } }} Card
 * @param {HTMLElement} grid
 * @param {Card[]} cards
 * @param {(c: Card) => number | string} key  Numbers sort high to low, strings A to Z.
 */
export function sortInto(grid, cards, key) {
  /** @param {number | string} k */
  const n = (k) => (Number.isFinite(k) ? Number(k) : -Infinity);
  cards.slice()
    .sort((a, b) => {
      const rest = Number(!!a.e.rest) - Number(!!b.e.rest);
      if (rest) return rest;
      const ka = key(a), kb = key(b);
      if (typeof ka === "string") return ka.localeCompare(String(kb));
      const x = n(ka), y = n(kb);
      return x === y ? 0 : y > x ? 1 : -1;
    })
    .forEach((c) => grid.appendChild(c.el));
}

// ---- Ticker --------------------------------------------------------------------

let tickId = 0;

/**
 * Call fn(nowMs) about `fps` times a second while the tab is visible. Starting a new ticker stops the
 * previous one. An error in fn is logged and the ticker keeps going. Reloads the page when the year
 * changes, so a tab left open on 31 December starts counting the new year.
 * @param {(nowMs: number) => void} fn
 * @param {number} [fps]
 */
export function startTicker(fn, fps = 10) {
  const my = ++tickId, every = 1000 / fps;
  let last = 0, errors = 0;
  /** @param {number} ts */
  const loop = (ts) => {
    if (my !== tickId) return;
    requestAnimationFrame(loop);   // schedule first, so an error in fn can't stop the clock
    if (last && ts - last < every) return;
    last = ts || 1;
    const now = Date.now();
    if (new Date(now).getUTCFullYear() !== YEAR) { tickId++; location.reload(); return; }
    try { fn(now); } catch (err) { if (errors++ < 3) console.error("Ticker:", err); }
  };
  loop(0);
}

/** Stop the current ticker. */
export const stopTicker = () => { tickId++; };

/** @type {WeakMap<Element, string>} */
const lastText = new WeakMap();

/**
 * Set an element's text (or HTML when html is true) only if it changed. Use inside tickers.
 * @param {Element | null} el
 * @param {string} s
 * @param {boolean} [html]
 */
export function setText(el, s, html = false) {
  if (!el || lastText.get(el) === s) return;
  lastText.set(el, s);
  if (html) el.innerHTML = s; else el.textContent = s;
}

// ---- Page chrome -------------------------------------------------------------------

/**
 * Show "loading", "ready" or "error" content (CSS uses body[data-state]).
 * @param {"loading" | "ready" | "error"} state
 * @param {string} [msg]  Error text; an empty message shows a generic one.
 */
export function setState(state, msg) {
  document.body.dataset.state = state;
  const box = document.getElementById("error-msg");
  if (state === "error" && box) box.textContent = msg || "Something went wrong while loading the data.";
}

/** Wire the "?" explainer dialog (#help) to its open and close buttons. */
export function wireHelp() {
  const help = /** @type {HTMLDialogElement | null} */ (document.getElementById("help"));
  if (!help) return;
  document.querySelectorAll("[data-open-help]").forEach((b) => b.addEventListener("click", () => {
    if (help.showModal) help.showModal(); else help.setAttribute("open", "");
    const sheet = help.querySelector(".sheet");
    if (sheet) sheet.scrollTop = 0;
    /** @type {HTMLElement | null} */ (help.querySelector(".close"))?.focus({ preventScroll: true });
  }));
  const close = () => (help.close ? help.close() : help.removeAttribute("open"));
  document.querySelectorAll("[data-close-help]").forEach((b) => b.addEventListener("click", close));
  help.addEventListener("click", (e) => { if (e.target === help) close(); });   // tap outside
}

/**
 * Fill every element carrying data-<name> with a value, e.g. fill("year", 2026).
 * @param {string} name
 * @param {string | number} value
 */
export function fill(name, value) {
  document.querySelectorAll(`[data-${name}]`).forEach((el) => { el.textContent = String(value); });
}

/**
 * Set a verdict badge's text and colour class, keeping any other classes on it.
 * @param {Element | null} el
 * @param {Verdict} v
 */
export function showVerdict(el, v) {
  if (!el) return;
  el.textContent = v.text;
  el.classList.add("verdict");
  el.classList.remove("ok", "near", "bad");
  if (v.cls) el.classList.add(v.cls);
}
