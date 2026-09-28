import { NextResponse } from "next/server";

function localProxyOrigin(): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  const value = process.env.DAILY_FORTUNE_LOCAL_PROXY_ORIGIN;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Vercel은 Production 비밀값을 로컬로 다시 내려주지 않는다.
 * 개발할 때만 명시적으로 설정한 운영 API로 인증 요청을 중계해,
 * 로컬 브라우저가 실제 서비스와 같은 로그인·해석·오늘 운세를 확인하게 한다.
 */
export async function proxyLocalProductionRequest(request: Request): Promise<NextResponse | null> {
  const origin = localProxyOrigin();
  if (!origin) return null;

  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, origin);
  const headers = new Headers();
  for (const name of ["authorization", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });
  return new NextResponse(response.body, {
    status: response.status,
    headers: { "Cache-Control": "no-store", "Content-Type": response.headers.get("content-type") || "application/json" },
  });
}

// 기존 오늘 운세 경로의 이름을 유지해 호출부와 테스트의 호환성을 보장합니다.
export const proxyDailyFortuneRequest = proxyLocalProductionRequest;
