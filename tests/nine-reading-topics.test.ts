import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import SajuForm from "../app/saju-form";
import { POST } from "../app/api/interpret/route";
import { loadAccountResult, saveAccountResult } from "../lib/saju/account-storage";
import { calculate, validateInput, InputError, type SajuInput } from "../lib/saju/chart";
import { koreaDate, koreaWeekRange, parseInterpretationResponse } from "../lib/saju/interpretation";
import { loadLatestResult, saveLatestResult, type SavedInterpretation } from "../lib/saju/interpretation-storage";
import { readingTopics } from "../lib/saju/topics";

const expectedTopics = [
  ["relationship", "연애", "마음 표현과 대화"],
  ["career", "일", "협업과 일하는 방식"],
  ["money", "재물", "소비와 계획 습관"],
  ["friends", "인간관계", "사람들과의 거리·대화"],
  ["family", "가족", "가족과의 소통"],
  ["study", "공부", "배우고 정리하는 방식"],
  ["path", "진로", "관심 분야 탐색"],
  ["hobby", "취미", "즐거움과 꾸준함"],
  ["health", "건강", "휴식과 생활 리듬"],
] as const;

const baseInput = {
  date: "2005-12-23",
  time: "08:37",
  calendar: "solar",
} as const;

function reading(topic: string) {
  return {
    personality: { headline: "성향", body: "신금은 쇠를 닮은 글자예요." },
    topic: { kind: topic, headline: "관심 주제", body: "무자는 태어난 달의 두 글자예요." },
    today: { date: koreaDate(), headline: "오늘", body: "작은 행동을 해보세요." },
  };
}

function modelResponse(topic: string): Response {
  const details = {
    basis: "신금 일간과 무자(토·수) 월주를 참고했어요. 음 4·양 4이며 겨울(자월)에 해당해요.",
    meaning: "계산된 두 단서의 상징을 함께 연결해 읽어볼 수 있어요.",
    scene: "선택한 주제에서 생각을 짧게 정리하는 장면을 떠올릴 수 있어요.",
    balance: "이 단서만으로 실제 성격이나 행동을 확정할 수는 없어요.",
    action: "오늘 할 수 있는 작은 행동 하나를 정해보세요.",
  };
  const weekly = {
    ...koreaWeekRange(koreaDate()),
    headline: "이번 주",
    body: "이번 주에는 작은 행동 하나를 정해 보세요.",
    action: "이번 주에 안부를 건네 보세요.",
    days: Array.from({ length: 7 }, (_, index) => {
      const day = new Date(`${koreaWeekRange(koreaDate()).startDate}T00:00:00Z`);
      day.setUTCDate(day.getUTCDate() + index);
      const date = day.toISOString().slice(0, 10);
      return { date, body: date === koreaDate() ? reading(topic).today.body : `${index + 1}번째 날에는 생각을 정리해 보세요.` };
    }),
  };
  return Response.json({
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify({
      ...reading(topic),
      today: { ...reading(topic).today, action: "오늘 작은 행동 하나를 해보세요." },
      personality: { ...reading(topic).personality, ...details },
      topic: { ...reading(topic).topic, ...details },
      weekly,
    }) }] }],
  });
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function apiRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer topics-test-token" },
    body: JSON.stringify(body),
  });
}

