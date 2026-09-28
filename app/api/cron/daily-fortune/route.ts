import { NextResponse } from "next/server";
import { DailyFortuneServerError, prepareDailyFortunes } from "../../../../lib/saju/daily-fortune-server";
import { koreaDate } from "../../../../lib/saju/interpretation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const date = koreaDate();
    const summary = await prepareDailyFortunes(date);
    console.info(JSON.stringify({ event: "daily_fortunes_prepared", date, ...summary }));
    return NextResponse.json({ ok: true, date, ...summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof DailyFortuneServerError ? error : new DailyFortuneServerError("오늘의 운세 예약 작업을 완료하지 못했어요.");
    return NextResponse.json({ ok: false, error: known.message }, { status: known.status, headers: { "Cache-Control": "no-store" } });
  }
}
