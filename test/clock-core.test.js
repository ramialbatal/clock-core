// Unit tests for the pure parts of clock-core. Run with: npm test (node --test, no dependencies).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signed, pct, digits, escapeHtml, parseCsv, seriesByCode, namesByCode, num, shown, shownSign, project,
  interpolateMidYear, neededGrowth, verdict, sparkline, tYears, yearFraction, YEAR, fmt, once,
  restOfWorld, changeClass, trendText, signedPct, message, statusCard, badge, TONE_ICON, seeded,
  LANGS, addStrings, t, tOr, hasText, setLang, lang, locale, isRtl, asLang, regionName, flagRegion
} from "../clock-core.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);

test("signed: plus, minus, and no sign on a rounded zero", () => {
  assert.equal(signed(1234), "+1,234");
  assert.equal(signed(-1234), "-1,234");
  assert.equal(signed(-0.2), "0");
  assert.equal(signed(0.04, fmt[1]), "0.0");
  assert.equal(signed(2.25, fmt[1]), "+2.3");
});

test("pct and digits", () => {
  assert.equal(pct(4.86), "4.9%");
  assert.equal(pct(53.3, 2), "53.30%");
  assert.equal(digits("1,2"), '<span class="d">1</span>,<span class="d">2</span>');
});

test("escapeHtml escapes markup characters", () => {
  assert.equal(escapeHtml(`<b class="x">Côte d'Ivoire & co</b>`), "&lt;b class=&quot;x&quot;&gt;Côte d&#39;Ivoire &amp; co&lt;/b&gt;");
});

test("parseCsv handles quotes, doubled quotes, commas in cells and a BOM", () => {
  const rows = parseCsv('﻿entity,code,year,value\n"Korea, South",KOR,2025,"1,5"\n"He said ""hi""",X,2024,2\n');
  assert.deepEqual(rows[0], { entity: "Korea, South", code: "KOR", year: "2025", value: "1,5" });
  assert.equal(rows[1].entity, 'He said "hi"');
});

test("parseCsv keeps line breaks inside quoted cells and handles CRLF", () => {
  assert.deepEqual(parseCsv('a,b\r\n"x\ny",2\r\n'), [{ a: "x\ny", b: "2" }]);
});

test("num is strict: blanks and partly numeric cells are NaN", () => {
  assert.equal(num("12.5"), 12.5);
  for (const bad of ["", " ", "1,234", "12e", "n/a", undefined]) assert.ok(Number.isNaN(num(bad)), String(bad));
});

test("shown and shownSign compare values as displayed", () => {
  assert.equal(shown(4.249, 1), 4.2);
  assert.equal(shown(-0.04, 1), 0);
  assert.ok(Object.is(shown(-0.04, 1), 0));            // never -0
  assert.equal(shownSign(-0.04, 1), 0);
  assert.equal(shownSign(-0.06, 1), -1);
});

test("seriesByCode rejects bad years and partly numeric values, keeps the first duplicate, supports where", () => {
  const rows = parseCsv('code,year,v,sex\nA,2023,1,T\nA,n/a,7,T\nA,,8,T\nA,2024,"1,234",T\nA,2023,9,T\nA,2022,5,F\n');
  const warn = console.warn; console.warn = () => {};
  try {
    assert.deepEqual(seriesByCode(rows, { code: "code", year: "year", value: "v" }), { A: { 2022: 5, 2023: 1 } });
    assert.deepEqual(seriesByCode(rows, { code: "code", year: "year", value: "v", where: (r) => r.sex === "T" }), { A: { 2023: 1 } });
  } finally { console.warn = warn; }
});

test("namesByCode", () => {
  const rows = parseCsv("entity,code\nChina,CHN\nWorld,OWID_WRL\n");
  assert.deepEqual(namesByCode(rows, { code: "code", name: "entity", wanted: ["CHN"] }), { CHN: "China" });
});

test("seriesByCode filters codes and years, skips blanks, scales", () => {
  const rows = parseCsv("code,year,v\nA,2014,1\nA,2015,2\nA,2016,\nB,2015,3\nC,2015,4\n");
  assert.deepEqual(seriesByCode(rows, { code: "code", year: "year", value: "v", wanted: ["A", "B"], fromYear: 2015, scale: 1000 }),
    { A: { 2015: 2000 }, B: { 2015: 3000 } });
});

