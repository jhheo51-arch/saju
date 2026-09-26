import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { POST } from "../app/api/question/route";
import { calculate } from "../lib/saju/chart";
import { parseSavedInterpretation, type SavedInterpretation } from "../lib/saju/interpretation-storage";

const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
const token = "question-route-secret-token";
const validBasis = "신금 · 무자(토·수) · 음 4·양 4 · 겨울(자월)";

function threeParagraphAnswer(length: number): string {
  const contentLength = length - 4;
  const first = Math.floor(contentLength / 3);
  const second = Math.floor((contentLength - first) / 2);
  return `${"가".repeat(first)}\n\n${"나".repeat(second)}\n\n${"다".repeat(contentLength - first - second)}`;
}

const validAnswer = threeParagraphAnswer(260);
const saved: SavedInterpretation = {
  version: 1,
  createdAt: "2026-09-23T08:00:00.000Z",
  chart: calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "career", question: "" }),
  topic: "career",
  reading: {
    context: { situation: "deciding", direction: "criteria" },
    personality: { headline: "차분한 성향", body: "신금의 상징처럼 기준을 세워 살펴봐요." },
    topic: { kind: "career", headline: "일 이야기", body: "무자 월주의 상징을 일과 연결해 봐요." },
    today: { date: "2026-09-23", headline: "오늘", body: "할 일을 하나 정리해 보세요." },
  },
};

function request(question: unknown, result: unknown = saved, authorization?: string): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authorization !== undefined) headers.set("Authorization", authorization);
  return new Request("http://localhost:3000/api/question", {
    method: "POST",
    headers,
    body: JSON.stringify({ question, result }),
  });
}

function modelResponse(answer: string, action: string, basis = validBasis): Response {
  return Response.json({
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify({ basis, answer, action }) }] }],
  });
}

async function withServerEnvironment(mockGemini: typeof fetch, run: () => Promise<void>): Promise<void> {
  const oldFetch = globalThis.fetch;
  const oldGemini = process.env.GEMINI_API_KEY;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.GEMINI_API_KEY = "gemini-question-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://question-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "question-test-publishable";
  globalThis.fetch = async (url, init) => String(url).includes("/auth/v1/user")
    ? Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
    : mockGemini(url, init);
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

test("로그인하지 않은 질문은 외부 호출 전에 401로 거절한다", async () => {
  let calls = 0;
  await withServerEnvironment(async () => {
    calls++;
    throw new Error("외부 호출 금지");
  }, async () => {
    const response = await POST(request("무엇을 준비할까요?"));
    assert.equal(response.status, 401);
    assert.match((await response.json()).error, /로그인/);
    assert.equal(calls, 0);
  });
});

test("빈 질문과 200자 초과 질문은 Gemini 호출 전에 거절한다", async () => {
  let calls = 0;
  await withServerEnvironment(async () => {
    calls++;
    throw new Error("Gemini 호출 금지");
  }, async () => {
    for (const question of ["   \n ", "가".repeat(201)]) {
      const response = await POST(request(question, saved, `Bearer ${token}`));
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /입력|200자/);
    }
    assert.equal(calls, 0);
  });
});

