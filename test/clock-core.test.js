// Unit tests for the pure parts of clock-core. Run with: npm test (node --test, no dependencies).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signed, pct, digits, escapeHtml, parseCsv, seriesByCode, namesByCode, num, shown, shownSign, project,
  interpolateMidYear, neededGrowth, verdict, sparkline, tYears, yearFraction, YEAR, fmt, once
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
  assert.deepEqual(verdict(0.05, neededGrowth(12000, 11000, 0)), { cls: "ok", text: "On track" });
  assert.deepEqual(verdict(0, 0.1), { cls: "bad", text: "Off track" });           // flat is not backwards
  assert.deepEqual(verdict(-6, -5), { cls: "ok", text: "On track" });             // reduction goal, cutting faster
  assert.deepEqual(verdict(-4.5, -5), { cls: "near", text: "Close" });
  assert.deepEqual(verdict(-1, -31), { cls: "bad", text: "Off track" });
  assert.deepEqual(verdict(2.8, -31), { cls: "bad", text: "Going backwards" });
  assert.deepEqual(verdict(0.2, 0.16), { cls: "ok", text: "On track" });
  assert.deepEqual(verdict(0.155, 0.164), { cls: "near", text: "Close" });
  assert.deepEqual(verdict(0.05, 0.164), { cls: "bad", text: "Off track" });
  assert.deepEqual(verdict(-0.01, 0.164), { cls: "bad", text: "Going backwards" });
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
