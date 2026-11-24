// @ts-check
/**
 * clock-core: shared, dependency-free helpers for live data clocks
 * (Emissions Clock, Renewables Clock, Jobs Clock).
 *
 * Plain ES module, no build step. Clocks import it from jsDelivr, pinned to an exact commit or a release tag:
 *   import * as C from "https://cdn.jsdelivr.net/gh/ramialbatal/clock-core@<commit-or-tag>/clock-core.js";
 * (each clock maps the bare name "clock-core" to that URL with an import map).
 *
 * Sections: Time · Languages · Formatting · Data · Models · Rendering · Ticker · Scene · Page (incl. embeds).
 * Pure functions (everything up to Rendering, plus `seeded`) also run in Node and are unit tested in
 * test/clock-core.test.js. The DOM helpers (Rendering, Ticker, Scene, Page) need a browser.
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
 * A goal verdict. `cls` drives the badge colour: ok (green), near (amber), bad (red), "" (neutral). `key` names the
 * verdict whatever the language (compare with it, not with the translated `text`).
 * @typedef {{ cls: "ok" | "near" | "bad" | "", key: "onTrack" | "close" | "offTrack" | "backwards" | "", text: string }} Verdict
 */

/**
 * Tone of a plain-language message: "ok" (green), "warn" (amber) or "bad" (red).
 * @typedef {"ok" | "warn" | "bad"} Tone
 */

/**
 * A plain-language message for visitors: a tone, its icon, a short title and, optionally, one sentence.
 * @typedef {{ tone: Tone, icon: string, title: string, text?: string }} Message
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

// ---- Languages ---------------------------------------------------------------------
// The page's inline script picks the language before the first paint and sets <html lang dir> (see
// docs/how-it-works.md, "Languages"). Clocks register their strings with addStrings, call setLang(pageLang()),
// then translatePage(). Pure parts (t, setLang, number formats) also run in Node.

/** @typedef {"en" | "fr" | "es" | "ar"} Lang */

/** Supported languages, by code, with their own names (as shown in the language picker). */
export const LANGS = /** @type {const} */ ({ en: "English", fr: "Français", es: "Español", ar: "العربية" });
/** Languages written right to left. */
export const RTL_LANGS = /** @type {readonly Lang[]} */ (["ar"]);
// Locales for numbers and dates. Arabic keeps Western digits so live counters stay easy to read.
const LOCALES = /** @type {Record<Lang, string>} */ ({ en: "en-US", fr: "fr-FR", es: "es-ES", ar: "ar-u-nu-latn" });

/** @type {Lang} */
let current = "en";
/** The current language code. */
export const lang = () => current;
/** The current locale, for Intl and toLocaleString, e.g. "fr-FR". */
export const locale = () => LOCALES[current];
/** True when the current language is written right to left. */
export const isRtl = () => RTL_LANGS.includes(current);
/**
 * A supported language code, or "en".
 * @param {unknown} code
 * @returns {Lang}
 */
export const asLang = (code) => (typeof code === "string" && Object.hasOwn(LANGS, code) ? /** @type {Lang} */ (code) : "en");

