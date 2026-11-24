// @ts-check
/**
 * clock-core: shared, dependency-free helpers for live data clocks
 * (Emissions Clock, Renewables Clock, Jobs Clock).
 *
 * Plain ES module: no build step. Import it from a pinned release:
 *   import * as C from "https://cdn.jsdelivr.net/gh/ramialbatal/clock-core@v1.0.0/clock-core.js";
 *
 * The pure functions (time, formats, CSV, models) work in Node too and are unit tested.
 * The DOM helpers (ticker, page chrome) need a browser.
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

/** @typedef {{ cls: "ok" | "near" | "bad", text: string }} Verdict */

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
 * "+1,234" or "-1,234" (plain hyphen). No sign when the value rounds to zero.
 * @param {number} x
 * @param {Intl.NumberFormat} [f]
 */
export function signed(x, f = fmt[0]) {
  const s = f.format(Math.abs(x));
  return (/^[0.,]+$/.test(s) ? "" : x > 0 ? "+" : x < 0 ? "-" : "") + s;
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

// ---- Fetching ----------------------------------------------------------------

/**
 * Minimal CSV parser: quoted cells, doubled quotes, a leading BOM. Returns one object per row, keyed by header.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  /** @type {string[][]} */
  const rows = [];
  for (const line of text.replace(/^﻿/, "").trim().split(/\r?\n/)) {
    /** @type {string[]} */
    const cells = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const [head = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/** @param {string} url */
export async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
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
 * Turn rows into { code: { year: value } }, keeping only wanted codes and years from `fromYear`.
 * @param {Record<string, string>[]} rows
 * @param {{ code: string, year: string, value: string, wanted?: Iterable<string>, fromYear?: number, scale?: number }} cols
 * @returns {Record<string, Series>}
 */
export function seriesByCode(rows, { code, year, value, wanted, fromYear = -Infinity, scale = 1 }) {
  const keep = wanted ? new Set(wanted) : null;
  /** @type {Record<string, Series>} */
  const out = {};
  for (const r of rows) {
    const c = r[code], y = Number(r[year]), v = parseFloat(r[value]);
    if (!c || (keep && !keep.has(c)) || y < fromYear || !Number.isFinite(v)) continue;
    (out[c] ||= {})[y] = v * scale;
  }
  return out;
}

// ---- Models --------------------------------------------------------------------

/** @param {Series} series */
const sortedYears = (series) => Object.keys(series).map(Number).sort((a, b) => a - b);

/**
 * Latest-year projection: growth = average yearly change over the last n years, capped at maxGrowth;
 * value(Y) = value(last) * (1 + growth)^(Y - last).
 * @param {Series} series
 * @param {number} [n]          Trend window in years (1 = latest year-on-year change).
 * @param {number} [maxGrowth]  Cap on the growth used for projecting (0.5 = 50% a year).
 * @param {number} [year]       The "current" year (defaults to YEAR; set it in tests).
 * @returns {Projection}
 */
export function project(series, n = 1, maxGrowth = Infinity, year = YEAR) {
  const years = sortedYears(series);
  const last = years[years.length - 1];
  const first = years.includes(last - n) ? last - n : years[0];
  const growth = last > first && series[first] > 0
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
 * Yearly growth needed to go from `from` to `to` in `years` years.
 * @param {number} from
 * @param {number} to
 * @param {number} years
 */
export const neededGrowth = (from, to, years) => (years > 0 ? Math.pow(to / from, 1 / years) - 1 : Infinity);

/**
 * Verdict from actual vs needed growth: On track, Close (within nearBand), Off track, Going backwards.
 * @param {number} actual
 * @param {number} needed
 * @param {number} [nearBand]
 * @returns {Verdict}
 */
export function verdict(actual, needed, nearBand = 0.85) {
  if (actual >= needed) return { cls: "ok", text: "On track" };
  if (actual >= needed * nearBand && actual > 0) return { cls: "near", text: "Close" };
  if (actual > 0) return { cls: "bad", text: "Off track" };
  return { cls: "bad", text: "Going backwards" };
}

// ---- Rendering (returns HTML strings or touches given elements) ---------------------

/**
 * Small line chart for a card header.
 * @param {number[]} years
 * @param {number[]} values
 * @param {{ caption?: string, change?: number | null, changeText?: string, good?: "up" | "down", title?: string }} [opts]
 *        `good` says which direction is good; the caption colour follows it.
 */
export function sparkline(years, values, { caption = "", change = null, changeText = "", good = "up", title = "Show yearly values" } = {}) {
  if (values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const W = 120, H = 28;
  const xy = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)]);
  const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  const isGood = change == null || change === 0 ? null : (change > 0) === (good === "up");
  return `<figure class="spark-wrap" title="${escapeHtml(title)}">
      <svg class="spark" viewBox="-2 0 ${W + 4} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${pts}"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.2"/>
      </svg>
      <figcaption>${escapeHtml(caption)} <b class="${isGood == null ? "" : isGood ? "up" : "down"}">${escapeHtml(changeText)}</b></figcaption>
      <span class="sr-only">${escapeHtml(caption)}</span>
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
 * Sort cards by a key; cards whose entry has `rest: true` always stay last.
 * @template {{ el: HTMLElement, e: { rest?: boolean } }} Card
 * @param {HTMLElement} grid
 * @param {Card[]} cards
 * @param {(c: Card) => number | string} key  Numbers sort high to low, strings A to Z.
 */
export function sortInto(grid, cards, key) {
  cards.slice()
    .sort((a, b) => {
      const rest = Number(!!a.e.rest) - Number(!!b.e.rest);
      if (rest) return rest;
      const ka = key(a), kb = key(b);
      return typeof ka === "string" ? ka.localeCompare(String(kb)) : Number(kb) - ka;
    })
    .forEach((c) => grid.appendChild(c.el));
}

// ---- Ticker --------------------------------------------------------------------

let tickId = 0;

/**
 * Call fn(nowMs) about `fps` times a second while the tab is visible. Starting a new ticker
 * stops the previous one. Reloads the page when the year changes, so a tab left open on
 * 31 December starts counting the new year.
 * @param {(nowMs: number) => void} fn
 * @param {number} [fps]
 */
export function startTicker(fn, fps = 10) {
  const my = ++tickId, every = 1000 / fps;
  let last = 0;
  /** @param {number} ts */
  const loop = (ts) => {
    if (my !== tickId) return;
    if (!last || ts - last >= every) {
      last = ts || 1;
      const now = Date.now();
      if (new Date(now).getUTCFullYear() !== YEAR) { location.reload(); return; }
      fn(now);
    }
    requestAnimationFrame(loop);
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
 * @param {string} [msg]
 */
export function setState(state, msg) {
  document.body.dataset.state = state;
  const box = document.getElementById("error-msg");
  if (msg && box) box.textContent = msg;
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
 * Set a verdict badge's text and class.
 * @param {Element | null} el
 * @param {Verdict} v
 */
export function showVerdict(el, v) {
  if (!el) return;
  el.textContent = v.text;
  el.className = "verdict " + v.cls;
}
