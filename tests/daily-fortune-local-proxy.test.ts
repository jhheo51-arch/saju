import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { proxyDailyFortuneRequest } from "../lib/saju/daily-fortune-local-proxy";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("개발 전용 프록시는 production에서 운영 API로 요청을 넘기지 않는다", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const previousEnvironment = environment.NODE_ENV;
  const previousOrigin = process.env.DAILY_FORTUNE_LOCAL_PROXY_ORIGIN;
  try {
    environment.NODE_ENV = "production";
    process.env.DAILY_FORTUNE_LOCAL_PROXY_ORIGIN = "https://saju-two-blush.vercel.app";
    const response = await proxyDailyFortuneRequest(new Request("http://localhost:3000/api/daily-fortune"));
    assert.equal(response, null);
  } finally {
    if (previousEnvironment === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousEnvironment;
    if (previousOrigin === undefined) delete process.env.DAILY_FORTUNE_LOCAL_PROXY_ORIGIN;
    else process.env.DAILY_FORTUNE_LOCAL_PROXY_ORIGIN = previousOrigin;
  }
});

test("개발 프록시는 인증 헤더를 유지해 오늘 운세 GET 요청을 운영 API로 전달한다", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const previousEnvironment = environment.NODE_ENV;
  const previousOrigin = process.env.DAILY_FORTUNE_LOCAL_PROXY_ORIGIN;
  const previousFetch = globalThis.fetch;
  try {
    environment.NODE_ENV = "development";
    process.env.DAILY_FORTUNE_LOCAL_PROXY_ORIGIN = "https://saju-two-blush.vercel.app";
    let requestedUrl = "";
    let requestedAuthorization = "";
    globalThis.fetch = async (input, init) => {
      requestedUrl = String(input);
      requestedAuthorization = new Headers(init?.headers).get("authorization") || "";
      return new Response(JSON.stringify({ fortune: { date: "2026-09-28" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const response = await proxyDailyFortuneRequest(new Request("http://localhost:3000/api/daily-fortune?refresh=1", {
      headers: { authorization: "Bearer local-user-token" },
    }));
    assert.ok(response);
    assert.equal(requestedUrl, "https://saju-two-blush.vercel.app/api/daily-fortune?refresh=1");
    assert.equal(requestedAuthorization, "Bearer local-user-token");
    assert.equal(response.status, 200);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousEnvironment === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousEnvironment;
    if (previousOrigin === undefined) delete process.env.DAILY_FORTUNE_LOCAL_PROXY_ORIGIN;
    else process.env.DAILY_FORTUNE_LOCAL_PROXY_ORIGIN = previousOrigin;
  }
});

test("오늘 운세 GET과 기본 정보 저장 POST 모두 개발 프록시를 먼저 사용한다", () => {
  const dailyRoute = source("../app/api/daily-fortune/route.ts");
  const profileRoute = source("../app/api/daily-profile/route.ts");
  assert.match(dailyRoute, /export async function GET\(request: Request\) \{\s*const proxied = await proxyDailyFortuneRequest\(request\);\s*if \(proxied\) return proxied;/);
  assert.match(profileRoute, /export async function POST\(request: Request\) \{\s*const proxied = await proxyDailyFortuneRequest\(request\);\s*if \(proxied\) return proxied;/);
});
