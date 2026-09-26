import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/interpret/route";
import { koreaDate, koreaWeekRange } from "../lib/saju/interpretation";

const input = {
  date: "2005-12-23",
  time: "08:37",
  calendar: "solar",
  topic: "relationship",
};

function request(body: unknown): Request {
  return new Request("http://localhost:3000/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer route-test-token" },
    body: JSON.stringify(body),
  });
}

function details(basis: string) {
  return {
    basis,
    meaning: "계산된 두 단서의 상징을 함께 연결해 읽어볼 수 있어요.",
    scene: "대화하기 전에 생각을 짧게 정리하는 생활 장면을 떠올릴 수 있어요.",
    balance: "이 단서만으로 실제 성격이나 행동을 확정할 수는 없어요.",
    action: "오늘 전하고 싶은 말을 한 문장으로 적어보세요.",
  };
}

function modelResponse(reading: unknown, includeWeekly = true, includeDetails = true): Response {
  let enriched = reading;
  if (includeDetails && reading && typeof reading === "object" && !Array.isArray(reading)) {
    const record = reading as Record<string, unknown>;
    enriched = {
      ...record,
      personality: record.personality && typeof record.personality === "object" && !Array.isArray(record.personality)
        ? { ...details("신금 일간과 무자(토·수) 월주를 함께 참고했어요."), ...record.personality }
        : record.personality,
      topic: record.topic && typeof record.topic === "object" && !Array.isArray(record.topic)
        ? { ...details("신금 일간과 무자(토·수) 월주를 참고했어요. 음 4·양 4이며 겨울(자월)에 해당해요."), ...record.topic }
        : record.topic,
      today: record.today && typeof record.today === "object" && !Array.isArray(record.today)
        ? { action: "오늘 작은 행동 하나를 해보세요.", ...record.today }
        : record.today,
    };
  }
  const weekStart = koreaWeekRange(koreaDate()).startDate;
  const todayBody = enriched && typeof enriched === "object" && "today" in enriched &&
    enriched.today && typeof enriched.today === "object" && "body" in enriched.today &&
    typeof enriched.today.body === "string" ? enriched.today.body : "오늘 생각해 볼 점을 살펴보세요.";
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${weekStart}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    return { date, body: date === koreaDate() ? todayBody : `${index + 1}번째 날에는 생각을 정리해 보세요.` };
  });
  const withWeek = includeWeekly && enriched && typeof enriched === "object" && !Array.isArray(enriched)
    ? { weekly: { ...koreaWeekRange(koreaDate()), headline: "이번 주", body: "이번 주에는 대화를 나눠 보세요.", action: "이번 주에 안부를 건네 보세요.", days }, ...enriched }
    : enriched;
  return Response.json({
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(withWeek) }] }],
  });
}