test("검증된 저장 결과만 사용하고 Gemini에는 생년월일과 토큰을 보내지 않는다", async () => {
  let geminiCalls = 0;
  const tainted = {
    ...saved,
    rawBirthDate: "2005-12-23",
    access_token: token,
    chart: { ...saved.chart, rawBirthTime: "08:37", access_token: token },
    reading: { ...saved.reading, privateToken: token },
  };
  await withServerEnvironment(async (_url, init) => {
    geminiCalls++;
    const outboundText = String(init?.body);
    assert.doesNotMatch(outboundText, /2005-12-23|08:37|question-route-secret-token|gemini-question-secret/);
    const outbound = JSON.parse(outboundText);
    assert.deepEqual(outbound.response_format.schema.required, ["basis", "answer", "action"]);
    assert.equal(outbound.response_format.schema.properties.basis.maxLength, 320);
    assert.equal(outbound.response_format.schema.properties.answer.maxLength, 800);
    assert.equal(outbound.response_format.schema.properties.action.maxLength, 240);
    assert.equal(outbound.generation_config.max_output_tokens, 1400);
    assert.match(outbound.system_instruction, /따뜻하고 통찰력 있는 한국어 상담가/);
    assert.match(outbound.system_instruction, /오래 대화한 상담자처럼 핵심을 구체적으로/);
    assert.match(outbound.system_instruction, new RegExp(`basis는 설명을 덧붙이지 말고 정확히 '${validBasis.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'만 출력`));
    assert.match(outbound.system_instruction, /빈 줄로 나눈 정확히 3개의 짧은 문단/);
    assert.match(outbound.system_instruction, /전체 6~9개의 완결된 문장/);
    assert.match(outbound.system_instruction, /첫 문단은 질문에 대한 분명한 결론과 가장 중요한 이유/);
    assert.match(outbound.system_instruction, /둘째 문단은 서로 다른 사주 단서가 부딪히거나 보완되는 방식과 실제 생활 장면/);
    assert.match(outbound.system_instruction, /셋째 문단은 도움이 되는 선택 기준과 조심할 반대 모습/);
    assert.match(outbound.system_instruction, /260~800자/);
    assert.match(outbound.system_instruction, /부족한 부분을 채워주는 사람/);
    assert.match(outbound.system_instruction, /대화 속도.*감정 표현.*갈등 뒤 회복.*경계 존중.*결정 방식/);
    assert.match(outbound.system_instruction, /최소 3가지/);
    assert.match(outbound.system_instruction, /'잘 맞는 모습'.*'주의할 모습'.*대비/);
    assert.match(outbound.system_instruction, /현재 상황은 '중요한 선택을 앞두고 있어요'/);
    assert.match(outbound.system_instruction, /원하는 방향은 '선택 기준을 얻고 싶어요'/);
    assert.match(outbound.system_instruction, /answer와 action의 초점을 이 선택에 맞추세요/);
    const context = JSON.parse(outbound.input);
    assert.equal(context.topic, "일");
    assert.equal(context.previousReading.personality, saved.reading.personality.body);
    assert.equal(context.previousReading.topic, saved.reading.topic.body);
    assert.equal(context.chart.pillars.length, 4);
    assert.deepEqual(Object.keys(context.chart.pillars[0]).sort(), ["branchElement", "korean", "label", "stemElement"]);
    return modelResponse(validAnswer, "오늘 원하는 조건 세 가지를 적어보세요.");
  }, async () => {
    const response = await POST(request("새로운 일을 시작해도 될까요?", tainted, `Bearer ${token}`));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).questionAnswer, {
      basis: validBasis,
      answer: validAnswer,
      action: "오늘 원하는 조건 세 가지를 적어보세요.",
    });
    assert.equal(geminiCalls, 1);
  });

  await withServerEnvironment(async () => {
    geminiCalls++;
    throw new Error("Gemini 호출 금지");
  }, async () => {
    const forged = { ...saved, reading: { ...saved.reading, topic: { ...saved.reading.topic, kind: "money" } } };
    const response = await POST(request("무엇을 준비할까요?", forged, `Bearer ${token}`));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /결과/);
  });
  assert.equal(geminiCalls, 1);
});

test("새 비시기 답변은 정확히 3문단인 260~800자만 허용한다", async () => {
  for (const [length, expectedStatus] of [[259, 502], [260, 200], [800, 200], [801, 502]] as const) {
    await withServerEnvironment(async () => modelResponse(threeParagraphAnswer(length), "오늘 조건 세 가지를 적어보세요."), async () => {
      const response = await POST(request("새로운 일을 시작할 때 무엇을 볼까요?", saved, `Bearer ${token}`));
      assert.equal(response.status, expectedStatus, `${length}자 답변`);
      const json = await response.json();
      if (expectedStatus === 200) assert.equal(json.questionAnswer.answer.length, length);
      else assert.equal("questionAnswer" in json, false);
    });
  }
});

test("새 비시기 답변은 길이가 맞아도 2문단이나 4문단이면 거절한다", async () => {
  for (const answer of [
    `${"가".repeat(140)}\n\n${"나".repeat(140)}`,
    `${"가".repeat(70)}\n\n${"나".repeat(70)}\n\n${"다".repeat(70)}\n\n${"라".repeat(70)}`,
  ]) {
    await withServerEnvironment(async () => modelResponse(answer, "오늘 조건 세 가지를 적어보세요."), async () => {
      const response = await POST(request("새로운 일을 시작할 때 무엇을 볼까요?", saved, `Bearer ${token}`));
      assert.equal(response.status, 502);
      assert.equal("questionAnswer" in await response.json(), false);
    });
  }
});

