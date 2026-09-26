import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculate } from "../lib/saju/chart";
import { dailyFortuneCues } from "../lib/saju/daily-fortune-cues";

const chart = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "career" });

test("오늘의 색과 숫자는 같은 사주·날짜에 같은 결과를 돌려준다", () => {
  const first = dailyFortuneCues(chart, "2026-09-23");
  const second = dailyFortuneCues(chart, "2026-09-23");

  assert.deepEqual(second, first);
  assert.match(first.color.name, /\S/);
  assert.match(first.color.hex, /^#[0-9A-F]{6}$/i);
  assert.ok(first.number >= 1 && first.number <= 9);
});

test("날짜가 달라지면 재미 포인트도 바뀔 수 있다", () => {
  const values = new Set(Array.from({ length: 9 }, (_, index) => {
    const cue = dailyFortuneCues(chart, `2026-09-${String(20 + index).padStart(2, "0")}`);
    return `${cue.color.name}-${cue.number}`;
  }));

  assert.ok(values.size > 1);
});

test("오늘 카드에는 색상 이름·숫자·재미용 안내가 있고 빈 높이를 강제로 늘리지 않는다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /오늘의 재미 포인트/);
  assert.match(source, /색상 <b>\{todayCues\.color\.name\}<\/b>/);
  assert.match(source, /숫자 <b>\{todayCues\.number\}<\/b>/);
  assert.match(source, /가벼운 재미용 제안/);
  assert.match(css, /\.today-cards\s*\{[^}]*align-items:\s*start;/);
  assert.match(css, /\.fortune-cue\s*\{[^}]*min-height:\s*44px;/);
});
