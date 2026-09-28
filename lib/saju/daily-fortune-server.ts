import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { calculate, type SajuChart, type SajuInput } from "./chart";
import { createDailyFortune, isDailyFortune, type DailyFortune } from "./daily-fortune";
import { koreaDate } from "./interpretation";

type ProfileRow = { user_id: string; chart: unknown; updated_at: string };
type FortuneRow = { content: unknown; source_profile_updated_at: string };
type SavedResultRow = { chart: unknown; created_at: string };

export class DailyFortuneServerError extends Error {
  constructor(message: string, readonly status = 503) {
    super(message);
  }
}

function serverConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new DailyFortuneServerError("오늘의 운세 저장소 설정이 필요합니다.");
  return { url, serviceRole };
}

export function dailyFortuneAdmin(): SupabaseClient {
  const { url, serviceRole } = serverConfig();
  return createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticatedDailyFortuneUser(request: Request): Promise<User> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new DailyFortuneServerError("Google 로그인 후 오늘의 운세를 이용해 주세요.", 401);
  const { data, error } = await dailyFortuneAdmin().auth.getUser(match[1]);
  if (error || !data.user) throw new DailyFortuneServerError("로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.", 401);
  return data.user;
}

function isChart(value: unknown): value is SajuChart {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Array.isArray((value as SajuChart).pillars) && (value as SajuChart).pillars.length === 4
    && typeof (value as SajuChart).dayMaster?.character === "string" && typeof (value as SajuChart).dayMaster?.element === "string";
}

export async function saveDailyFortuneProfile(userId: string, input: Pick<SajuInput, "date" | "time" | "calendar">): Promise<SajuChart> {
  const chart = calculate({ ...input, topic: "general" });
  const { error } = await dailyFortuneAdmin().from("user_saju_profiles").upsert({
    user_id: userId,
    chart,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new DailyFortuneServerError("기본 사주 정보를 저장하지 못했어요.");
  return chart;
}

async function loadDailyFortuneProfile(admin: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data: profile, error: profileError } = await admin.from("user_saju_profiles")
    .select("user_id,chart,updated_at").eq("user_id", userId).maybeSingle<ProfileRow>();
  if (profileError) throw new DailyFortuneServerError("기본 사주 정보를 불러오지 못했어요.");
  if (profile) return profile;

  // 오늘 운세 기능 전부터 저장한 해석은 이미 원본 생년월일·시간 없이 계산된 차트만 보관한다.
  // 그 차트를 기준표로 한 번 옮겨, 기존 로그인 사용자도 새 운세를 바로 받을 수 있게 한다.
  const { data: savedResult, error: savedResultError } = await admin.from("saju_results")
    .select("chart,created_at").eq("user_id", userId).maybeSingle<SavedResultRow>();
  if (savedResultError) throw new DailyFortuneServerError("계정의 저장된 사주 정보를 불러오지 못했어요.");
  if (!savedResult) return null;
  if (!isChart(savedResult.chart)) throw new DailyFortuneServerError("계정의 저장된 사주 정보를 확인하지 못했어요.");

  const migratedProfile: ProfileRow = {
    user_id: userId,
    chart: savedResult.chart,
    updated_at: savedResult.created_at,
  };
  const { error: saveError } = await admin.from("user_saju_profiles").upsert(migratedProfile, { onConflict: "user_id" });
  if (saveError) throw new DailyFortuneServerError("기본 사주 정보를 준비하지 못했어요.");
  return migratedProfile;
}

export async function ensureDailyFortune(userId: string, date = koreaDate()): Promise<DailyFortune | null> {
  const admin = dailyFortuneAdmin();
  const profile = await loadDailyFortuneProfile(admin, userId);
  if (!profile) return null;
  if (!isChart(profile.chart)) throw new DailyFortuneServerError("기본 사주 정보를 확인하지 못했어요.");

  const { data: saved, error: savedError } = await admin.from("daily_fortunes")
    .select("content,source_profile_updated_at").eq("user_id", userId).eq("fortune_date", date).maybeSingle<FortuneRow>();
  if (savedError) throw new DailyFortuneServerError("오늘의 운세를 불러오지 못했어요.");
  if (saved && saved.source_profile_updated_at === profile.updated_at && isDailyFortune(saved.content) && saved.content.date === date) {
    return saved.content;
  }

  const fortune = createDailyFortune(profile.chart, date);
  const { error: writeError } = await admin.from("daily_fortunes").upsert({
    user_id: userId,
    fortune_date: date,
    content: fortune,
    source_profile_updated_at: profile.updated_at,
    created_at: new Date().toISOString(),
  }, { onConflict: "user_id,fortune_date" });
  if (writeError) throw new DailyFortuneServerError("오늘의 운세를 저장하지 못했어요.");
  return fortune;
}

export async function prepareDailyFortunes(date = koreaDate()): Promise<{ prepared: number; skipped: number; failed: number }> {
  const admin = dailyFortuneAdmin();
  const { data, error } = await admin.from("user_saju_profiles").select("user_id,updated_at").limit(500);
  if (error) throw new DailyFortuneServerError("오늘의 운세 대상 목록을 불러오지 못했어요.");
  let prepared = 0;
  let skipped = 0;
  let failed = 0;
  for (const profile of data || []) {
    try {
      const before = await admin.from("daily_fortunes").select("content,source_profile_updated_at")
        .eq("user_id", profile.user_id).eq("fortune_date", date).maybeSingle<FortuneRow>();
      if (before.error) throw new DailyFortuneServerError("기존 오늘의 운세를 확인하지 못했어요.");
      const existing = before.data;
      if (existing && existing.source_profile_updated_at === profile.updated_at && isDailyFortune(existing.content)) skipped++;
      else if (await ensureDailyFortune(profile.user_id, date)) prepared++;
    } catch {
      failed++;
    }
  }
  return { prepared, skipped, failed };
}