/** clock-core's own words, in every language. Clocks add theirs with addStrings. */
/** @type {Record<Lang, Record<string, string>>} */
const STRINGS = {
  en: {
    "core.act.button": "What can I do?", "core.act.intro": "Three things that make a real difference, backed by evidence.", "core.act.source": "Source", "core.done": "Got it", "core.stats": "Visits are counted anonymously with GoatCounter: no cookies, no personal data.",
    "core.na": "n/a", "core.onTrack": "On track", "core.close": "Close", "core.offTrack": "Off track", "core.backwards": "Going backwards",
    "core.showYearly": "Show yearly values", "core.yearly": "Yearly data", "core.hideYearly": "Hide yearly data",
    "core.showAll": "Show all {n} countries", "core.error": "Something went wrong while loading the data.",
    "core.language": "Language", "core.close.button": "Close",
    "core.embed.short": "Add to your site", "core.embed.button": "Put this clock on your website", "core.embed.title": "Put this clock on your website",
    "core.embed.text": "Copy this code into your page. The clock keeps itself up to date, in the language and view you have open now.",
    "core.embed.copy": "Copy code", "core.embed.copied": "Copied", "core.embed.preview": "Preview",
    "core.embed.credit": "Open the full clock",
  },
  fr: {
    "core.act.button": "Que puis-je faire ?", "core.act.intro": "Trois gestes qui changent vraiment les choses, preuves à l’appui.", "core.act.source": "Source", "core.done": "Compris", "core.stats": "Les visites sont comptées anonymement avec GoatCounter : sans cookies ni données personnelles.",
    "core.na": "n.d.", "core.onTrack": "Sur la bonne voie", "core.close": "Presque", "core.offTrack": "Pas assez vite", "core.backwards": "Dans le mauvais sens",
    "core.showYearly": "Voir les valeurs annuelles", "core.yearly": "Données annuelles", "core.hideYearly": "Masquer les données annuelles",
    "core.showAll": "Voir les {n} pays", "core.error": "Un problème est survenu pendant le chargement des données.",
    "core.language": "Langue", "core.close.button": "Fermer",
    "core.embed.short": "Ajouter à votre site", "core.embed.button": "Ajouter cette horloge à votre site", "core.embed.title": "Ajouter cette horloge à votre site",
    "core.embed.text": "Copiez ce code dans votre page. L’horloge se met à jour toute seule, dans la langue et l’affichage que vous avez à l’écran.",
    "core.embed.copy": "Copier le code", "core.embed.copied": "Copié", "core.embed.preview": "Aperçu",
    "core.embed.credit": "Ouvrir l’horloge complète",
  },
  es: {
    "core.act.button": "¿Qué puedo hacer?", "core.act.intro": "Tres cosas que marcan una diferencia real, según los datos.", "core.act.source": "Fuente", "core.done": "Entendido", "core.stats": "Las visitas se cuentan de forma anónima con GoatCounter: sin cookies ni datos personales.",
    "core.na": "sin datos", "core.onTrack": "Va bien", "core.close": "Casi", "core.offTrack": "Demasiado lento", "core.backwards": "Va hacia atrás",
    "core.showYearly": "Ver los datos anuales", "core.yearly": "Datos anuales", "core.hideYearly": "Ocultar los datos anuales",
    "core.showAll": "Ver todos los países ({n})", "core.error": "Hubo un problema al cargar los datos.",
    "core.language": "Idioma", "core.close.button": "Cerrar",
    "core.embed.short": "Añadir a tu web", "core.embed.button": "Pon este reloj en tu web", "core.embed.title": "Pon este reloj en tu web",
    "core.embed.text": "Copia este código en tu página. El reloj se actualiza solo, en el idioma y la vista que tienes ahora.",
    "core.embed.copy": "Copiar código", "core.embed.copied": "Copiado", "core.embed.preview": "Vista previa",
    "core.embed.credit": "Abrir el reloj completo",
  },
  ar: {
    "core.act.button": "ماذا يمكنني أن أفعل؟", "core.act.intro": "ثلاثة أمور تُحدث فرقًا حقيقيًا، تدعمها الأدلة.", "core.act.source": "المصدر", "core.done": "فهمت", "core.stats": "تُحتسب الزيارات دون تحديد الهوية عبر GoatCounter: بلا ملفات تعريف الارتباط ولا بيانات شخصية.",
    "core.na": "غير متاح", "core.onTrack": "على المسار الصحيح", "core.close": "قريب", "core.offTrack": "أبطأ من اللازم", "core.backwards": "يتراجع",
    "core.showYearly": "عرض القيم السنوية", "core.yearly": "البيانات السنوية", "core.hideYearly": "إخفاء البيانات السنوية",
    "core.showAll": "عرض كل الدول ({n})", "core.error": "حدث خطأ أثناء تحميل البيانات.",
    "core.language": "اللغة", "core.close.button": "إغلاق",
    "core.embed.short": "أضفها إلى موقعك", "core.embed.button": "ضع هذه الساعة على موقعك", "core.embed.title": "ضع هذه الساعة على موقعك",
    "core.embed.text": "انسخ هذا الرمز وضعه في صفحتك. تُحدَّث الساعة تلقائيًا، باللغة والعرض الظاهرين الآن.",
    "core.embed.copy": "نسخ الرمز", "core.embed.copied": "تم النسخ", "core.embed.preview": "معاينة",
    "core.embed.credit": "افتح الساعة كاملة",
  },
};

/**
 * Add a clock's strings for one language (later calls override earlier ones).
 * @param {Lang} code
 * @param {Record<string, string>} table
 */