async function withGeminiMock(
  mock: typeof fetch,
  run: () => Promise<void>,
  key: string | null = "unit-test-secret",
): Promise<void> {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.GEMINI_API_KEY;
  const oldSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://route-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "route-test-publishable-key";
  globalThis.fetch = async (url, init) => String(url).includes("/auth/v1/user")
    ? Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
    : mock(url, init);
  if (key === null) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = key;
  try {
    await run();
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldSupabaseUrl;
    if (oldSupabaseKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldSupabaseKey;
  }
}

test("서버가 직접 사주를 계산하고 Gemini에는 원본 날짜·시각을 빼고 보낸다", async () => {
  let calls = 0;
  await withGeminiMock(async (_url, init) => {
    calls++;
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("x-goog-api-key"), "unit-test-secret");
    const outbound = JSON.parse(String(init?.body));
    assert.equal(outbound.model, "gemini-3.5-flash-lite");
    assert.equal(outbound.store, false);
    assert.ok(outbound.response_format.schema.required.includes("weekly"));
    assert.ok(outbound.response_format.schema.properties.today.required.includes("action"));
    assert.ok(outbound.response_format.schema.properties.weekly.required.includes("action"));
    assert.deepEqual(
      outbound.response_format.schema.properties.personality.required,
      ["headline", "body", "basis", "meaning", "scene", "balance", "action"],
    );
    assert.deepEqual(
      outbound.response_format.schema.properties.topic.required,
      ["kind", "headline", "body", "basis", "meaning", "scene", "balance", "action"],
    );
    assert.match(outbound.system_instruction, /weekly.*week\.startDate.*week\.endDate/);
    assert.match(outbound.system_instruction, /목=나무, 화=불, 토=흙·산, 금=쇠, 수=물/);
    assert.match(outbound.system_instruction, /무토는 흙·산이지 나무가 아닙니다/);
    assert.match(outbound.system_instruction, /갑목, 을목, 병화, 정화, 무토, 기토, 경금, 신금, 임수, 계수/);
    assert.match(outbound.system_instruction, /중학생/);
    assert.match(outbound.system_instruction, /일간은 신금, 월주는 무자\(토·수\)/);
    assert.match(outbound.system_instruction, /personality\.basis.*신금.*허용 근거.*을유\(목·금\).*무자\(토·수\).*임진\(수·토\)/);
    assert.match(outbound.system_instruction, /topic\.basis.*신금.*무자\(토·수\)/);
    assert.match(outbound.system_instruction, /추가 계산 근거.*음 4·양 4.*겨울\(자월\)/);
    assert.match(outbound.system_instruction, /실제 출생지 날씨가 아니며.*음양 개수만으로/);
    assert.match(outbound.system_instruction, /실제 계산 근거.*상징을 쉬운 말로.*생활 장면.*작은 행동/);
    assert.match(outbound.system_instruction, /허용 근거 중 하나를 괄호까지 그대로 복사/);
    assert.match(outbound.system_instruction, /월주 무자\(토·수\)의 실제 오행과 일간 신금/);
    assert.match(outbound.system_instruction, /조합을 왜 그런 생활 장면으로 읽었는지/);
    assert.match(outbound.system_instruction, /이번 관심 주제는 '연애'.*마음을 표현하고 상대와 대화/);
    assert.match(outbound.system_instruction, /today.*선택 주제.*실제 사주 단서 하나.*action.*구체적인 행동/);
    assert.equal(outbound.response_format.schema.properties.questionAnswer, undefined);
    assert.doesNotMatch(JSON.stringify(outbound), /2005-12-23|08:37|unit-test-secret/);
    const context = JSON.parse(outbound.input);
    assert.equal(context.topic, "relationship");
    assert.deepEqual(context.week, koreaWeekRange(context.date));
    assert.equal(context.chart.pillars[2].stem, "辛");
    assert.equal(context.chart.pillars[2].branch, "巳");
    assert.deepEqual(context.chart.traditionalContext, {
      yinYang: { yin: 4, yang: 4 },
      season: { name: "겨울", monthBranch: "子", monthLabel: "자월" },
    });
    assert.equal(context.question, undefined);
    return modelResponse({
      personality: { headline: "성향", body: "신금은 쇠를 닮은 글자예요. 대화를 좋아할 수 있어요." },
      topic: { kind: "relationship", headline: "관계", body: "무자는 태어난 달의 두 글자예요. 말을 천천히 건네 보세요." },
      today: { date: koreaDate(), headline: "오늘", body: "편하게 이야기해 보세요." },
    });
  }, async () => {
    const response = await POST(request({ ...input, chart: "forged", email: "private@example.com" }));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.chart.pillars[2].text, "辛巳");
    assert.equal(json.reading.topic.kind, "relationship");
    assert.deepEqual(
      { startDate: json.reading.weekly.startDate, endDate: json.reading.weekly.endDate },
      koreaWeekRange(json.reading.today.date),
    );
    assert.match(json.reading.personality.body, /신금/);
    assert.match(json.reading.topic.body, /무자/);
    assert.equal(json.reading.questionAnswer, undefined);
    assert.doesNotMatch(JSON.stringify(json), /unit-test-secret|private@example.com/);
    assert.equal(calls, 1);
  });
});

test("선택한 주제마다 해당 생활 장면 지침을 보내고 다른 주제로 바꾸지 않게 한다", async () => {
  const cases = [
    { topic: "career", label: "일", focus: /동료와 협업하고 일을 정리/ },
    { topic: "money", label: "재물", focus: /소비를 돌아보고 계획을 세우는 습관/ },
  ] as const;
  for (const item of cases) {
    await withGeminiMock(async (_url, init) => {
      const outbound = JSON.parse(String(init?.body));
      assert.match(outbound.system_instruction, new RegExp(`이번 관심 주제는 '${item.label}'`));
      assert.match(outbound.system_instruction, item.focus);
      assert.match(outbound.system_instruction, /다른 주제로 바꿔 쓰지 마세요/);
      assert.equal(JSON.parse(outbound.input).topic, item.topic);
      assert.doesNotMatch(JSON.stringify(outbound), /2005-12-23|08:37|unit-test-secret/);
      return modelResponse({
        personality: { headline: "성향", body: "신금은 쇠를 닮은 글자예요." },
        topic: { kind: item.topic, headline: "주제", body: "무자는 태어난 달의 두 글자예요." },
        today: { date: koreaDate(), headline: "오늘", body: "작은 행동을 정해 보세요." },
      });
    }, async () => {
      const response = await POST(request({ ...input, topic: item.topic }));
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.equal(json.reading.topic.kind, item.topic);
      assert.equal(json.reading.today.date, koreaDate());
    });
  }
});