test("기존 저장 답변은 260자보다 짧고 3문단이 아니어도 계속 복원한다", () => {
  const oldAnswer = { answer: "기존의 짧은 답변이에요.", action: "조건 하나를 적어보세요." };
  const restored = parseSavedInterpretation({
    ...saved,
    reading: { ...saved.reading, questionAnswer: oldAnswer },
  });
  assert.ok(restored);
  assert.deepEqual(restored.reading.questionAnswer, oldAnswer);
});

test("basis가 없거나 실제 일간·월주·음양·계절 중 하나라도 다르면 502로 거절한다", async () => {
  const invalidBases = [
    undefined,
    `${validBasis} 추가 설명`,
    `${validBasis}\n추가 설명`,
    "무자(토·수), 음 4·양 4, 겨울(자월)을 참고했어요.",
    "신금, 음 4·양 4, 겨울(자월)을 참고했어요.",
    "신금, 무자(토·수), 음 3·양 5, 겨울(자월)을 참고했어요.",
    "신금, 무자(토·수), 음 4·양 4, 여름(오월)을 참고했어요.",
  ];
  for (const basis of invalidBases) {
    await withServerEnvironment(async () => basis === undefined
      ? Response.json({
        status: "completed",
        steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify({ answer: validAnswer, action: "행동" }) }] }],
      })
      : modelResponse(validAnswer, "행동", basis), async () => {
      const response = await POST(request("무엇을 준비할까요?", saved, `Bearer ${token}`));
      assert.equal(response.status, 502, `잘못된 basis 거절: ${String(basis)}`);
      assert.equal("questionAnswer" in await response.json(), false);
    });
  }
});

test("시기 질문은 모델의 확정 날짜를 버리고 행동의 임의 시기도 거절한다", async () => {
  await withServerEnvironment(async () => modelResponse(
    "2027년 3월에 반드시 취업합니다.",
    "이번 주에 이력서 한 부분을 다듬어 보세요.",
  ), async () => {
    const response = await POST(request("언제 취직할 수 있을까요?", saved, `Bearer ${token}`));
    assert.equal(response.status, 200);
    const answer = (await response.json()).questionAnswer;
    assert.match(answer.answer, /정확히.*취직.*알 수 없/);
    assert.doesNotMatch(answer.answer, /2027|3월|반드시/);
  });

  await withServerEnvironment(async () => modelResponse(
    "준비 상태를 먼저 살펴보는 편이 좋아요.",
    "내년 3월에 지원하세요.",
  ), async () => {
    const response = await POST(request("언제 취직할 수 있을까요?", saved, `Bearer ${token}`));
    assert.equal(response.status, 502);
    assert.equal("questionAnswer" in await response.json(), false);
  });
});

test("화면은 05 질문 영역과 입력·상태·답변·계정 저장 흐름을 갖춘다", () => {
  const section = source.match(/<section className="preview question-preview"[\s\S]*?<\/section>}/)?.[0];
  const askQuestion = source.match(/async function askQuestion[\s\S]*?\n  }\n\n  function handleSubmit/)?.[0];
  assert.ok(section, "05 질문 영역이 있어야 합니다");
  assert.match(section, /section-step">05</);
  assert.match(section, /궁금한 점 답변/);
  assert.match(section, /<textarea[\s\S]*?maxLength=\{200}/);
  const textarea = section.match(/<textarea[\s\S]*?\/>/)?.[0] ?? "";
  assert.match(textarea, /aria-describedby="saju-question-count"/);
  assert.doesNotMatch(textarea, /saju-question-help/);
  assert.doesNotMatch(section, /질문은 답변을 만들기 위해 Gemini에 전달/);
  assert.doesNotMatch(section, /id="saju-question-help"/);
  assert.match(section, /questionLoading.*답변을 만들고 있어요/);
  assert.match(section, /questionError.*role="alert"/);
  assert.match(section, /questionAnswer\.basis/);
  assert.match(section, /이 답을 읽은 단서/);
  assert.match(section, /className="question-answer-basis-text"/);
  assert.match(section, /questionAnswer\.answer/);
  assert.match(section, /questionAnswer\.action/);
  assert.ok(askQuestion, "질문 전송 함수가 있어야 합니다");
  assert.match(askQuestion, /fetch\("\/api\/question"/);
  assert.match(askQuestion, /saveAccountResult\(client, user\.id/);
  assert.match(askQuestion, /setResult\(nextResult\)/);
  assert.match(askQuestion, /답변은 만들었지만 계정에 저장하지 못했어요/);
});