export function addStrings(code, table) { STRINGS[code] = { ...STRINGS[code], ...table }; }

/**
 * The text for a key in the current language, falling back to English and then to the key itself.
 * `{name}` placeholders are filled from vars: t("core.showAll", { n: 12 }).
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 */
export function t(key, vars) {
  const s = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(vars, k) ? String(vars[k]) : m)) : s;
}

/**
 * The current language's text for a key if it has one, else `english` (for words kept in config.js, such as a
 * gas's name: tOr("gas.ch4.label", gas.label)).
 * @param {string} key
 * @param {string} english
 */
export const tOr = (key, english) => (Object.hasOwn(STRINGS[current], key) ? t(key) : english);

/**
 * The two-letter region code inside a flag emoji: "🇫🇷" gives "FR", "🇪🇺" gives "EU"; "" for anything else.
 * @param {string} flag
 */
export function flagRegion(flag) {
  const cps = [...flag].map((c) => /** @type {number} */ (c.codePointAt(0)) - 0x1f1e6);
  return cps.length === 2 && cps.every((n) => n >= 0 && n < 26) ? String.fromCharCode(...cps.map((n) => n + 65)) : "";
}

/**
 * True when the current language has its own text for a key (not the English fallback).
 * @param {string} key
 */
export const hasText = (key) => Object.hasOwn(STRINGS[current], key);

/**
 * Switch language: number formats follow it at once. Unknown codes fall back to English.
 * @param {unknown} code
 */
export function setLang(code) {
  current = asLang(code);
  for (const d of /** @type {const} */ ([0, 1, 2, 3])) fmt[d] = nf(d);
}

/**
 * A place's name in the current language, from a two-letter region code ("FR", "EU", or "001" for the world),
 * using the browser's own translations; `fallback` when the browser has none.
 * @param {string | undefined} region
 * @param {string} fallback
 */
export function regionName(region, fallback) {
  if (!region || current === "en") return fallback;
  try { return new Intl.DisplayNames([locale()], { type: "region" }).of(region) ?? fallback; } catch { return fallback; }
}

// ---- Formatting --------------------------------------------------------------

/** @param {number} d */
const nf = (d) => new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Number formats with 0 to 3 decimals in the current language, e.g. fmt[1].format(4.25) is "4.3" in English and
 * "4,3" in French. setLang replaces them, so always read them from here (don't keep your own copy).
 * @type {Record<0 | 1 | 2 | 3, Intl.NumberFormat>}
 */
export const fmt = { 0: nf(0), 1: nf(1), 2: nf(2), 3: nf(3) };

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
 * "+1,234" or "-1,234" (plain hyphen). No sign when the value rounds to zero. In right-to-left languages the result
 * is wrapped in invisible isolation marks so the sign stays in front.
 * @param {number} x
 * @param {Intl.NumberFormat} [f]
 */
export function signed(x, f = fmt[0]) {
  const s = f.format(Math.abs(x));
  const out = (/[1-9]/.test(s) ? (x > 0 ? "+" : "-") : "") + s;
  return isRtl() ? `\u2066${out}\u2069` : out;   // keep the sign in front inside right-to-left text
}

/**
 * A signed percentage: "+2.8%", "-0.5%" ("+2,8 %" in French). No sign when it shows as zero; isolated in right-to-left
 * text like `signed`.
 * @param {number} x  Percentage value (2.8 means +2.8%).
 * @param {0|1|2|3} [d]
 */
export function signedPct(x, d = 1) {
  const s = fmt[d].format(Math.abs(x));
  const out = (/[1-9]/.test(s) ? (x > 0 ? "+" : "-") : "") + s + (current === "fr" ? "\u202f%" : "%");
  return isRtl() ? `\u2066${out}\u2069` : out;
}

/**
 * "4.9%" (French: "4,9 %", with a narrow no-break space). In right-to-left languages it is isolated, so it reads
 * "4.9%" wherever it sits in a sentence.
 * @param {number} x  Percentage value (4.9 means 4.9%).
 * @param {0|1|2|3} [d]
 */
export function pct(x, d = 1) {
  const out = fmt[d].format(x) + (current === "fr" ? "\u202f%" : "%");
  return isRtl() ? `\u2066${out}\u2069` : out;   // same order ("32%") wherever it sits in right-to-left text
}

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
  if (a >= n) return { cls: "ok", key: "onTrack", text: t("core.onTrack") };
  if (a < 0) return { cls: "bad", key: "backwards", text: t("core.backwards") };
  if (a >= n * nearBand && a > 0) return { cls: "near", key: "close", text: t("core.close") };
  return { cls: "bad", key: "offTrack", text: t("core.offTrack") };
}

