import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculate } from "../lib/saju/chart";
import { koreaDate, parseInterpretationResponse } from "../lib/saju/interpretation";
import { parseSavedInterpretation } from "../lib/saju/interpretation-storage";
import { weekCalendar } from "../lib/saju/solar-terms";

const date = "2026-09-23";
const weekly = {
  startDate: "2026-09-21",
  endDate: "2026-09-27",
  headline: "이번 주",
  body: "한 주 동안 대화를 돌아보세요.",
  action: "친구에게 안부를 물어보세요.",
};
const oldReading = {
  personality: { headline: "성향", body: "신금은 차분히 생각할 수 있어요." },
  topic: { kind: "relationship", headline: "대화", body: "무자 단서를 참고했어요." },
  today: { date, headline: "오늘", body: "마음을 살펴보세요." },
  weekly: (({ action: _action, ...rest }) => rest)(weekly),
};

test("추분이 든 2026-09-21 주는 월~일 7일과 9월 23일 추분을 표시한다", () => {
  const calendar = weekCalendar("2026-09-21");
  assert.deepEqual(calendar.days.map(({ date, weekday }) => [date, weekday]), [
    ["2026-09-21", "월"], ["2026-09-22", "화"], ["2026-09-23", "수"],
    ["2026-09-24", "목"], ["2026-09-25", "금"], ["2026-09-26", "토"],
    ["2026-09-27", "일"],
  ]);
  assert.equal(calendar.days[2].term, "추분");
  assert.equal(calendar.days.filter((day) => day.term).length, 1);
});

test("절기 없는 주는 다음 절기 날짜를, 연말 주는 새해 절기를 알려준다", () => {
  const withoutTerm = weekCalendar("2026-09-28");
  assert.ok(withoutTerm.days.every((day) => day.term === undefined));
  assert.deepEqual(withoutTerm.nextTerm, { date: "2026-10-08", name: "한로" });

  const yearEnd = weekCalendar("2025-12-29");
  assert.deepEqual(yearEnd.days.map(({ date }) => date), [
    "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01",
    "2026-01-02", "2026-01-03", "2026-01-04",
  ]);
  assert.deepEqual(yearEnd.nextTerm, { date: "2026-01-05", name: "소한" });
  assert.deepEqual(weekCalendar("2026-12-28").nextTerm, { date: "2027-01-05", name: "소한" });

  // UTC로는 전날이어도 한국 시간 자정을 넘으면 다음 주입니다.
  assert.equal(koreaDate(new Date("2026-09-20T15:30:00Z")), "2026-09-21");
});

test("새 응답에는 오늘·이번 주 행동 문장이 각각 필요하다", () => {
  const current = {
    ...oldReading,
    today: { ...oldReading.today, action: "오늘 마음을 한 줄 적어보세요." },
    weekly,
  };
  assert.deepEqual(
    parseInterpretationResponse(current, "relationship", date, "", true, false, true),
    current,
  );
  for (const invalid of [
    { ...current, today: oldReading.today },
    { ...current, weekly: oldReading.weekly },
    { ...current, today: { ...current.today, action: " " } },
    { ...current, weekly: { ...weekly, action: "가".repeat(161) } },
  ]) {
    assert.throws(() => parseInterpretationResponse(invalid, "relationship", date, "", true, false, true));
  }
});

test("이전 저장 결과에는 행동 문장이 없어도 복원하고 임의로 만들지 않는다", () => {
  const parsed = parseInterpretationResponse(oldReading, "relationship", date);
  assert.equal(parsed.today.action, undefined);
  assert.equal(parsed.weekly?.action, undefined);
  const saved = parseSavedInterpretation({
    version: 1,
    createdAt: "2026-09-23T01:02:03.000Z",
    chart: calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "relationship" }),
    topic: "relationship",
    reading: oldReading,
  });
  assert.ok(saved);
  assert.equal(saved.reading.today.action, undefined);
  assert.equal(saved.reading.weekly?.action, undefined);
});

test("운세 화면은 실제 차트 배지·별도 행동 상자·7일 절기 띠를 사용한다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.match(source, /className="fortune-basis"/);
  assert.match(source, /TermHelp term="일간"/);
  assert.match(source, /TermHelp term="월주"/);
  assert.match(source, /result\.chart\.dayMaster\.korean/);
  assert.match(source, /result\.chart\.pillars\[1\]\.korean/);
  assert.match(source, /result\.reading\?\.today\.action && <div className="fortune-action"/);
  assert.match(source, /result\.reading\?\.weekly\?\.action && <div className="fortune-action"/);
  assert.match(source, /calendar\.days\.map/);
  assert.match(source, /calendar\.nextTerm/);
  assert.match(source, /절기는 계절을 나누는 달력 날짜/);
  assert.match(source, /요일별 운세 점수는 아니에요/);
});
