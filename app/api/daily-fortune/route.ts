import { NextResponse } from "next/server";
import { authenticatedDailyFortuneUser, DailyFortuneServerError, ensureDailyFortune } from "../../../lib/saju/daily-fortune-server";
import { proxyDailyFortuneRequest } from "../../../lib/saju/daily-fortune-local-proxy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const proxied = await proxyDailyFortuneRequest(request);
  if (proxied) return proxied;
  try {
    const user = await authenticatedDailyFortuneUser(request);
    const fortune = await ensureDailyFortune(user.id);
    if (!fortune) return NextResponse.json({ error: "오늘의 운세를 만들 기본 사주 정보가 없어요." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ fortune }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof DailyFortuneServerError ? error : new DailyFortuneServerError("오늘의 운세를 준비하지 못했어요.");
    return NextResponse.json({ error: known.message }, { status: known.status, headers: { "Cache-Control": "no-store" } });
  }
}