/**
 * "Rest of world": world minus the listed top-level places (those not part of another listed entry).
 * A place whose data ends before the world's latest year counts with its projected value for that year,
 * so it isn't silently attributed to the rest of the world. The yearly rate is never below 0.
 * @param {{ annual: number, lastValue: number, lastYear: number }} world
 * @param {{ annual: number, at: (year: number) => number, partOf?: string }[]} entries
 */
export function restOfWorld(world, entries) {
  const top = entries.filter((e) => !e.partOf);
  return {
    annual: Math.max(world.annual - top.reduce((s, e) => s + e.annual, 0), 0),
    lastValue: world.lastValue - top.reduce((s, e) => s + e.at(world.lastYear), 0),
    lastYear: world.lastYear
  };
}

/**
 * Colour class for a change, as displayed with `d` decimals: "good", "bad" or "" when it shows as zero.
 * @param {number} x
 * @param {number} d
 * @param {"up" | "down"} good  which direction is good
 * @returns {"good" | "bad" | ""}
 */
export function changeClass(x, d, good) {
  const s = shownSign(x, d) * (good === "up" ? 1 : -1);
  return s > 0 ? "good" : s < 0 ? "bad" : "";
}

/**
 * Yearly trend as text: "▲ +1.2%", "▼ -0.8%", or "0.0%" when it shows as zero; "n/a" for null.
 * @param {number | null} growth  0.012 = 1.2%
 */
export function trendText(growth) {
  if (growth == null) return t("core.na");
  const s = shownSign(growth * 100, 1);
  return (s > 0 ? "▲ " : s < 0 ? "▼ " : "") + signedPct(growth * 100, 1);
}

// ---- Plain-language messages ---------------------------------------------------------

/** @type {Record<Tone, string>} */
export const TONE_ICON = { ok: "🟢", warn: "🟠", bad: "🔴" };

/**
 * Build a message: `message("bad", "We're heading the wrong way", "One short sentence.")`.
 * Each clock keeps its own wording in js/messages.js and builds messages with this.
 * @param {Tone} tone
 * @param {string} title
 * @param {string} [text]
 * @returns {Message}
 */
