import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SajuForm from "../app/saju-form";
import { POST } from "../app/api/interpret/route";
import { koreaDate, koreaWeekRange } from "../lib/saju/interpretation";

const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
const input = {
  date: "2005-12-23",
  time: "08:37",
  calendar: "solar",
  topic: "relationship",
  context: { situation: "deciding", direction: "criteria" },
};

function request(authorization?: string, body: unknown = input): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authorization !== undefined) headers.set("Authorization", authorization);
  return new Request("http://localhost:3000/api/interpret", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function validModelResponse(): Response {
  const date = koreaDate();
  const range = koreaWeekRange(date);
  const details = {
    basis: "신금 일간과 무자(토·수) 월주를 참고했어요. 음 4·양 4이며 겨울(자월)에 해당해요.",
    meaning: "쇠와 흙·물의 상징을 함께 연결해 읽어볼 수 있어요.",
    scene: "말을 건네기 전에 생각을 짧게 적는 장면을 떠올릴 수 있어요.",
    balance: "음양 개수만으로 성격이나 능력을 확정할 수는 없어요.",
    action: "오늘 전하고 싶은 말을 한 문장으로 적어보세요.",
  };
  const today = { date, headline: "오늘", body: "오늘 할 일을 하나 정리해 보세요.", action: "기준 한 가지를 적어 보세요." };
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${range.startDate}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index);
    const dayDate = day.toISOString().slice(0, 10);
    return { date: dayDate, body: dayDate === date ? today.body : `${index + 1}번째 날에는 생각을 정리해 보세요.` };
  });
  const reading = {
    personality: { headline: "성향", body: "신금의 상징을 가볍게 살펴봐요.", ...details },
    topic: { kind: "relationship", headline: "관계", body: "무자 월주의 상징을 관계와 연결해 봐요.", ...details },
    today,
    weekly: { ...range, headline: "이번 주", body: "이번 주에는 대화를 돌아봐요.", action: "안부를 한 번 건네 보세요.", days },
  };
  return Response.json({
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(reading) }] }],
  });
}

async function withServerEnvironment(
  mock: typeof fetch,
  run: () => Promise<void>,
  options: { configured?: boolean } = {},
): Promise<void> {
  const oldFetch = globalThis.fetch;
  const oldGemini = process.env.GEMINI_API_KEY;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  globalThis.fetch = mock;
  process.env.GEMINI_API_KEY = "gemini-test-secret";
  if (options.configured === false) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
  }
  try {
    await run();
  } finally {
    globalThis.fetch = oldFetch;
    if (oldGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldGemini;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
}

test("토큰이 없거나 Bearer 형식이 아니면 입력 계산보다 먼저 401이며 외부 서비스를 호출하지 않는다", async () => {
  for (const authorization of [undefined, "Basic wrong", "Bearer "]) {
    let calls = 0;
    await withServerEnvironment(async () => {
      calls++;
      throw new Error("외부 호출 금지");
    }, async () => {
      const response = await POST(request(authorization, { ...input, date: "잘못된 날짜" }));
      assert.equal(response.status, 401);
      assert.match((await response.json()).error, /로그인/);
      assert.equal(calls, 0);
    });
  }
});

test("Supabase가 거절한 토큰은 401이며 Gemini를 호출하지 않는다", async () => {
  let authCalls = 0;
  let geminiCalls = 0;
  await withServerEnvironment(async (url, init) => {
    if (String(url).includes("/auth/v1/user")) {
      authCalls++;
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer expired-token");
      return Response.json({ message: "invalid token" }, { status: 401 });
    }
    geminiCalls++;
    throw new Error("Gemini 호출 금지");
  }, async () => {
    const response = await POST(request("Bearer expired-token"));
    assert.equal(response.status, 401);
    assert.match((await response.json()).error, /로그인/);
    assert.equal(authCalls, 1);
    assert.equal(geminiCalls, 0);
  });
});

test("Supabase가 확인한 사용자만 기존 Gemini 해석 흐름으로 진행한다", async () => {
  let authCalls = 0;
  let geminiCalls = 0;
  await withServerEnvironment(async (url, init) => {
    const target = String(url);
    const headers = new Headers(init?.headers);
    if (target === "https://test-project.supabase.co/auth/v1/user") {
      authCalls++;
      assert.equal(headers.get("apikey"), "publishable-test-key");
      assert.equal(headers.get("Authorization"), "Bearer valid-token");
      return Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "person@example.com" });
    }
    geminiCalls++;
    assert.match(target, /generativelanguage\.googleapis\.com/);
    assert.doesNotMatch(String(init?.body), /valid-token|person@example\.com|aaaaaaaa-aaaa/);
    return validModelResponse();
  }, async () => {
    const response = await POST(request("Bearer valid-token"));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.reading.topic.kind, "relationship");
    assert.equal(authCalls, 1);
    assert.equal(geminiCalls, 1);
  });
});