test("project: latest year-on-year growth, compounding, official values kept", () => {
  const p = project({ 2023: 100, 2024: 110 }, 1, Infinity, 2026);
  close(p.growth, 0.1);
  assert.equal(p.lastYear, 2024);
  assert.equal(p.at(2023), 100);
  close(p.annual, 110 * 1.1 * 1.1);
});

test("project: growth cap applies to projection only", () => {
  const p = project({ 2023: 1, 2024: 2.63 }, 1, 0.5, 2026);
  close(p.growth, 1.63);
  close(p.gUsed, 0.5);
  close(p.annual, 2.63 * 1.5 * 1.5);
});

test("project: multi-year window, zero or negative ends", () => {
  close(project({ 2020: 100, 2021: 0, 2022: 121 }, 2, Infinity, 2022).growth, 0.1);
  assert.equal(project({ 2023: 0, 2024: 5 }, 1, Infinity, 2024).growth, 0);
  assert.equal(project({ 2022: 10, 2023: 5, 2024: -5 }, 2, Infinity, 2024).growth, 0);
});

test("project: a gap in the series uses the nearest year in the window, not the whole history", () => {
  const p = project({ 1990: 10, 2000: 50, 2024: 100 }, 1, Infinity, 2024);
  assert.equal(p.trendFrom, 2024);
  assert.equal(p.growth, 0);
  const q = project({ 1990: 10, 2022: 81, 2024: 100 }, 3, Infinity, 2024);
  assert.equal(q.trendFrom, 2022);
  close(q.growth, Math.sqrt(100 / 81) - 1);
});

test("interpolateMidYear: straight lines between mid-years, extended at the ends", () => {
  const s = { 2025: 100, 2026: 110, 2027: 130 };
  close(interpolateMidYear(s, 2026.5), 110);
  close(interpolateMidYear(s, 2026), 105);    // 1 January 2026: halfway between 2025.5 and 2026.5
  close(interpolateMidYear(s, 2027), 120);
  close(interpolateMidYear(s, 2028), 140);    // extended along the last segment
  close(interpolateMidYear(s, 2025), 95);     // extended along the first segment
  assert.equal(interpolateMidYear({ 2026: 7 }, 2030), 7);
});

test("neededGrowth and verdict", () => {
  close(neededGrowth(100, 121, 2), 0.1);
  assert.equal(neededGrowth(1, 2, 0), Infinity);
  assert.equal(neededGrowth(12000, 11000, 0), 0);         // past the deadline, target met
  assert.deepEqual(verdict(0.05, neededGrowth(12000, 11000, 0)), { cls: "ok", key: "onTrack", text: "On track" });
  assert.deepEqual(verdict(0, 0.1), { cls: "bad", key: "offTrack", text: "Off track" });           // flat is not backwards
  assert.deepEqual(verdict(-6, -5), { cls: "ok", key: "onTrack", text: "On track" });             // reduction goal, cutting faster
  assert.deepEqual(verdict(-4.5, -5), { cls: "near", key: "close", text: "Close" });
  assert.deepEqual(verdict(-1, -31), { cls: "bad", key: "offTrack", text: "Off track" });
  assert.deepEqual(verdict(2.8, -31), { cls: "bad", key: "backwards", text: "Going backwards" });
  assert.deepEqual(verdict(0.2, 0.16), { cls: "ok", key: "onTrack", text: "On track" });
  assert.deepEqual(verdict(0.155, 0.164), { cls: "near", key: "close", text: "Close" });
  assert.deepEqual(verdict(0.05, 0.164), { cls: "bad", key: "offTrack", text: "Off track" });
  assert.deepEqual(verdict(-0.01, 0.164), { cls: "bad", key: "backwards", text: "Going backwards" });
});

