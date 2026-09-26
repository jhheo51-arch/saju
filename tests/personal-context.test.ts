import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import SajuForm from "../app/saju-form";
import { POST } from "../app/api/interpret/route";
import { loadAccountResult, saveAccountResult } from "../lib/saju/account-storage";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { koreaDate, koreaWeekRange, type Interpretation } from "../lib/saju/interpretation";
import { loadLatestResult, saveLatestResult, type SavedInterpretation } from "../lib/saju/interpretation-storage";
import {
  desiredDirections,
  parsePersonalContext,
  personalContextLabels,
  personalSituations,
  PersonalContextError,
  type PersonalContext,
} from "../lib/saju/personal-context";

const input: SajuInput = {
  date: "2005-12-23",
  time: "08:37",
  calendar: "solar",
  topic: "career",
};
const selectedContext: PersonalContext = { situation: "deciding", direction: "criteria" };

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function validModelResponse(): Response {
  const date = koreaDate();
  const range = koreaWeekRange(date);
  const monday = new Date(`${range.startDate}T00:00:00Z`);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(day.getUTCDate() + index);
    const dayDate = day.toISOString().slice(0, 10);
    return { date: dayDate, body: dayDate === date ? "오늘 할 일을 하나 정리해 보세요." : "하루의 우선순위를 돌아보세요." };
  });
  const details = {
    basis: "신금 일간과 무자(토·수) 월주를 참고했어요. 음 4·양 4이며 겨울(자월)에 해당해요.",
    meaning: "쇠와 흙·물의 상징을 함께 연결해 읽어볼 수 있어요.",
    scene: "일을 고르기 전에 기준을 짧게 적는 장면을 떠올릴 수 있어요.",
    balance: "이 단서만으로 실제 선택이나 성격을 확정할 수는 없어요.",
    action: "중요한 기준 하나를 메모해 보세요.",
  };
  const reading = {
    personality: { headline: "차분히 다듬어 봐요", body: "신금의 상징을 일상에서 가볍게 살펴봐요.", ...details },
    topic: { kind: "career", headline: "선택 기준을 세워 봐요", body: "무자 월주의 상징을 일의 선택과 연결해 봐요.", ...details },
    today: { date, headline: "오늘의 한 걸음", body: "오늘 할 일을 하나 정리해 보세요.", action: "기준 한 가지를 적어 보세요." },
    weekly: { ...range, headline: "이번 주의 한 걸음", body: "이번 주에 기준을 비교해 보세요.", action: "후보 두 개를 표로 비교해 보세요.", days },
  };
  return Response.json({
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(reading) }] }],
  });
}

function request(context?: unknown) {
  return new Request("http://localhost:3000/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer context-test-token" },
    body: JSON.stringify({ ...input, ...(context === undefined ? {} : { context }) }),
  });
}

async function withGeminiMock(
  mock: typeof fetch,
  run: () => Promise<void>,
) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.GEMINI_API_KEY = "personal-context-test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://context-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "context-test-publishable-key";
  globalThis.fetch = async (url, init) => String(url).includes("/auth/v1/user")
    ? Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
    : mock(url, init);
  try {
    await run();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousSupabaseKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousSupabaseKey;
  }
}

test("허용된 현재 상황과 원하는 방향을 정확한 값과 화면 문구로 변환한다", () => {
  const expectedSituations = [
    ["exploring", "방향을 찾는 중이에요"],
    ["deciding", "중요한 선택을 앞두고 있어요"],
    ["changing", "변화를 준비하고 있어요"],
    ["continuing", "꾸준히 이어가는 중이에요"],
    ["resting", "잠시 쉬며 균형을 찾고 있어요"],
  ];
  const expectedDirections = [
    ["strengths", "내 강점을 이해하고 싶어요"],
    ["criteria", "선택 기준을 얻고 싶어요"],
    ["communication", "관계와 대화를 풀고 싶어요"],
    ["action", "바로 할 작은 행동을 찾고 싶어요"],
    ["balance", "무리하지 않는 균형을 찾고 싶어요"],
    ["patterns", "반복되는 내 모습을 알고 싶어요"],
    ["feelings", "지금의 마음을 정리하고 싶어요"],
    ["caution", "조심해서 살펴볼 점을 알고 싶어요"],
    ["outlook", "앞으로의 흐름을 가볍게 보고 싶어요"],
  ];
  assert.deepEqual(personalSituations.map(({ value, label }) => [value, label]), expectedSituations);
  assert.deepEqual(desiredDirections.map(({ value, label }) => [value, label]), expectedDirections);
  assert.equal(desiredDirections.length, 9);

  for (const situation of personalSituations) {
    for (const direction of desiredDirections) {
      const parsed = parsePersonalContext({ situation: situation.value, direction: direction.value }, true)!;
      assert.deepEqual(parsed, { situation: situation.value, direction: direction.value });
      assert.deepEqual(personalContextLabels(parsed), { situation: situation.label, direction: direction.label });
    }
  }
});

test("한쪽 누락, 임의 문자열, 잘못된 형식은 거절하고 선택 없는 이전 입력만 허용한다", () => {
  assert.equal(parsePersonalContext(undefined), undefined);
  assert.equal(parsePersonalContext({}), undefined);
  for (const value of [
    { situation: "deciding" },
    { direction: "criteria" },
    { situation: "직접 입력", direction: "criteria" },
    { situation: "deciding", direction: "마음대로" },
    null,
    [],
  ]) {
    assert.throws(() => parsePersonalContext(value), PersonalContextError);
  }
  assert.throws(() => parsePersonalContext(undefined, true), PersonalContextError);
});

