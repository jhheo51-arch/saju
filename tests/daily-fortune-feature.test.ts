import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const migration = source("../supabase/migrations/20260928000100_create_daily_fortunes.sql");
const scheduler = source("../vercel.json");
const server = source("../lib/saju/daily-fortune-server.ts");
const dailyRoute = source("../app/api/daily-fortune/route.ts");
const profileRoute = source("../app/api/daily-profile/route.ts");
const cronRoute = source("../app/api/cron/daily-fortune/route.ts");
const form = source("../app/saju-form.tsx");
const styles = source("../app/globals.css");

test("Vercel은 한국 오전 9시(UTC 00:00)에 오늘 운세 예약 경로를 호출한다", () => {
  const config = JSON.parse(scheduler) as { crons: Array<{ path: string; schedule: string }> };
  assert.deepEqual(config.crons, [{ path: "/api/cron/daily-fortune", schedule: "0 0 * * *" }]);
  assert.match(cronRoute, /process\.env\.CRON_SECRET/);
  assert.match(cronRoute, /authorization[\s\S]*Bearer \$\{secret\}/);
  assert.match(cronRoute, /koreaDate\(\)/);
  assert.match(cronRoute, /prepareDailyFortunes\(date\)/);
  assert.match(cronRoute, /status: 401/);
  assert.match(cronRoute, /Cache-Control.*no-store/);
});

test("하루·사용자별 운세는 하나만 저장하고, 일반 사용자는 자기 행만 읽는다", () => {
  assert.match(migration, /primary key \(user_id, fortune_date\)/);
  assert.match(migration, /alter table public\.user_saju_profiles enable row level security/);
  assert.match(migration, /alter table public\.daily_fortunes enable row level security/);
  assert.match(migration, /revoke all on table public\.user_saju_profiles from anon, authenticated/);
  assert.match(migration, /revoke all on table public\.daily_fortunes from anon, authenticated/);
  assert.match(migration, /create policy "user_saju_profiles_select_own"[\s\S]*auth\.uid\(\).*user_id/);
  assert.match(migration, /create policy "daily_fortunes_select_own"[\s\S]*auth\.uid\(\).*user_id/);
  assert.doesNotMatch(migration, /birth_date|birth_time|date_of_birth/i, "원본 생년월일·시각 열을 만들지 않는다");
});

test("서버는 로그인 사용자와 기본 사주 차트만 사용하고, 같은 날 저장본은 재사용한다", () => {
  assert.match(server, /auth\.getUser\(match\[1\]\)/);
  assert.match(server, /calculate\(\{ \.\.\.input, topic: "general" \}\)/);
  assert.match(server, /from\("user_saju_profiles"\)\.upsert/);
  assert.match(server, /from\("daily_fortunes"\)[\s\S]*\.eq\("user_id", userId\)\.eq\("fortune_date", date\)/);
  assert.match(server, /onConflict: "user_id,fortune_date"/);
  assert.match(server, /saved\.source_profile_updated_at === profile\.updated_at/);
  assert.match(server, /isDailyFortune\(saved\.content\)[\s\S]*saved\.content\.date === date/);
  assert.match(server, /for \(const profile of data \|\| \[\]\)[\s\S]*catch \{\s*failed\+\+;/);
  assert.doesNotMatch(server, /GEMINI_API_KEY|gemini/i);
});

test("사용자 API는 인증된 본인 운세만 no-store로 읽고, 기본 정보 저장 뒤 즉시 준비한다", () => {
  assert.match(dailyRoute, /authenticatedDailyFortuneUser\(request\)/);
  assert.match(dailyRoute, /ensureDailyFortune\(user\.id\)/);
  assert.match(dailyRoute, /status: 404/);
  assert.match(dailyRoute, /Cache-Control.*no-store/);
  assert.match(profileRoute, /calendar !== "solar"/);
  assert.match(profileRoute, /authenticatedDailyFortuneUser\(request\)/);
  assert.match(profileRoute, /saveDailyFortuneProfile\(user\.id, \{ date, time, calendar \}\)/);
  assert.match(profileRoute, /ensureDailyFortune\(user\.id\)/);
});

test("첫 방문 궁궐 문은 접근 가능하고, 한 번 연 뒤에는 기존 오늘·이번 주 영역을 계속 쓴다", () => {
  assert.match(form, /daily-palace-door:\$\{user\.id\}:\$\{fortune\.date\}/);
  assert.match(form, /window\.localStorage\.getItem/);
  assert.match(form, /window\.localStorage\.setItem/);
  assert.match(form, /aria-expanded=\{dailyDoorOpened\}/);
  assert.match(form, /aria-controls="daily-palace-fortune"/);
  assert.match(form, /type="button"/);
  assert.match(form, /오늘의 운세 보기/);
  assert.match(form, /prefers-reduced-motion: reduce/);
  assert.match(form, /dailyFortuneTitleRef\.current\?\.focus\(\)/);
  assert.match(form, /오늘과 이번 주 운세/);
  assert.match(styles, /\.palace-door-button[\s\S]*min-height: 44px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none !important/);
});