export const message = (tone, title, text) => ({ tone, icon: TONE_ICON[tone], title, ...(text ? { text } : {}) });

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
export function sparkline(years, values, { caption = "", change = null, changeText = "", good = "up", title = t("core.showYearly"), label = "" } = {}) {
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
 * HTML for one traffic-light card under "Where we stand": a small label, the icon and short title, an optional
 * bar (percentage filled, coloured by tone), and one sentence.
 * @param {{ label: string, msg: Message, pct?: number | null, barLabel?: string }} card
 */
export function statusCard({ label, msg, pct = null, barLabel = "" }) {
  const bar = pct == null ? ""
    : `<div class="sc-bar" role="img" aria-label="${escapeHtml(barLabel || `${fmt[0].format(pct)}%`)}"><i style="width:${Math.min(Math.max(pct, 0), 100)}%"></i></div>`;
  return `<article class="status-card" data-tone="${msg.tone}">
      <p class="sc-label">${escapeHtml(label)}</p>
      <p class="sc-title"><span aria-hidden="true">${msg.icon}</span> ${escapeHtml(msg.title)}</p>
      ${bar}
      <p class="sc-text">${escapeHtml(msg.text ?? "")}</p>
    </article>`;
}

/**
 * HTML for a small coloured badge, e.g. `badge("ok", "▼ Falling")`. Empty tone gives no badge.
 * @param {Tone | ""} tone
 * @param {string} label
 */
export const badge = (tone, label) => (tone ? `<span class="badge ${tone}">${escapeHtml(label)}</span>` : "");

/**
 * Show a message in the answer banner at the top of the page (#answer, #answer-icon, #answer-title, #answer-text).
 * @param {Message} m
 */
export function showAnswer(m) {
  const box = document.getElementById("answer");
  if (!box) return;
  box.dataset.tone = m.tone;
  const set = (/** @type {string} */ id, /** @type {string} */ t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  set("answer-icon", m.icon);
  set("answer-title", m.title);
  set("answer-text", m.text ?? "");
}

/**
 * Keep a long card list short: the grid's "collapsed" class shows the first six cards (CSS); the button
 * reveals the rest and then hides itself.
 * @param {HTMLElement} grid
 * @param {HTMLElement} button
 * @param {number} total   number of cards
 */
export function wireShowAll(grid, button, total) {
  button.textContent = t("core.showAll", { n: total });
  button.hidden = !grid.classList.contains("collapsed") || total <= 6;
  button.onclick = () => { grid.classList.remove("collapsed"); button.hidden = true; };
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
    if (btn.firstChild) btn.firstChild.textContent = `${t(h.hidden ? "core.yearly" : "core.hideYearly")} `;
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

// ---- Scene: an animated picture behind the top of the page ------------------------------

/**
 * A small seeded random number generator (mulberry32). Scenes use it so their layout (buildings, hills, cracks) is
 * the same on every visit and changes only with the screen size.
 * @param {number} seed
 * @returns {() => number}  a function returning numbers in [0, 1)
 */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * What a scene gets for each frame. Draw in CSS pixels: the context is already scaled for the screen.
 * @typedef {object} SceneFrame
 * @property {CanvasRenderingContext2D} ctx
 * @property {number} w       width in CSS pixels
 * @property {number} h       height in CSS pixels
 * @property {number} ground  y of the horizon: the bottom edge of the `groundAt` element (the page header)
 * @property {number} t       seconds since the scene started (a fixed moment when motion is reduced)
 * @property {number} dt      seconds since the previous frame, at most 0.1 (0 after a resize or on a still frame)
 */

/**
 * A scene: `layout` (optional) runs after every resize to build what depends on the size; `draw` paints one frame.
 * @typedef {{ layout?: (f: SceneFrame) => void, draw: (f: SceneFrame) => void }} Scene
 */

/**
 * Animate a scene on a canvas (CSS class "scene") behind the top of the page. It handles the screen's pixel density
 * (capped at 2), resizing, pausing while the canvas is off screen or the tab is hidden, a single still frame for
 * visitors who prefer reduced motion, and errors (logged once; the canvas hides and the page keeps working).
 * @param {HTMLCanvasElement | null} canvas
 * @param {Scene} scene
 * @param {{ groundAt?: Element | null, fps?: number, stillAt?: number }} [opts]
 *   groundAt: the element whose bottom edge is the horizon (default: half way down); fps: frames per second
 *   (default 30); stillAt: the moment, in seconds, shown as the still frame (default 6)
 * @returns {{ stop: () => void, redraw: () => void }}  redraw: repaint a paused or still scene now, e.g. after the
 *   page's view changes (a running scene picks changes up on its next frame, so redraw does nothing then)
 */
export function startScene(canvas, scene, { groundAt = null, fps = 30, stillAt = 6 } = {}) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return { stop: () => {}, redraw: () => {} };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  /** @type {SceneFrame} */
  const f = { ctx, w: 0, h: 0, ground: 0, t: stillAt, dt: 0 };
  const t0 = performance.now() - stillAt * 1000;
  let raf = 0, last = 0, dpr = 1, onScreen = true, stopped = false;

  const stop = () => { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  const paint = () => {
    if (stopped || !f.w || !f.h) return;
    try {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save(); scene.draw(f); ctx.restore();
    } catch (err) { console.error("Scene:", err); stop(); canvas.hidden = true; }
  };
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    f.w = box.width; f.h = box.height; f.dt = 0;
    f.ground = groundAt ? Math.max(0, Math.min(f.h, groundAt.getBoundingClientRect().bottom - box.top)) : f.h / 2;
    canvas.width = Math.round(f.w * dpr); canvas.height = Math.round(f.h * dpr);
    if (reduce.matches) f.t = stillAt;
    try { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); scene.layout?.(f); } catch (err) { console.error("Scene:", err); stop(); canvas.hidden = true; return; }
    paint();
    run();
  };
  /** @param {number} ts */
  const loop = (ts) => {
    raf = 0;
    if (stopped || reduce.matches || !onScreen || document.hidden) return;
    raf = requestAnimationFrame(loop);
    if (last && ts - last < 1000 / fps - 2) return;
    f.dt = last ? Math.min((ts - last) / 1000, 0.1) : 0;
    f.t = (ts - t0) / 1000;
    last = ts;
    paint();
  };
  const run = () => { if (!raf && !stopped) { last = 0; raf = requestAnimationFrame(loop); } };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  if (groundAt) ro.observe(groundAt);
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; run(); });
  io.observe(canvas);
  document.addEventListener("visibilitychange", run);
  reduce.addEventListener("change", () => { f.t = stillAt; f.dt = 0; paint(); run(); });
  return { stop, redraw: () => { if (!raf) { f.dt = 0; paint(); } } };
}