test("sparkline: a change displayed as zero stays neutral; points are placed by year; label for screen readers", () => {
  assert.match(sparkline([2020, 2021], [1, 2], { change: 0.3, changeText: "0%", good: "down" }), /<b class="">/);
  const svg = sparkline([2000, 2001, 2020], [1, 2, 3]);
  assert.match(svg, /points="0\.0,\S+ 6\.0,\S+ 120\.0,/);
  assert.match(sparkline([2020, 2021], [1, 2], { label: "Annual emissions" }), /sr-only">Annual emissions/);
  assert.doesNotMatch(sparkline([2020, 2021], [1, 2]), /sr-only/);
});

test("sparkline colours follow which direction is good, and escapes text", () => {
  assert.equal(sparkline([2020], [1]), "");
  assert.match(sparkline([2020, 2021], [1, 2], { change: 5, good: "down", caption: "<x>" }), /class="down"/);
  assert.match(sparkline([2020, 2021], [1, 2], { change: 5, good: "up" }), /class="up"/);
  assert.match(sparkline([2020, 2021], [1, 2], { caption: "<x>" }), /&lt;x&gt;/);
});

test("time helpers agree", () => {
  const ms = Date.UTC(YEAR, 6, 2);
  close(tYears(ms), YEAR + yearFraction(ms));
  assert.ok(yearFraction(ms) > 0.49 && yearFraction(ms) < 0.51);
});

test("once caches success and retries after failure", async () => {
  let calls = 0;
  const ok = once(async () => ++calls);
  assert.equal(await ok(), 1);
  assert.equal(await ok(), 1);
  let fails = 0;
  const flaky = once(async () => { if (fails++ === 0) throw new Error("x"); return "y"; });
  await assert.rejects(flaky());
  assert.equal(await flaky(), "y");
});

test("restOfWorld: listed places come off the world, parts (partOf) aren't counted twice, laggards use their projection", () => {
  const r = restOfWorld({ annual: 100, lastValue: 90, lastYear: 2025 }, [
    { annual: 30, at: () => 25 }, { annual: 20, at: () => 15, partOf: "EU" }, { annual: 12, at: (y) => (y === 2025 ? 11 : 10) }
  ]);
  assert.deepEqual(r, { annual: 58, lastValue: 54, lastYear: 2025 });
  assert.equal(restOfWorld({ annual: 10, lastValue: 10, lastYear: 2025 }, [{ annual: 12, at: () => 9 }]).annual, 0);
});

test("changeClass and trendText follow the value as displayed", () => {
  assert.equal(changeClass(0.04, 1, "up"), "");
  assert.equal(changeClass(0.06, 1, "up"), "good");
  assert.equal(changeClass(0.06, 1, "down"), "bad");
  assert.equal(changeClass(-2, 0, "down"), "good");
  assert.equal(trendText(0.012), "▲ +1.2%");
  assert.equal(trendText(-0.008), "▼ -0.8%");
  assert.equal(trendText(-0.0004), "0.0%");
  assert.equal(trendText(null), "n/a");
});

test("message, statusCard and badge build plain-language pieces", () => {
  assert.deepEqual(message("bad", "Wrong way", "Short."), { tone: "bad", icon: TONE_ICON.bad, title: "Wrong way", text: "Short." });
  assert.deepEqual(message("ok", "Fine"), { tone: "ok", icon: TONE_ICON.ok, title: "Fine" });
  const html = statusCard({ label: "Safer limit <1.5°C>", msg: message("warn", "Running out", "About 8 years left."), pct: 140 });
  assert.match(html, /data-tone="warn"/);
  assert.match(html, /Safer limit &lt;1\.5°C&gt;/);
  assert.match(html, /width:100%/);                       // clamped
  assert.doesNotMatch(statusCard({ label: "x", msg: message("ok", "y") }), /sc-bar/);
  assert.equal(badge("", "x"), "");
  assert.equal(badge("ok", "▼ Falling"), '<span class="badge ok">▼ Falling</span>');
});

test("clock-core.css is well-formed: comments and braces balance (a stray */ silently drops the next rule)", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../clock-core.css", import.meta.url), "utf8");
  const opens = css.split("/*").length - 1, closes = css.split("*/").length - 1;
  assert.equal(closes, opens, "every /* needs exactly one */");
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(code, /\*\//, "a */ outside a comment");
  let depth = 0;
  for (const ch of code) { if (ch === "{") depth++; if (ch === "}") depth--; assert.ok(depth >= 0, "extra }"); }
  assert.equal(depth, 0, "unclosed {");
});

test("seeded: the same seed gives the same numbers, all in [0, 1)", () => {
  const a = seeded(42), b = seeded(42), c = seeded(43);
  const xs = Array.from({ length: 1000 }, a);
  assert.deepEqual(xs.slice(0, 5), Array.from({ length: 5 }, b));
  assert.notEqual(xs[0], c());
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  assert.ok(Math.abs(mean - 0.5) < 0.05, `mean ${mean}`);
});

test("languages: t() fills placeholders and falls back to English, then to the key", () => {
  addStrings("en", { "test.hi": "Hello {name}, {n} new" });
  addStrings("fr", { "test.hi": "Bonjour {name}, {n} nouveaux" });
  try {
    assert.equal(t("test.hi", { name: "Ana", n: 3 }), "Hello Ana, 3 new");
    setLang("fr");
    assert.equal(lang(), "fr");
    assert.equal(t("test.hi", { name: "Ana", n: 3 }), "Bonjour Ana, 3 nouveaux");
    assert.equal(t("core.showAll", { n: 12 }), "Voir les 12 pays");
    assert.ok(hasText("test.hi"));
    setLang("es");
    assert.equal(t("test.hi", { name: "Ana" }), "Hello Ana, {n} new");   // no Spanish yet: English, unknown {n} kept
    assert.ok(!hasText("test.hi"));
    assert.equal(t("no.such.key"), "no.such.key");
    setLang("xx");
    assert.equal(lang(), "en");
    assert.equal(asLang("ar"), "ar");
    assert.equal(asLang(null), "en");
  } finally { setLang("en"); }
});

test("languages: numbers, percentages, signs and verdicts follow the language", () => {
  try {
    assert.equal(fmt[1].format(1234.56), "1,234.6");
    setLang("fr");
    assert.equal(fmt[1].format(1234.56), "1 234,6");
    assert.equal(pct(4.86), "4,9 %");
    assert.equal(signedPct(2.8), "+2,8\u202f%");
    assert.equal(signedPct(-0.04), "0,0\u202f%");
    assert.equal(verdict(0.1, 0.1).text, "Sur la bonne voie");
    setLang("es");
    assert.equal(fmt[0].format(12345), "12.345");
    assert.equal(locale(), "es-ES");
    setLang("ar");
    assert.ok(isRtl());
    assert.equal(fmt[0].format(12345), "12,345");                        // Western digits in Arabic
    assert.equal(signed(5), "⁦+5⁩");
    assert.equal(pct(32, 0), "⁦32%⁩");                      // percentages too                          // isolated so the sign stays in front
    assert.equal(verdict(-0.1, 0.1).text, "يتراجع");
  } finally { setLang("en"); }
  assert.equal(signed(5), "+5");
  assert.equal(pct(4.86), "4.9%");
});

test("languages: every language has clock-core's strings, with the same placeholders", () => {
  const keys = (code) => { setLang(code); return Object.keys(LANGS).length && ["core.onTrack", "core.close", "core.offTrack",
    "core.backwards", "core.na", "core.showYearly", "core.yearly", "core.hideYearly", "core.showAll", "core.error", "core.language",
    "core.close.button", "core.embed.button", "core.embed.title", "core.embed.text", "core.embed.copy", "core.embed.copied",
    "core.embed.preview", "core.embed.credit"]; };
  try {
    for (const code of Object.keys(LANGS)) {
      for (const k of keys(code)) {
        assert.ok(hasText(k), `${code} lacks ${k}`);
        setLang("en"); const en = (t(k).match(/\{\w+\}/g) ?? []).sort().join();
        setLang(code); assert.equal((t(k).match(/\{\w+\}/g) ?? []).sort().join(), en, `${code} ${k} placeholders`);
      }
    }
  } finally { setLang("en"); }
});

test("regionName uses the browser's translations, English stays as given", () => {
  try {
    assert.equal(regionName("FR", "France"), "France");
    setLang("es");
    assert.equal(regionName("US", "United States"), "Estados Unidos");
    assert.equal(regionName(undefined, "Rest of world"), "Rest of world");
    setLang("fr");
    assert.equal(regionName("001", "World"), "Monde");
  } finally { setLang("en"); }
});

test("flagRegion reads the region code inside a flag; tOr prefers the current language's text", () => {
  assert.equal(flagRegion("🇫🇷"), "FR");
  assert.equal(flagRegion("🇪🇺"), "EU");
  assert.equal(flagRegion("🌐"), "");
  addStrings("fr", { "test.gas": "Méthane" });
  try {
    assert.equal(tOr("test.gas", "Methane"), "Methane");
    setLang("fr");
    assert.equal(tOr("test.gas", "Methane"), "Méthane");
    assert.equal(tOr("test.none", "Methane"), "Methane");
  } finally { setLang("en"); }
});
