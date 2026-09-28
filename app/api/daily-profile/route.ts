import { NextResponse } from "next/server";
import { authenticatedDailyFortuneUser, DailyFortuneServerError, ensureDailyFortune, saveDailyFortuneProfile } from "../../../lib/saju/daily-fortune-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { date?: string; time?: string; calendar?: "solar" };
    const { date, time, calendar } = body;
    if (typeof date !== "string" || typeof time !== "string" || calendar !== "solar") {
      return NextResponse.json({ error: "생년월일과 태어난 시간을 다시 확인해 주세요." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const user = await authenticatedDailyFortuneUser(request);
    await saveDailyFortuneProfile(user.id, { date, time, calendar });
    const fortune = await ensureDailyFortune(user.id);
    return NextResponse.json({ fortune }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof DailyFortuneServerError ? error : new DailyFortuneServerError("기본 사주 정보를 저장하지 못했어요.", 400);
    return NextResponse.json({ error: known.message }, { status: known.status, headers: { "Cache-Control": "no-store" } });
  }
}
