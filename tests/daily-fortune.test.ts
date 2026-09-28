import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../lib/saju/chart";
import { createDailyFortune, isDailyFortune } from "../lib/saju/daily-fortune";

const chart = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" });

test("오늘의 운세는 계산된 사주 차트와 한국 날짜로만 안정적으로 만들어진다", () => {
  const first = createDailyFortune(chart, "2026-09-28");
  const second = createDailyFortune(chart, "2026-09-28");

  assert.deepEqual(second, first, "같은 사용자·같은 날짜에는 같은 저장용 운세를 만든다");
  assert.equal(first.date, "2026-09-28");
  assert.ok(first.headline.length > 0);
  assert.ok(first.body.length > 0);
  assert.ok(first.action.length > 0);
  assert.match(first.color.hex, /^#[0-9a-f]{6}$/i);
  assert.ok(first.number >= 1 && first.number <= 9);
  assert.equal(isDailyFortune(first), true);
});

test("오늘의 운세 생성은 날짜가 아닌 개인정보나 임의 형식을 받지 않는다", () => {
  for (const date of ["2026/09/28", "2026-9-28", "", "2026-09-28T00:00:00Z"]) {
    assert.throws(() => createDailyFortune(chart, date), /날짜 형식/);
  }
});

test("저장소에서 읽은 운세는 필수 내용과 색상·숫자가 모두 올바를 때만 사용한다", () => {
  const fortune = createDailyFortune(chart, "2026-09-28");
  assert.equal(isDailyFortune({ ...fortune, number: 0 }), false);
  assert.equal(isDailyFortune({ ...fortune, date: "2026/09/28" }), false);
  assert.equal(isDailyFortune({ ...fortune, headline: "   " }), false);
  assert.equal(isDailyFortune({ ...fortune, color: { ...fortune.color, hex: "blue" } }), false);
  assert.equal(isDailyFortune({ ...fortune, color: null }), false);
});
