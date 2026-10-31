import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableTimes,
  fitsHours,
  isDate,
  slotMinutes,
  zonedNow,
  addDays,
  formatTime,
} from "../lib/scheduling.ts";
const now = new Date("2026-10-27T11:59:00Z");
const monday = "2026-11-02";
test("valida calendário real, incluindo anos bissextos", () => {
  assert.equal(isDate("2026-02-30"), false);
  assert.equal(isDate("2028-02-29"), true);
  assert.equal(isDate("2026-02-29"), false);
  assert.equal(isDate("banana"), false);
});
test("usa o fuso do negócio, inclusive na virada do dia", () => {
  assert.deepEqual(zonedNow(new Date("2026-10-28T01:30:00Z")), {
    date: "2026-10-27",
    minute: 1350,
  });
});
test("não oferece domingo", () => {
  assert.deepEqual(availableTimes("2026-11-01", 30, [], now), []);
});
test("impede dias anteriores e limite acima de 90 dias", () => {
  assert.deepEqual(availableTimes("2026-10-26", 30, [], now), []);
  assert.deepEqual(availableTimes(addDays("2026-10-27", 91), 30, [], now), []);
});
test("respeita duração, almoço e fechamento", () => {
  const times = availableTimes(monday, 60, [], now);
  assert.equal(times[0], 540);
  assert.equal(times.at(-1), 1020);
  assert.ok(times.includes(660));
  assert.ok(!times.includes(675));
  assert.ok(!times.includes(720));
  assert.ok(times.includes(780));
});
test("bloqueia toda a duração e permite intervalos adjacentes", () => {
  const times = availableTimes(monday, 30, [570, 585], now);
  assert.ok(times.includes(540));
  assert.ok(!times.includes(555));
  assert.ok(!times.includes(570));
  assert.ok(!times.includes(585));
  assert.ok(times.includes(600));
});
test("não oferece minutos que já passaram hoje", () => {
  const atTen = new Date("2026-10-27T13:00:00Z");
  const times = availableTimes("2026-10-27", 30, [], atTen);
  assert.equal(times[0], 615);
});
test("rejeita início desalinhado e duração inválida", () => {
  assert.equal(fitsHours(541, 30), false);
  assert.equal(fitsHours(540, 0), false);
  assert.equal(fitsHours(540, 20), false);
  assert.equal(fitsHours(540, -15), false);
});
test("decompõe um atendimento em intervalos de 15 minutos", () => {
  assert.deepEqual(slotMinutes(540, 60), [540, 555, 570, 585]);
  assert.equal(formatTime(1065), "17:45");
});