test("옛 클라이언트가 질문을 보내도 새 Gemini 요청·응답에는 포함하지 않는다", async () => {
  await withGeminiMock(async (_url, init) => {
    const outbound = JSON.parse(String(init?.body));
    assert.equal(JSON.parse(outbound.input).question, undefined);
    return modelResponse({
      personality: { headline: "성향", body: "신금은 쇠를 닮은 글자예요." },
      topic: { kind: "career", headline: "일", body: "무자는 태어난 달의 두 글자예요." },
      today: { date: koreaDate(), headline: "오늘", body: "작은 행동을 정해 보세요." },
      questionAnswer: { answer: "옛 질문 답변", action: "예전 행동" },
    });
  }, async () => {
    const response = await POST(request({ ...input, topic: "career", question: "언제 취직하나요?" }));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.reading.questionAnswer, undefined);
  });
});

test("잘못된 입력은 Gemini 호출 전에 거절한다", async () => {
  await withGeminiMock(async () => { throw new Error("Gemini 호출 금지"); }, async () => {
    const response = await POST(request({ ...input, date: "2005-02-30" }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /날짜/);
  });
});

test("질문 없이 개인별 근거가 있는 세 영역으로 결과를 받을 수 있다", async () => {
  await withGeminiMock(async () => modelResponse({
    personality: { headline: "성향", body: "신금은 쇠를 닮은 글자예요." },
    topic: { kind: "relationship", headline: "관계", body: "무자는 태어난 달의 두 글자예요." },
    today: { date: koreaDate(), headline: "오늘", body: "가벼운 안부를 물어보세요." },
  }), async () => {
    const response = await POST(request(input));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.reading.questionAnswer, undefined);
  });
});

test("성향에 실제 일간이 빠지면 가짜 결과 없이 재시도 오류를 돌려준다", async () => {
  await withGeminiMock(async () => modelResponse({
    personality: { headline: "성향", body: "사람의 이야기를 들어볼 수 있어요.", ...details("무자(토·수) 월주를 참고했어요.") },
    topic: { kind: "relationship", headline: "관계", body: "무자는 태어난 달의 두 글자예요." },
    today: { date: koreaDate(), headline: "오늘", body: "가벼운 안부를 물어보세요." },
  }), async () => {
    const response = await POST(request(input));
    assert.equal(response.status, 502);
    const json = await response.json();
    assert.equal("reading" in json, false);
  });
});

test("주제 풀이에 실제 월주가 빠지면 가짜 결과 없이 재시도 오류를 돌려준다", async () => {
  await withGeminiMock(async () => modelResponse({
    personality: { headline: "성향", body: "신금은 쇠를 닮은 글자예요." },
    topic: { kind: "career", headline: "일", body: "준비한 내용을 살펴보세요.", ...details("신금 일간을 참고했어요.") },
    today: { date: koreaDate(), headline: "오늘", body: "준비한 내용을 살펴보세요." },
  }), async () => {
    const response = await POST(request({ ...input, topic: "career" }));
    assert.equal(response.status, 502);
    assert.equal("reading" in await response.json(), false);
  });
});

test("다른 기둥이나 월주의 두 오행 중 하나만 적은 근거도 거절한다", async () => {
  const base = {
    personality: { headline: "성향", body: "차분히 정리하는 모습을 떠올릴 수 있어요." },
    topic: { kind: "relationship", headline: "관계", body: "말을 고른 뒤 건네는 모습을 떠올릴 수 있어요." },
    today: { date: koreaDate(), headline: "오늘", body: "가벼운 안부를 물어보세요." },
  };
  for (const reading of [
    {
      ...base,
      personality: { ...base.personality, ...details("신금 일간과 무자(토) 월주를 참고했어요.") },
    },
    {
      ...base,
      topic: { ...base.topic, ...details("신금 일간과 무자(토) 월주를 참고했어요.") },
    },
  ]) {
    await withGeminiMock(async () => modelResponse(reading), async () => {
      const response = await POST(request(input));
      assert.equal(response.status, 502);
      assert.equal("reading" in await response.json(), false);
    });
  }
});