async function withAuthenticatedFetch(mock: typeof fetch, run: () => Promise<void>): Promise<void> {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.GEMINI_API_KEY = "unit-test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://topics-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "topics-test-publishable-key";
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

test("확정한 9개 관심 주제가 화면에서 각각 한 번씩 선택 가능하다", () => {
  assert.equal(readingTopics.length, 9);
  assert.deepEqual(readingTopics.map(({ value, label, detail }) => [value, label, detail]), expectedTopics);
  const html = renderToStaticMarkup(createElement(SajuForm));
  const radios = [...html.matchAll(/<input\b[^>]*type="radio"[^>]*>/g)].map(([tag]) => tag);
  assert.equal(radios.length, 9);
  assert.deepEqual(radios.map((tag) => tag.match(/\bvalue="([^"]+)"/)?.[1]), expectedTopics.map(([value]) => value));
  for (const tag of radios) {
    assert.match(tag, /\bname="topic"/);
    assert.match(tag, /\brequired(?:=""|\s|>)/);
  }
  for (const [, label, detail] of expectedTopics) {
    assert.ok(html.includes(`<strong>${label}</strong>`));
    assert.ok(html.includes(`<small>${detail}</small>`));
  }
});

test("9개 주제는 입력·해석·최근 결과 저장/복원에서 같은 값으로 허용되고 옛 3개도 유지된다", () => {
  for (const [topic] of expectedTopics) {
    const input = { ...baseInput, topic } satisfies SajuInput;
    assert.equal(validateInput(input).topic, topic);
    const parsed = parseInterpretationResponse(reading(topic), topic, koreaDate());
    const result: SavedInterpretation = {
      version: 1,
      createdAt: "2026-09-23T01:02:03.000Z",
      chart: calculate(input),
      topic,
      reading: parsed,
    };
    const storage = new MemoryStorage();
    saveLatestResult(storage, result);
    assert.deepEqual(loadLatestResult(storage), result, `${topic} 저장/복원`);
    assert.equal(storage.length, 1);
  }
  for (const topic of ["relationship", "career", "money"]) {
    assert.ok(expectedTopics.some(([value]) => value === topic), `${topic} 구형 저장 값 유지`);
  }
  assert.throws(() => validateInput({ ...baseInput, topic: "unsupported" } as unknown as SajuInput), InputError);
});

test("옛 '나 자신' 저장 결과는 복원하지만 새 선택지와 새 해석 요청에서는 제외한다", async () => {
  const storage = new MemoryStorage();
  const legacy: SavedInterpretation = {
    version: 1,
    createdAt: "2026-09-23T01:02:03.000Z",
    chart: calculate({ ...baseInput, topic: "self" }),
    topic: "self",
    reading: parseInterpretationResponse(reading("self"), "self", koreaDate()),
  };
  saveLatestResult(storage, legacy);
  assert.deepEqual(loadLatestResult(storage), legacy);
  const labels: string[] = readingTopics.map((topic) => topic.label);
  assert.ok(!labels.includes("나 자신"));

  await withAuthenticatedFetch(async () => { throw new Error("Gemini 호출 금지"); }, async () => {
    const response = await POST(apiRequest({ ...baseInput, topic: "self" }));
    assert.equal(response.status, 400);
  });
});

test("9개 주제 모두 계정 저장 값으로 받아들이고 다시 읽을 수 있다", async () => {
  const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  for (const [topic] of expectedTopics) {
    const result: SavedInterpretation = {
      version: 1,
      createdAt: "2026-09-23T01:02:03.000Z",
      chart: calculate({ ...baseInput, topic }),
      topic,
      reading: parseInterpretationResponse(reading(topic), topic, koreaDate()),
    };
    let row: Record<string, unknown> | undefined;
    const query = {
      select() { return this; },
      eq() { return this; },
      maybeSingle() { return Promise.resolve({ data: row, error: null }); },
      upsert(value: Record<string, unknown>) { row = value; return Promise.resolve({ error: null }); },
    };
    const client = { from() { return query; } } as unknown as SupabaseClient;
    await saveAccountResult(client, userId, result);
    assert.equal(row?.topic, topic);
    assert.deepEqual(await loadAccountResult(client, userId), result);
  }
});

test("9개 주제별 Gemini 요청은 정확한 주제 초점과 공통 안전 규칙을 사용한다", async () => {
  for (const [topic, label] of expectedTopics) {
      let calls = 0;
      await withAuthenticatedFetch(async (_url, init) => {
        calls++;
        const outbound = JSON.parse(String(init?.body));
        const input = JSON.parse(outbound.input);
        assert.equal(input.topic, topic);
        assert.deepEqual(outbound.response_format.schema.properties.topic.properties.kind.enum, expectedTopics.map(([value]) => value));
        assert.match(outbound.system_instruction, new RegExp(`이번 관심 주제는 '${label}'`));
        assert.match(outbound.system_instruction, /중학생/);
        assert.match(outbound.system_instruction, /personality\.basis.*신금/);
        assert.match(outbound.system_instruction, /topic\.basis.*무자/);
        assert.match(outbound.system_instruction, /음 4·양 4.*겨울\(자월\)/);
        assert.match(outbound.system_instruction, /음양 개수만으로.*판단하지 마세요/);
        assert.deepEqual(input.chart.traditionalContext, {
          yinYang: { yin: 4, yang: 4 },
          season: { name: "겨울", monthBranch: "子", monthLabel: "자월" },
        });
        assert.match(outbound.system_instruction, /미래의 정확한 날짜나 합격·수익을 예언하지 마세요/);
        if (topic === "health") assert.match(outbound.system_instruction, /질병이나 건강 상태를 예측·진단하지 말고/);
        assert.doesNotMatch(JSON.stringify(outbound), /2005-12-23|08:37|unit-test-secret/);
        return modelResponse(topic);
      }, async () => {
        const response = await POST(apiRequest({ ...baseInput, topic }));
        assert.equal(response.status, 200, `${topic} 성공`);
        assert.equal((await response.json()).reading.topic.kind, topic);
        assert.equal(calls, 1);
      });
  }
});

test("선택한 주제와 다른 모델 응답은 9개 주제 모두에서 저장 가능한 결과로 반환하지 않는다", async () => {
  for (let index = 0; index < expectedTopics.length; index++) {
      const topic = expectedTopics[index][0];
      const other = expectedTopics[(index + 1) % expectedTopics.length][0];
      await withAuthenticatedFetch(async () => modelResponse(other), async () => {
        const response = await POST(apiRequest({ ...baseInput, topic }));
        assert.equal(response.status, 502, `${topic}에 ${other} 응답 거절`);
        assert.equal("reading" in await response.json(), false);
      });
  }
});
