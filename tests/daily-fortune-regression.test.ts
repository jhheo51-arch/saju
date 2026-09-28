import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculate } from "../lib/saju/chart";
import { createDailyFortune, isDailyFortune } from "../lib/saju/daily-fortune";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const server = source("../lib/saju/daily-fortune-server.ts");
const dailyRoute = source("../app/api/daily-fortune/route.ts");
const profileRoute = source("../app/api/daily-profile/route.ts");
const form = source("../app/saju-form.tsx");

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

test("궁궐 문은 기존 오늘·이번 주 카드 흐름을 대체하거나 스크롤 버튼으로 바꾸지 않는다", () => {
  assert.match(form, /className="preview today-preview"/);
  assert.match(form, /className="preview-cards today-cards"/);
  assert.match(form, /오늘과 이번 주 운세/);
  assert.match(form, /오늘의 운세 · \{today\}/);
  assert.match(form, /이번 주 운세 · \{result\.reading\?\.weekly/);
  assert.match(form, /오늘의 운세 보기/);
  assert.doesNotMatch(form, /scrollIntoView|window\.scrollTo/);
});