test("음양 개수를 성격의 균형이나 조화로 과장한 Gemini 응답은 거절한다", async () => {
  const topicBasis = "신금 일간과 무자(토·수) 월주를 참고했어요. 음 4·양 4이며 겨울(자월)에 해당해요.";
  await withGeminiMock(async () => modelResponse({
    personality: { headline: "성향", body: "신금의 상징을 살펴봐요." },
    topic: {
      kind: "relationship",
      headline: "관계",
      body: "대화 방식을 살펴봐요.",
      ...details(topicBasis),
      meaning: "음 4·양 4의 조화가 좋아서 관계를 잘 풀어요.",
    },
    today: { date: koreaDate(), headline: "오늘", body: "가벼운 안부를 물어보세요." },
  }), async () => {
    const response = await POST(request(input));
    assert.equal(response.status, 502);
    assert.equal("reading" in await response.json(), false);
  });
});

test("새 Gemini 응답의 다섯 세부 항목 중 하나라도 빠지면 거절한다", async () => {
  const complete = {
    personality: { headline: "성향", body: "차분히 정리하는 모습을 떠올릴 수 있어요.", ...details("신금 일간과 무자(토·수) 월주를 함께 참고했어요.") },
    topic: { kind: "relationship", headline: "관계", body: "말을 고른 뒤 건네는 모습을 떠올릴 수 있어요.", ...details("신금 일간과 무자(토·수) 월주를 함께 참고했어요.") },
    today: { date: koreaDate(), headline: "오늘", body: "가벼운 안부를 물어보세요." },
  };
  for (const section of ["personality", "topic"] as const) {
    for (const key of ["basis", "meaning", "scene", "balance", "action"] as const) {
      const incompleteSection = Object.fromEntries(Object.entries(complete[section]).filter(([name]) => name !== key));
      await withGeminiMock(async () => modelResponse({ ...complete, [section]: incompleteSection }, true, false), async () => {
        const response = await POST(request(input));
        assert.equal(response.status, 502, `${section}.${key} 누락 거절`);
        assert.equal("reading" in await response.json(), false);
      });
    }
  }
});

test("키가 없으면 Gemini를 호출하지 않고 설정 오류를 보여준다", async () => {
  await withGeminiMock(async () => { throw new Error("Gemini 호출 금지"); }, async () => {
    const response = await POST(request(input));
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /unit-test-secret/);
  }, null);
});

test("요청 한도와 모델 응답 실패를 가짜 결과로 바꾸지 않는다", async () => {
  await withGeminiMock(async () => new Response("private provider detail", { status: 429 }), async () => {
    const response = await POST(request(input));
    assert.equal(response.status, 429);
    const json = await response.json();
    assert.equal("reading" in json, false);
    assert.doesNotMatch(JSON.stringify(json), /private provider detail/);
  });
  await withGeminiMock(async () => modelResponse({
    personality: { headline: "성향", body: "설명" },
    topic: { kind: "money", headline: "잘못된 주제", body: "설명" },
    today: { date: koreaDate(), headline: "오늘", body: "설명" },
  }), async () => {
    const response = await POST(request(input));
    assert.equal(response.status, 502);
    assert.equal("reading" in await response.json(), false);
  });
});

test("모델 접근 불가·네트워크 오류도 비밀값이나 가짜 결과 없이 알린다", async () => {
  await withGeminiMock(async () => new Response("private provider detail", { status: 404 }), async () => {
    const response = await POST(request(input));
    assert.equal(response.status, 502);
    const json = await response.json();
    assert.match(json.error, /모델/);
    assert.equal("reading" in json, false);
    assert.doesNotMatch(JSON.stringify(json), /private provider detail|unit-test-secret/);
  });
  await withGeminiMock(async () => { throw new Error("private network detail"); }, async () => {
    const response = await POST(request(input));
    assert.equal(response.status, 502);
    const json = await response.json();
    assert.equal("reading" in json, false);
    assert.doesNotMatch(JSON.stringify(json), /private network detail|unit-test-secret/);
  });
});

test("새 Gemini 응답에서 이번 주 풀이가 빠지거나 기간이 틀리면 거절한다", async () => {
  const base = {
    personality: { headline: "성향", body: "신금은 쇠를 닮은 글자예요." },
    topic: { kind: "relationship", headline: "관계", body: "무자는 태어난 달의 두 글자예요." },
    today: { date: koreaDate(), headline: "오늘", body: "안부를 물어보세요." },
  };
  const wrongWeek = {
    ...base,
    weekly: {
      ...koreaWeekRange(koreaDate()),
      endDate: "2099-12-31",
      headline: "이번 주",
      body: "가볍게 이야기해 보세요.",
    },
  };
  for (const [reading, includeWeekly] of [[base, false], [wrongWeek, true]] as const) {
    await withGeminiMock(async () => modelResponse(reading, includeWeekly), async () => {
      const response = await POST(request(input));
      assert.equal(response.status, 502);
      const json = await response.json();
      assert.equal("reading" in json, false);
      assert.doesNotMatch(JSON.stringify(json), /unit-test-secret/);
    });
  }
});
