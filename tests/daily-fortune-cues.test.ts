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

test("저장된 오늘 운세 카드에는 색상 이름·숫자가 있고 빈 높이를 강제로 늘리지 않는다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  // 색상·숫자는 해석 응답의 임시 단서가 아니라 DB에 저장된 dailyFortune을 표시합니다.
  assert.match(source, /dailyFortune\.color\.hex/);
  assert.match(source, /오늘의 색\s*·\s*\{dailyFortune\.color\.name\}\s*\/\s*숫자\s*·\s*\{dailyFortune\.number\}/);
  assert.match(source, /오늘의 운세 보기/);
  assert.match(css, /\.today-cards\s*\{[^}]*align-items:\s*start;/);
  assert.match(css, /\.palace-door-button\s*\{[^}]*min-height:\s*44px;/);
});
