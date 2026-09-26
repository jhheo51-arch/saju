import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculate } from "../lib/saju/chart";
import { parseInterpretationResponse } from "../lib/saju/interpretation";
import { parseSavedInterpretation } from "../lib/saju/interpretation-storage";

const date = "2026-09-23";
const weekDates = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];
const days = weekDates.map((day, index) => ({ date: day, body: `${index + 1}번째 날에는 대화를 돌아보세요.` }));
const reading = {
  personality: { headline: "성향", body: "차분히 대화를 살펴볼 수 있어요." },
  topic: { kind: "relationship", headline: "관계", body: "작은 질문을 건네 보세요." },
  today: { date, headline: "오늘", body: "오늘은 상대의 말을 끝까지 들어 보세요.", action: "안부를 먼저 물어보세요." },
  weekly: {
    startDate: "2026-09-21",
    endDate: "2026-09-27",
    headline: "이번 주",
    body: "이번 주의 대화를 돌아보세요.",
    action: "짧은 안부를 건네 보세요.",
    days,
  },
};

function parseNew(raw: unknown) {
  return parseInterpretationResponse(raw, "relationship", date, "", true, false, true, true);
}

test("새 응답은 월~일 정확한 7개 날짜를 받고 오늘 날짜 본문은 today와 일치시킨다", () => {
  const parsed = parseNew(reading);
  assert.deepEqual(parsed.weekly?.days?.map(({ date }) => date), weekDates);
  assert.equal(parsed.weekly?.days?.[2].body, reading.today.body);
  assert.equal(parsed.weekly?.days?.[1].body, reading.weekly.days[1].body);
  assert.equal(reading.weekly.days[2].body, "3번째 날에는 대화를 돌아보세요.", "원본 응답은 바꾸지 않음");
});

test("날짜별 풀이 누락·6개·8개·중복·순서 변경·기간 밖 날짜를 거절한다", () => {
  const altered = [
    { ...reading.weekly, days: undefined },
    { ...reading.weekly, days: days.slice(0, 6) },
    { ...reading.weekly, days: [...days, { date: "2026-09-28", body: "기간 밖" }] },
    { ...reading.weekly, days: days.map((day, index) => index === 1 ? { ...day, date: "2026-09-21" } : day) },
    { ...reading.weekly, days: [days[1], days[0], ...days.slice(2)] },
    { ...reading.weekly, days: days.map((day, index) => index === 6 ? { ...day, date: "2026-09-28" } : day) },
  ];
  for (const weekly of altered) {
    assert.throws(() => parseNew({ ...reading, weekly }));
  }
});

test("날짜별 풀이의 빈 본문·너무 긴 본문·글자가 아닌 본문을 거절한다", () => {
  for (const body of [" ", "가".repeat(321), 42]) {
    const altered = days.map((day, index) => index === 0 ? { ...day, body } : day);
    assert.throws(() => parseNew({ ...reading, weekly: { ...reading.weekly, days: altered } }));
  }
});

test("예전 저장 결과는 weekly.days 없이 복원하고 날짜별 풀이를 꾸며내지 않는다", () => {
  const { days: _days, ...oldWeekly } = reading.weekly;
  const oldReading = { ...reading, weekly: oldWeekly };
  assert.equal(parseInterpretationResponse(oldReading, "relationship", date).weekly?.days, undefined);
  const saved = parseSavedInterpretation({
    version: 1,
    createdAt: "2026-09-23T01:02:03.000Z",
    topic: "relationship",
    chart: calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "relationship" }),
    reading: oldReading,
  });
  assert.ok(saved);
  assert.equal(saved.reading.weekly?.days, undefined);
});

test("날짜 선택과 한 주 전체 선택은 같은 카드 내용을 바꾸고 눌림 상태를 알려준다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.match(source, /className="week-overview-button" aria-pressed=\{!selectedDailyFortune\}/);
  assert.match(source, /onClick=\{\(\) => setSelectedWeeklyDate\(null\)\}>한 주 전체/);
  assert.match(source, /aria-pressed=\{selectedDailyFortune\?\.date === day\.date\}/);
  assert.match(source, /onClick=\{\(\) => setSelectedWeeklyDate\(day\.date\)\}/);
  assert.match(source, /aria-controls="weekly-reading-content"/);
  assert.match(source, /id="weekly-reading-content" className="weekly-reading-content" aria-live="polite"/);
  assert.match(source, /selectedDailyFortune\s*\? `\$\{selectedWeekday\}/);
  assert.match(source, /selectedDailyFortune\.body/);
  assert.match(source, /이전 결과에는 날짜별 풀이가 없어요/);
});

test("용어 설명은 배지의 줄바꿈 금지를 물려받지 않고 좁은 화면에도 맞춘다", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const popover = css.match(/\.term-popover\s*\{([^}]*)\}/)?.[1];
  assert.ok(popover);
  assert.match(popover, /width:\s*min\(360px, calc\(100vw - 32px\)\)/);
  assert.match(popover, /white-space:\s*normal/);
  assert.match(popover, /overflow-wrap:\s*anywhere/);
  assert.match(popover, /overflow-x:\s*hidden/);
  assert.match(popover, /max-height:\s*calc\(100dvh - 32px\)/);
  assert.match(popover, /overflow-y:\s*auto/);
  assert.match(css, /\.week-calendar-days\s*\{[^}]*grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.week-day-button\[aria-pressed="true"\]/);
});