// ---- Languages on the page ----------------------------------------------------------

/**
 * Translate the page into the current language: every element with data-i18n="key" gets that key's text (as HTML,
 * so keep any inner elements with ids or data- attributes in the translation), and data-i18n-attr="attr:key; ..."
 * sets attributes (aria-label, content, title...). Keys the language lacks keep the English already in the page.
 * Also sets <html lang dir> and shows the page if the inline script hid it while waiting.
 */
export function translatePage() {
  const root = document.documentElement;
  if (current !== "en") {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = /** @type {HTMLElement} */ (el).dataset.i18n;
      if (key && hasText(key)) el.innerHTML = t(key);
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      for (const pair of (/** @type {HTMLElement} */ (el).dataset.i18nAttr ?? "").split(";")) {
        const [attr, key] = pair.split(":").map((x) => x.trim());
        if (attr && key && hasText(key)) el.setAttribute(attr, t(key));
      }
    });
  }
  root.lang = current;
  root.dir = isRtl() ? "rtl" : "ltr";
  delete root.dataset.i18n;
}

/**
 * Add the language picker (a globe and the language code; tapping it opens the device's own list) at the start of
 * `where`. Choosing a language remembers it and reloads the page in that language, keeping the view (#hash).
 * @param {Element | null} where  usually the header's .wrap
 */
