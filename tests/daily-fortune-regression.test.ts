import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculate } from "../lib/saju/chart";
import { createDailyFortune, dailyFortuneRecommendation, isDailyFortune } from "../lib/saju/daily-fortune";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const server = source("../lib/saju/daily-fortune-server.ts");
const dailyRoute = source("../app/api/daily-fortune/route.ts");
const profileRoute = source("../app/api/daily-profile/route.ts");
const form = source("../app/saju-form.tsx");
const interpretation = source("../lib/saju/interpretation.ts");
const interpretRoute = source("../app/api/interpret/route.ts");

test("기존 로그인 사용자는 saju_results의 chart만으로 오늘 운세 기준 프로필을 자동 준비한다", () => {
  assert.match(server, /from\("saju_results"\)[\s\S]*select\("chart/);
  assert.match(server, /from\("saju_results"\)[\s\S]*\.eq\("user_id", userId\)[\s\S]*maybeSingle/);
  assert.match(server, /isChart\([^)]*chart[^)]*\)/);
  assert.match(server, /from\("user_saju_profiles"\)\.upsert/);
  assert.match(dailyRoute, /ensureDailyFortune\(user\.id\)/);
});

test("Cron은 새 프로필과 기존 saju_results 사용자를 합쳐 중복 없이 당일 운세를 미리 만든다", () => {
  const prepare = server.slice(server.indexOf("export async function prepareDailyFortunes"));
  assert.match(prepare, /from\("user_saju_profiles"\)[\s\S]*select\("user_id/);
  assert.match(prepare, /from\("saju_results"\)[\s\S]*select\("user_id/);
  assert.match(prepare, /new Set(?:<string>)?\([\s\S]*profile\.user_id/, "두 목록의 같은 사용자를 한 번만 처리할 집합이 필요합니다");
  assert.match(prepare, /profileUserIds\.has\(savedResult\.user_id\)\) continue/);
  assert.match(prepare, /for \(const savedResult of savedResults \|\| \[\]\)/);
  assert.match(prepare, /from\("daily_fortunes"\)[\s\S]*\.eq\("user_id", savedResult\.user_id\)[\s\S]*\.eq\("fortune_date", date\)/);
  assert.match(prepare, /ensureDailyFortune\(savedResult\.user_id, date\)/);
});

test("오전 9시 전에도 로그인 사용자는 오늘 운세 준비·조회 API를 사용할 수 있다", () => {
  const userFacingSources = `${dailyRoute}\n${profileRoute}\n${server}`;
  assert.doesNotMatch(userFacingSources, /getHours\(\)[\s\S]{0,100}(?:<|<=)\s*9/);
  assert.doesNotMatch(userFacingSources, /09:00|오전\s*9시|9시\s*(?:전|이전)/);
  assert.match(dailyRoute, /ensureDailyFortune\(user\.id\)/);
  assert.match(profileRoute, /ensureDailyFortune\(user\.id\)/);
});

test("준비·저장되는 오늘 운세에는 색상과 추천 숫자가 있고 궁궐 문 카드에도 표시된다", () => {
  const chart = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" });
  const fortune = createDailyFortune(chart, "2026-09-28");
  assert.equal(isDailyFortune(fortune), true);
  assert.ok(fortune.color.name.trim().length > 0);
  assert.match(fortune.color.hex, /^#[0-9a-f]{6}$/i);
  assert.ok(Number.isInteger(fortune.number) && fortune.number >= 1 && fortune.number <= 9);
  assert.match(server, /content: fortune/);
  assert.match(form, /dailyFortune\.color\.hex/);
  assert.match(form, /dailyFortune\.color\.name/);
  assert.match(form, /dailyFortune\.number/);
});

test("새 궁궐 추천은 같은 사주·날짜에는 고정되고, 연속 날짜에는 색 또는 숫자가 바뀐다", () => {
  const chart = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" });
  const first = dailyFortuneRecommendation(chart, "2026-09-28");
  const repeated = dailyFortuneRecommendation(chart, "2026-09-28");
  const nextDay = dailyFortuneRecommendation(chart, "2026-09-29");

  assert.deepEqual(repeated, first, "같은 사주와 날짜는 저장 전후에도 같은 추천이어야 합니다.");
  assert.notDeepEqual(
    { color: nextDay.color.hex, number: nextDay.number },
    { color: first.color.hex, number: first.number },
    "날짜 순환은 다음 날 추천 색 또는 숫자에 반영되어야 합니다.",
  );
});

test("오행 분포가 다른 사주는 같은 날짜에도 다른 추천을 받을 수 있다", () => {
  const waterMetalHeavy = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" });
  const fireHeavy = calculate({ date: "1990-01-01", time: "12:00", calendar: "solar", topic: "general" });
  const date = "2026-09-28";
  const first = dailyFortuneRecommendation(waterMetalHeavy, date);
  const second = dailyFortuneRecommendation(fireHeavy, date);

  assert.notDeepEqual(waterMetalHeavy.elements, fireHeavy.elements, "검증용 사주는 서로 다른 오행 분포여야 합니다.");
  assert.notDeepEqual(
    { element: first.element, color: first.color.hex, number: first.number },
    { element: second.element, color: second.color.hex, number: second.number },
    "같은 날짜라도 사주 오행 분포가 다르면 추천도 달라질 수 있어야 합니다.",
  );
});

test("식별값이 없는 이전 저장 운세는 새 궁궐 추천으로 갱신 대상이 된다", () => {
  const chart = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" });
  const current = createDailyFortune(chart, "2026-09-28");
  const legacyWithoutScheme = { ...current } as Record<string, unknown>;
  delete legacyWithoutScheme.scheme;
  const legacyScheme = { ...current, scheme: "palace-door-v1" };

  assert.equal(isDailyFortune(current), true);
  assert.equal(isDailyFortune(legacyWithoutScheme), false, "식별값 없는 이전 행을 그대로 재사용하면 안 됩니다.");
  assert.equal(isDailyFortune(legacyScheme), false, "이전 규칙 식별값의 행은 새 추천으로 갱신해야 합니다.");
});

test("열린 궁궐 문 안에는 색·숫자와 한 줄 운세만 보이고, 행동 문구는 바깥에 중복하지 않는다", () => {
  const palaceSection = form.match(/<section className="palace-fortune"[\s\S]*?<\/section>/)?.[0];

  assert.ok(palaceSection, "오늘의 운세를 담는 궁궐 영역이 필요합니다.");
  assert.match(palaceSection, /dailyDoorOpened && <div id="daily-palace-fortune" className="palace-fortune-content">/);
  assert.match(palaceSection, /dailyFortune\.color\.name[\s\S]*dailyFortune\.number/);
  assert.match(palaceSection, /className="palace-fortune-line">\{dailyFortune\.body\}<\/p>/);
  assert.equal((palaceSection.match(/dailyFortune\.body/g) || []).length, 1, "운세 본문은 문 안에서 한 번만 표시합니다.");
  assert.doesNotMatch(palaceSection, /dailyFortune\.action/, "오늘의 행동 문구를 문 안팎에 중복 표시하지 않습니다.");
});

test("궁궐 문은 기존 오늘·이번 주 카드 흐름을 대체하거나 스크롤 버튼으로 바꾸지 않는다", () => {
  assert.match(form, /className="preview today-preview"/);
  assert.match(form, /className="preview-cards today-cards"/);
  assert.match(form, /오늘과 이번 주 운세/);
  assert.match(form, /오늘의 운세 · \{today\}/);
  assert.match(form, /이번 주 운세 ·[\s\S]*result\.reading\?\.weekly/);
  assert.match(form, /오늘의 운세 보기/);
  assert.doesNotMatch(form, /scrollIntoView|window\.scrollTo/);
});

test("로그인 사용자가 나의 사주 해석 보기를 누르면 오늘 운세를 준비한 뒤 열린 궁궐 카드에서 바로 본다", () => {
  const submit = form.slice(form.indexOf("function handleSubmit"), form.indexOf("async function deleteSaved"));
  const saveProfile = form.slice(form.indexOf("async function saveDailyProfile"), form.indexOf("function openDailyDoor"));

  assert.match(submit, /void saveDailyProfile\(input\);[\s\S]*void requestReading\(input\);/);
  assert.match(saveProfile, /setDailyFortuneLoading\(true\);/, "저장 응답을 기다리는 동안에도 오늘 운세 준비 상태가 보여야 합니다");
  assert.match(saveProfile, /setDailyFortune\([^\n]+\);[\s\S]*setDailyDoorVisible\(true\);[\s\S]*setDailyDoorOpened\(true\);/);
  assert.match(saveProfile, /finally[\s\S]*setDailyFortuneLoading\(false\);/);
  assert.match(form, /dailyDoorOpened && <div id="daily-palace-fortune"[\s\S]*dailyFortune\.color\.name[\s\S]*dailyFortune\.number[\s\S]*dailyFortune\.body/);
});

test("저장된 오늘 운세를 다시 열 때에도 색상·숫자가 있는 열린 궁궐 카드로 복원한다", () => {
  const load = form.slice(form.indexOf("async function loadDailyFortune"), form.indexOf("async function saveDailyProfile"));

  assert.match(load, /const seenKey = `daily-palace-door:\$\{user\.id\}:\$\{fortune\.date\}`/);
  assert.match(load, /setDailyDoorVisible\(true\);[\s\S]*setDailyDoorOpened\(window\.localStorage\.getItem\(seenKey\) === "opened"\);/);
  assert.match(form, /window\.localStorage\.setItem\(`daily-palace-door:\$\{user\.id\}:\$\{dailyFortune\.date\}`, "opened"\)/);
});

test("이번 주 운세는 기존의 월~일 날짜 선택과 한 주 전체 보기 UI를 유지한다", () => {
  assert.match(form, /import \{ weekCalendar \} from "\.\.\/lib\/saju\/solar-terms"/);
  assert.match(form, /const \[selectedWeeklyDate, setSelectedWeeklyDate\] = useState<string \| null>\(null\);/);
  assert.match(form, /const calendar = weekCalendar\(result\?\.reading\?\.weekly\?\.startDate \|\| currentWeek\.startDate\);/);
  assert.match(form, /const hasDailyFortunes = result\?\.reading\?\.weekly\?\.days\?\.length === 7;/);
  assert.match(form, /className="week-calendar"/);
  assert.match(form, /className="week-overview-button"[\s\S]*한 주 전체/);
  assert.match(form, /className=\{`week-day-button/);
  assert.match(form, /onClick=\{\(\) => setSelectedWeeklyDate\(day\.date\)\}/);
});

test("이번 주 운세는 한 주 전체 설명과 행동 제안, 선택한 날짜별 설명을 함께 제공한다", () => {
  assert.match(form, /id="weekly-reading-content"/);
  assert.match(form, /selectedDailyFortune[\s\S]*selectedWeekday\}요일 운세/);
  assert.match(form, /result\.reading\?\.weekly\?\.action[\s\S]*이번 주의 한 걸음[\s\S]*result\.reading\.weekly\.action/);
  assert.match(interpretation, /export type DailyFortune = \{ date: string; body: string \}/);
  assert.match(interpretation, /weekly\?: ReadingSection & \{ startDate: string; endDate: string; action\?: string; days\?: DailyFortune\[\] \}/);
  assert.match(interpretation, /value\.weekly\.action !== undefined/);
  assert.match(interpretation, /value\.weekly\.days !== undefined/);
  assert.match(interpretation, /날짜별 풀이가 일곱 개가 아닙니다/);
  assert.match(interpretRoute, /action: \{ type: "string" \}[\s\S]*days: \{ type: "array"/);
  assert.match(interpretRoute, /required: \["startDate", "endDate", "headline", "body", "action", "days"\]/);
});