test("API는 검증된 두 선택만 전달하고 사주 근거와 섞지 않도록 지시한다", async () => {
  await withGeminiMock(async (_url, init) => {
    const outbound = JSON.parse(String(init?.body));
    const payload = JSON.parse(outbound.input);
    assert.deepEqual(payload.context, selectedContext);
    assert.deepEqual(payload.chart.traditionalContext, {
      yinYang: { yin: 4, yang: 4 },
      season: { name: "겨울", monthBranch: "子", monthLabel: "자월" },
    });
    assert.doesNotMatch(JSON.stringify(payload), /중요한 선택을 앞두고 있어요|선택 기준을 얻고 싶어요/);
    assert.doesNotMatch(JSON.stringify(outbound), /2005-12-23|08:37|personal-context-test-secret/);
    assert.match(outbound.system_instruction, /현재 상황은 '중요한 선택을 앞두고 있어요'/);
    assert.match(outbound.system_instruction, /원하는 방향은 '선택 기준을 얻고 싶어요'/);
    assert.match(outbound.system_instruction, /topic의 scene, balance, action과 today·weekly의 action/);
    assert.match(outbound.system_instruction, /사주 계산 근거가 아니므로 basis에는 넣지 말고/);
    assert.match(outbound.system_instruction, /선택하지 않은 구체적 사정은 추측하지 마세요/);
    assert.match(outbound.system_instruction, /음 4·양 4.*겨울\(자월\)/);
    assert.match(outbound.system_instruction, /음양 개수만으로.*판단하지 마세요/);
    return validModelResponse();
  }, async () => {
    const response = await POST(request(selectedContext));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.deepEqual(json.reading.context, selectedContext);
  });
});

test("API는 선택 없는 이전 요청을 계속 처리하고 임의 문자열이나 한쪽 선택은 Gemini에 보내지 않는다", async () => {
  await withGeminiMock(async (_url, init) => {
    const outbound = JSON.parse(String(init?.body));
    const payload = JSON.parse(outbound.input);
    assert.equal(payload.context, undefined);
    assert.match(outbound.system_instruction, /이전 요청이라 제공되지 않았습니다/);
    assert.match(outbound.system_instruction, /구체적 사정을 추측하지 말고/);
    return validModelResponse();
  }, async () => {
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reading.context, undefined);
  });

  for (const invalid of [
    { situation: "deciding" },
    { direction: "criteria" },
    { situation: "custom", direction: "criteria" },
    { situation: "deciding", direction: "custom" },
  ]) {
    let calls = 0;
    await withGeminiMock(async () => { calls++; return validModelResponse(); }, async () => {
      const response = await POST(request(invalid));
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /현재 상황과 원하는 방향/);
      assert.equal(calls, 0);
    });
  }
});

test("reading.context는 브라우저와 계정 저장에서 그대로 복원되고 이전 결과도 유지된다", async () => {
  const chart = calculate(input);
  const baseReading: Interpretation = {
    personality: { headline: "성향", body: "신금은 쇠의 상징으로 읽어요." },
    topic: { kind: "career", headline: "일", body: "무자 월주를 일의 장면과 연결해 봐요." },
    today: { date: "2026-09-23", headline: "오늘", body: "한 가지를 정리해 보세요." },
  };
  const contextual: SavedInterpretation = {
    version: 1,
    createdAt: "2026-09-23T08:00:00.000Z",
    chart,
    topic: "career",
    reading: { ...baseReading, context: selectedContext },
  };
  const legacy: SavedInterpretation = { ...contextual, reading: baseReading };

  for (const saved of [contextual, legacy]) {
    const storage = new MemoryStorage();
    saveLatestResult(storage, saved);
    assert.deepEqual(loadLatestResult(storage), saved);

    let row: Record<string, unknown> | undefined;
    const query = {
      select() { return this; },
      eq() { return this; },
      maybeSingle() { return Promise.resolve({ data: row, error: null }); },
      upsert(value: Record<string, unknown>) { row = value; return Promise.resolve({ error: null }); },
    };
    const client = { from() { return query; } } as unknown as SupabaseClient;
    await saveAccountResult(client, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", saved);
    assert.deepEqual(await loadAccountResult(client, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), saved);
  }
});

test("입력 화면에는 필수 선택 두 개가 있고 결과에는 실제 반영 선택 요약이 있다", () => {
  const html = renderToStaticMarkup(createElement(SajuForm));
  for (const name of ["situation", "direction"]) {
    const select = html.match(new RegExp(`<select\\b[^>]*name="${name}"[^>]*>[\\s\\S]*?<\\/select>`))?.[0];
    assert.ok(select, `${name} 선택 항목`);
    assert.match(select, /\brequired(?:=""|\s|>)/);
    assert.match(select, /<option\b(?=[^>]*\bvalue="")(?=[^>]*\bselected="")[^>]*>/);
  }
  for (const item of [...personalSituations, ...desiredDirections]) {
    assert.ok(html.includes(`<option value="${item.value}">${item.label}</option>`));
  }

  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.match(source, /result\?\.reading\?\.context\s*\?\s*personalContextLabels\(result\.reading\.context\)/);
  assert.match(source, /className="context-summary"[^>]*aria-label="이번 풀이에 반영한 선택"/);
  assert.match(source, /<strong>현재<\/strong>\{contextLabels\.situation\}/);
  assert.match(source, /<strong>원하는 방향<\/strong>\{contextLabels\.direction\}/);
});