export function addLangPicker(where) {
  if (!where || isEmbed()) return;
  const label = document.createElement("label");
  label.className = "lang-pick";
  label.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/></svg>
    <span class="lang-code" aria-hidden="true">${current.toUpperCase()}</span>
    <select aria-label="${escapeHtml(t("core.language"))}">${Object.entries(LANGS)
      .map(([c, name]) => `<option value="${c}" lang="${c}"${c === current ? " selected" : ""}>${name}</option>`).join("")}</select>`;
  const select = /** @type {HTMLSelectElement} */ (label.querySelector("select"));
  // The page's small tools (language, "Add to your site") share one row at the top
  let tools = where.querySelector(".top-tools");
  if (!tools) { tools = document.createElement("div"); tools.className = "top-tools"; where.prepend(tools); }
  select.addEventListener("change", () => {
    const code = asLang(select.value);
    try { localStorage.setItem("clock-lang", code); } catch { /* private mode: the URL still carries it */ }
    const url = new URL(location.href);
    if (code === "en") url.searchParams.delete("lang"); else url.searchParams.set("lang", code);
    track(`lang-${code}`);
    location.assign(url.href);
  });
  tools.append(label);
}

/**
 * Start the page in the language the inline script chose: load that language's strings (English must already be
 * added), switch number formats, translate the page and add the picker. If the strings can't load, the page stays
 * in English.
 * @param {(code: Lang) => Promise<{ default: Record<string, string> }>} load  e.g. (c) => import(`./i18n/${c}.js`)
 * @param {Element | null} pickerIn  where the language picker goes (usually the header's .wrap)
 */
export async function startLanguage(load, pickerIn) {
  let code = asLang(document.documentElement.lang);
  if (code !== "en") {
    try { addStrings(code, (await load(code)).default); } catch (err) { console.error("Language:", err); code = "en"; }
  }
  setLang(code);
  translatePage();
  addLangPicker(pickerIn);
}

// ---- Embeds: the clock as a small widget on other websites ------------------------------

/** True when the page runs as a widget (?embed=1; the inline script sets <html data-embed>). */
export const isEmbed = () => document.documentElement.hasAttribute("data-embed");

/**
 * The clock's address in a given form: the full page, or the widget, keeping the language and the view (#hash).
 * @param {{ embed?: boolean }} [opts]
 */
export function clockUrl({ embed = false } = {}) {
  const url = new URL(location.origin + location.pathname);
  if (embed) url.searchParams.set("embed", "1");
  if (current !== "en") url.searchParams.set("lang", current);
  return url.href + location.hash;
}

/**
 * Set the page up for its two roles. As a widget: links open in a new tab and a small "Open the full clock" link is
 * added at the bottom. As the full page: adds a small "Add to your site" button in the top row next to the language
 * picker (or at the start of `where` when there is no picker), which opens a dialog with the code to copy and a live
 * preview.
 * @param {Element | null} where  fallback place for the button (the footer)
 */
export function wireEmbed(where) {
  if (isEmbed()) {
    const credit = document.createElement("a");
    credit.className = "embed-credit";
    // A share card (?card=1) shows the address instead of a link
    credit.textContent = document.documentElement.hasAttribute("data-card")
      ? (document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? location.href)
        .replace(/^https?:\/\//, "").replace(/[?#].*$/, "").replace(/\/$/, "")
      : `${t("core.embed.credit")} ${isRtl() ? "↖" : "↗"}`;
    document.body.append(credit);
    const point = () => { credit.href = clockUrl(); };
    point(); window.addEventListener("hashchange", point);
    document.querySelectorAll("a").forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });
    return;
  }
  const host = document.querySelector(".top-tools") ?? where;
  if (!host) return;
  const open = document.createElement("button");
  open.type = "button";
  open.className = "embed-open";
  open.title = t("core.embed.button");
  open.innerHTML = `<span aria-hidden="true">&lt;/&gt;</span> ${escapeHtml(t("core.embed.short"))}`;
  host.prepend(open);
  /** @type {HTMLDialogElement | null} */
  let dlg = null;
  open.addEventListener("click", () => {
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "embed";
      dlg.setAttribute("aria-labelledby", "embed-title");
      dlg.innerHTML = `<header class="sheet-head"><h2 id="embed-title">${escapeHtml(t("core.embed.title"))}</h2>
          <button type="button" class="close" aria-label="${escapeHtml(t("core.close.button"))}">×</button></header>
        <div class="sheet">
          <p>${escapeHtml(t("core.embed.text"))}</p>
          <textarea class="embed-code" readonly rows="4" dir="ltr" spellcheck="false"></textarea>
          <button type="button" class="embed-copy">${escapeHtml(t("core.embed.copy"))}</button>
          <p class="embed-label">${escapeHtml(t("core.embed.preview"))}</p>
          <iframe class="embed-preview" title="${escapeHtml(t("core.embed.preview"))}" loading="lazy"></iframe>
        </div>`;
      document.body.append(dlg);
      const d = dlg;
      d.querySelector(".close")?.addEventListener("click", () => d.close());
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
      const copy = /** @type {HTMLButtonElement} */ (d.querySelector(".embed-copy"));
      copy.addEventListener("click", async () => {
        const code = /** @type {HTMLTextAreaElement} */ (d.querySelector(".embed-code"));
        try { await navigator.clipboard.writeText(code.value); } catch { code.select(); document.execCommand?.("copy"); }
        copy.textContent = t("core.embed.copied");
        track("embed-copy");
        setTimeout(() => { copy.textContent = t("core.embed.copy"); }, 2000);
      });
    }
    const src = clockUrl({ embed: true });
    const name = escapeHtml(document.querySelector("h1")?.textContent?.trim() ?? "");
    /** @type {HTMLTextAreaElement} */ (dlg.querySelector(".embed-code")).value =
      `<iframe src="${escapeHtml(src)}" title="${name}" width="100%" height="300" style="border:0;max-width:480px;border-radius:16px" loading="lazy"></iframe>`;
    const preview = /** @type {HTMLIFrameElement} */ (dlg.querySelector(".embed-preview"));
    if (preview.src !== src) preview.src = src;
    dlg.showModal();
    track("embed-open");
  });
}

// ---- "What can I do?": three evidence-based actions behind a button --------------------------

/**
 * One action: an icon, a key for its words (`act.<key>.t` title, `act.<key>.x` one sentence, in the clock's i18n
 * files), and its source.
 * @typedef {{ icon: string, key: string, source: string, url: string }} Action
 */

/**
 * Add a small "What can I do?" button under the answer, opening a sheet with the actions (not in widgets).
 * @param {Action[]} actions
 * @param {Element | null} [where]  default: the answer banner (#answer)
 */
export function wireActions(actions, where = document.getElementById("answer")) {
  if (!where || !actions.length || isEmbed()) return;
  const open = document.createElement("button");
  open.type = "button";
  open.className = "act-open";
  open.setAttribute("aria-haspopup", "dialog");
  open.innerHTML = `<span aria-hidden="true">💡</span> ${escapeHtml(t("core.act.button"))}`;
  where.append(open);
  /** @type {HTMLDialogElement | null} */
  let dlg = null;
  open.addEventListener("click", () => {
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "act";
      dlg.setAttribute("aria-labelledby", "act-title");
      dlg.innerHTML = `<header class="sheet-head"><h2 id="act-title">${escapeHtml(t("core.act.button"))}</h2>
          <button type="button" class="close" aria-label="${escapeHtml(t("core.close.button"))}">×</button></header>
        <div class="sheet">
          <p class="act-intro">${escapeHtml(t("core.act.intro"))}</p>
          ${actions.map((a) => `<article class="act">
            <span class="act-icon" aria-hidden="true">${a.icon}</span>
            <div><h3>${escapeHtml(t(`act.${a.key}.t`))}</h3><p>${escapeHtml(t(`act.${a.key}.x`))}</p>
              <p class="act-src">${escapeHtml(t("core.act.source"))}: <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.source)}</a></p></div>
          </article>`).join("")}
          <button type="button" class="done">${escapeHtml(t("core.done"))}</button>
        </div>`;
      document.body.append(dlg);
      const d = dlg;
      d.querySelectorAll(".close, .done").forEach((b) => b.addEventListener("click", () => d.close()));
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    }
    dlg.showModal();
    /** @type {HTMLElement | null} */ (dlg.querySelector(".sheet"))?.scrollTo(0, 0);
    track("act-open");
  });
}

// ---- Visit counts: GoatCounter, no cookies, no personal data ------------------------------

let statsUrl = "";

/** @param {Record<string, string>} params */
function hit(params) {
  try { navigator.sendBeacon(`${statsUrl}?${new URLSearchParams({ ...params, rnd: Math.random().toString(36).slice(2) })}`); }
  catch { /* counting must never break the page */ }
}

/**
 * Count this visit, if the page names a counter in <meta name="clock-stats" content="https://<code>.goatcounter.com/count">.
 * Counts only on the live site (*.github.io) and never automated browsers (tests). The page is recorded with its view
 * and language, e.g. "/emissions-clock/methane?lang=fr"; widgets as ".../embed", with the embedding site as referrer.
 * Adds a one-line privacy note to `noteIn` (the footer) whenever a counter is named.
 * @param {Element | null} [noteIn]
 */
export function startStats(noteIn = document.querySelector("footer.foot")) {
  const url = document.querySelector('meta[name="clock-stats"]')?.getAttribute("content") ?? "";
  if (!url) return;
  if (noteIn && !isEmbed()) {
    const p = document.createElement("p");
    p.className = "stats-note";
    p.textContent = t("core.stats");
    noteIn.append(p);
  }
  if (navigator.webdriver || !/\.github\.io$/.test(location.hostname) || !navigator.sendBeacon) return;
  statsUrl = url;
  const view = location.hash.slice(1);
  const path = location.pathname + (isEmbed() ? "embed" : "") + (view ? (isEmbed() ? "/" : "") + view : "")
    + (current !== "en" ? `?lang=${current}` : "");
  hit({ p: path, t: document.title, r: document.referrer, s: `${screen.width},${screen.height},${devicePixelRatio}` });
}

/**
 * Count an event (a click), e.g. track("embed-copy"). Does nothing unless startStats is counting.
 * @param {string} name
 */
export function track(name) { if (statsUrl) hit({ p: name, t: name, e: "true" }); }

// ---- Page chrome -------------------------------------------------------------------

/**
 * Show "loading", "ready" or "error" content (CSS uses body[data-state]).
 * @param {"loading" | "ready" | "error"} state
 * @param {string} [msg]  Error text; an empty message shows a generic one.
 */
export function setState(state, msg) {
  document.body.dataset.state = state;
  const box = document.getElementById("error-msg");
  if (state === "error" && box) box.textContent = msg || t("core.error");
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