test("Supabase 설정 누락이나 인증 서비스 장애는 503이며 Gemini를 호출하지 않는다", async () => {
  let calls = 0;
  await withServerEnvironment(async () => {
    calls++;
    throw new Error("외부 호출 금지");
  }, async () => {
    const response = await POST(request("Bearer valid-token"));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /로그인|설정/);
    assert.equal(calls, 0);
  }, { configured: false });

  let authCalls = 0;
  let geminiCalls = 0;
  await withServerEnvironment(async (url) => {
    if (String(url).includes("/auth/v1/user")) {
      authCalls++;
      throw new Error("auth service unavailable");
    }
    geminiCalls++;
    throw new Error("Gemini 호출 금지");
  }, async () => {
    const response = await POST(request("Bearer valid-token"));
    assert.equal(response.status, 503);
    assert.equal(authCalls, 1);
    assert.equal(geminiCalls, 0);
  });
});

test("로그아웃 초기 화면은 로그인 이유를 알리고 해석 제출을 비활성화한다", () => {
  const html = renderToStaticMarkup(createElement(SajuForm));
  const submit = html.match(/<button\b(?=[^>]*type="submit")[^>]*>/)?.[0];
  assert.match(html, /사주 해석을 시작하려면 로그인해 주세요/);
  assert.match(source, /Google 로그인 후 해석할 수 있어요/);
  assert.match(html, /Google로 로그인/);
  assert.ok(submit, "해석 제출 버튼이 있어야 합니다");
  assert.match(submit, /\bdisabled(?:=""|\s|>)/);
});

test("게스트 최근 해석은 삭제하지 않되 더 이상 복원·저장·갱신하지 않는다", () => {
  assert.doesNotMatch(source, /loadLatestResult\(window\.localStorage\)/);
  assert.doesNotMatch(source, /saveLatestResult\(window\.localStorage/);
  assert.doesNotMatch(source, /clearLatestResult\(window\.localStorage\)/);
  assert.doesNotMatch(source, /removeItem\(["']saju\.latest-interpretation\.v1/);
});

test("브라우저는 현재 세션 토큰을 API에 보내고 로그아웃 시 화면 결과를 숨긴다", () => {
  const requestReading = source.match(/async function requestReading\(input: ReadingRequest\) \{([\s\S]*?)\n  \}\n\n  function handleSubmit/)?.[1];
  const signOut = source.match(/async function signOut\(\) \{([\s\S]*?)\n  \}\n\n  async function requestReading/)?.[1];
  assert.ok(requestReading, "해석 요청 함수가 있어야 합니다");
  assert.match(requestReading, /auth\.getSession\(\)/);
  assert.match(requestReading, /Authorization["']?\s*:\s*`Bearer \$\{/);
  assert.doesNotMatch(requestReading, /saveLatestResult|localStorage/);
  assert.ok(signOut, "로그아웃 함수가 있어야 합니다");
  assert.match(signOut, /setUser\(null\)/);
  assert.match(signOut, /setResult\(null\)/);
  assert.match(source, /disabled=\{[^}]*!user[^}]*\}/);
});

test("result 상태가 남아 있어도 결과 전체의 최상위 렌더는 로그인 사용자에게만 열린다", () => {
  const feedbackStart = source.indexOf('<div className="feedback"');
  const guardedResult = source.indexOf("{user && result && (<>", feedbackStart);
  const preview = source.indexOf('<section className="preview"', feedbackStart);
  assert.ok(feedbackStart >= 0, "결과 전체를 감싸는 feedback 영역이 있어야 합니다");
  assert.ok(guardedResult > feedbackStart, "결과 묶음은 user && result 조건으로 시작해야 합니다");
  assert.ok(preview > guardedResult, "preview는 로그인 조건 안에서 렌더되어야 합니다");
  assert.equal(source.slice(feedbackStart, preview).includes("{result && (<>"), false);
});

test("SIGNED_OUT 이벤트는 비동기 계정 재확인 전에 사용자·결과·재시도를 즉시 비운다", () => {
  const authChange = source.match(/client\.auth\.onAuthStateChange\(\(event\) => \{([\s\S]*?)\n    \}\);/)?.[1];
  assert.ok(authChange, "인증 상태 변경 처리기가 있어야 합니다");
  const signedOut = authChange.match(/if \(event === "SIGNED_OUT"\) \{([\s\S]*?)\n      \}/)?.[1];
  assert.ok(signedOut, "SIGNED_OUT 전용 즉시 처리 분기가 있어야 합니다");
  assert.match(signedOut, /setUser\(null\)/);
  assert.match(signedOut, /setResult\(null\)/);
  assert.match(signedOut, /setRetryInput\(null\)/);
  assert.ok(
    authChange.indexOf('if (event === "SIGNED_OUT")') < authChange.indexOf("setTimeout("),
    "SIGNED_OUT 상태 초기화는 비동기 refresh 예약보다 먼저 실행되어야 합니다",
  );
});
