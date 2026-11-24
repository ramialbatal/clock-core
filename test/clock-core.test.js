// Unit tests for the pure parts of clock-core. Run with: npm test (node --test, no dependencies).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signed, pct, digits, escapeHtml, parseCsv, seriesByCode, project, interpolateMidYear,
  neededGrowth, verdict, sparkline, tYears, yearFraction, YEAR, fmt, once
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

test("project: multi-year window and zero base", () => {
  close(project({ 2020: 100, 2021: 0, 2022: 121 }, 2, Infinity, 2022).growth, 0.1);
  assert.equal(project({ 2023: 0, 2024: 5 }, 1, Infinity, 2024).growth, 0);
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
  assert.deepEqual(verdict(0.2, 0.16), { cls: "ok", text: "On track" });
  assert.deepEqual(verdict(0.155, 0.164), { cls: "near", text: "Close" });
  assert.deepEqual(verdict(0.05, 0.164), { cls: "bad", text: "Off track" });
  assert.deepEqual(verdict(-0.01, 0.164), { cls: "bad", text: "Going backwards" });
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
