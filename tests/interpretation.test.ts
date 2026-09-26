import test from "node:test";
import assert from "node:assert/strict";
import { calculate, type SajuInput } from "../lib/saju/chart";
import {
  assertChartGrounding,
  buildInterpretationPayload,
  koreaDate,
  koreaWeekRange,
  parseInterpretationResponse,
} from "../lib/saju/interpretation";
import {
  clearLatestResult,
  loadLatestResult,
  saveLatestResult,
  type SavedInterpretation,
} from "../lib/saju/interpretation-storage";

const input: SajuInput = {
  date: "2005-12-23",
  time: "08:37",
  calendar: "solar",
  topic: "relationship",
  question: "친구와 더 잘 대화하고 싶어요",
};
const seoulDate = "2026-09-23";

test("이번 주는 한국 날짜 기준 월요일부터 일요일까지 계산한다", () => {
  for (const [date, startDate, endDate] of [
    ["2026-09-21", "2026-09-21", "2026-09-27"], // 월요일
    ["2026-09-23", "2026-09-21", "2026-09-27"], // 수요일
    ["2026-09-27", "2026-09-21", "2026-09-27"], // 일요일
    ["2026-01-01", "2025-12-29", "2026-01-04"], // 연말·연초
    ["2024-12-31", "2024-12-30", "2025-01-05"], // 연도 경계
  ]) {
    assert.deepEqual(koreaWeekRange(date), { startDate, endDate });
  }
  assert.equal(koreaDate(new Date("2026-09-20T15:30:00Z")), "2026-09-21");
  assert.deepEqual(koreaWeekRange(koreaDate(new Date("2026-09-20T15:30:00Z"))),
    { startDate: "2026-09-21", endDate: "2026-09-27" });
});

test("존재하지 않는 한국 날짜는 이번 주 범위로 계산하지 않는다", () => {
  for (const date of ["2026-02-29", "2026-13-01", "2026-9-23", "invalid"]) {
    assert.throws(() => koreaWeekRange(date));
  }
});

test("Gemini에 전달할 자료에는 계산 결과와 맥락만 있고 원본 생년월일·출생시간은 없다", () => {
  const chart = calculate(input);
  const payload = buildInterpretationPayload(input, chart, seoulDate);
  const serialized = JSON.stringify(payload);

  assert.match(serialized, /relationship/);
  assert.match(serialized, /2026-09-23/);
  assert.deepEqual(payload.week, { startDate: "2026-09-21", endDate: "2026-09-27" });
  assert.doesNotMatch(serialized, /친구와 더 잘 대화하고 싶어요/);
  assert.deepEqual(payload.chart.pillars[2], {
    label: "일주",
    korean: "신사",
    stem: "辛",
    branch: "巳",
    stemElement: "금",
    branchElement: "화",
  });
  assert.doesNotMatch(serialized, /2005-12-23/);
  assert.doesNotMatch(serialized, /08:37/);
});

test("Gemini 자료를 만들면서 기존 사주 계산 결과를 바꾸지 않는다", () => {
  const chart = calculate(input);
  const before = JSON.stringify(chart);
  buildInterpretationPayload(input, chart, seoulDate);
  assert.equal(JSON.stringify(chart), before);
});

test("형식이 비었거나 잘못된 Gemini 응답은 결과로 받아들이지 않는다", () => {
  for (const raw of [null, "", "평범한 사주 풀이", {}, [], { personality: {} }]) {
    assert.throws(() => parseInterpretationResponse(raw, "relationship", seoulDate));
  }
});

const validReading = {
  personality: { headline: "나만의 성향", body: "다른 사람의 이야기를 잘 들어요." },
  topic: { kind: "relationship", headline: "대화의 힌트", body: "작은 질문부터 건네 보세요." },
  today: { date: seoulDate, headline: "오늘의 한 걸음", body: "마음을 편하게 표현해 보세요." },
} as const;

const structuredDetails = {
  basis: "신금 일간과 무자(토·수) 월주를 함께 참고했어요.",
  meaning: "쇠의 단단함과 겨울 물의 차분함을 함께 떠올릴 수 있어요.",
  scene: "대화하기 전에 생각을 짧게 정리하는 모습을 떠올릴 수 있어요.",
  balance: "두 단서만으로 실제 성격을 확정할 수는 없어요.",
  action: "오늘 전하고 싶은 말을 한 문장으로 적어보세요.",
} as const;

const structuredReading = {
  ...validReading,
  personality: { ...validReading.personality, ...structuredDetails },
  topic: { ...validReading.topic, ...structuredDetails },
} as const;

test("세 영역이 모두 있는 올바른 응답만 받아들인다", () => {
  assert.deepEqual(
    parseInterpretationResponse(validReading, "relationship", seoulDate),
    validReading,
  );
});

test("새 Gemini 응답은 성향과 주제에 다섯 구조화 항목을 모두 요구한다", () => {
  const parsed = parseInterpretationResponse(structuredReading, "relationship", seoulDate, "", false, true);
  assert.deepEqual(parsed.personality.details, structuredDetails);
  assert.deepEqual(parsed.topic.details, structuredDetails);

  for (const section of ["personality", "topic"] as const) {
    for (const key of ["basis", "meaning", "scene", "balance", "action"] as const) {
      const incomplete = {
        ...structuredReading,
        [section]: Object.fromEntries(Object.entries(structuredReading[section]).filter(([name]) => name !== key)),
      };
      assert.throws(
        () => parseInterpretationResponse(incomplete, "relationship", seoulDate, "", false, true),
        `${section}.${key} 누락은 거절`,
      );
    }
  }
});

test("구조화 풀이의 근거는 실제 일간·월주와 성향의 추가 기둥을 포함해야 한다", () => {
  const chart = calculate(input);
  const grounded = parseInterpretationResponse(structuredReading, "relationship", seoulDate, "", false, true);
  assert.doesNotThrow(() => assertChartGrounding(grounded, chart));

  const cases = [
    {
      label: "성향에 실제 일간 없음",
      reading: { ...grounded, personality: { ...grounded.personality, details: { ...grounded.personality.details!, basis: "무자(토·수) 월주를 참고했어요." } } },
    },
    {
      label: "성향에 다른 실제 기둥 없음",
      reading: { ...grounded, personality: { ...grounded.personality, details: { ...grounded.personality.details!, basis: "신금 일간을 참고했어요." } } },
    },
    {
      label: "주제에 실제 일간 없음",
      reading: { ...grounded, topic: { ...grounded.topic, details: { ...grounded.topic.details!, basis: "무자(토·수) 월주를 참고했어요." } } },
    },
    {
      label: "주제에 실제 월주 없음",
      reading: { ...grounded, topic: { ...grounded.topic, details: { ...grounded.topic.details!, basis: "신금 일간을 참고했어요." } } },
    },
    {
      label: "성향의 다른 실제 기둥에서 아랫글자 오행 없음",
      reading: { ...grounded, personality: { ...grounded.personality, details: { ...grounded.personality.details!, basis: "신금 일간과 무자(토) 월주를 참고했어요." } } },
    },
    {
      label: "주제의 월주에서 아랫글자 오행 없음",
      reading: { ...grounded, topic: { ...grounded.topic, details: { ...grounded.topic.details!, basis: "신금 일간과 무자(토) 월주를 참고했어요." } } },
    },
  ];
  for (const item of cases) {
    assert.throws(() => assertChartGrounding(item.reading, chart), item.label);
  }
});

test("새 결과에는 올바른 이번 주 풀이가 반드시 있어야 한다", () => {
  const weekly = {
    startDate: "2026-09-21",
    endDate: "2026-09-27",
    headline: "이번 주의 작은 힌트",
    body: "친구에게 가볍게 안부를 물어보세요.",
  };
  assert.throws(() => parseInterpretationResponse(validReading, "relationship", seoulDate, "", true));
  assert.deepEqual(
    parseInterpretationResponse({ ...validReading, weekly }, "relationship", seoulDate, "", true),
    { ...validReading, weekly },
  );
  for (const invalid of [
    { ...weekly, startDate: "2026-09-22" },
    { ...weekly, endDate: "2026-09-28" },
    { ...weekly, body: " " },
  ]) {
    assert.throws(() => parseInterpretationResponse(
      { ...validReading, weekly: invalid }, "relationship", seoulDate, "", true,
    ));
  }
});

test("질문이 없으면 질문 답변 없이도 해석을 받을 수 있다", () => {
  assert.deepEqual(
    parseInterpretationResponse(validReading, "relationship", seoulDate, ""),
    validReading,
  );
});

test("질문이 있으면 직접 답변과 작은 행동 제안이 모두 있어야 한다", () => {
  const question = "친구와 어떻게 더 잘 대화할까요?";
  assert.throws(() =>
    parseInterpretationResponse(validReading, "relationship", seoulDate, question),
  );
  const withAnswer = {
    ...validReading,
    questionAnswer: {
      answer: "친구의 이야기를 먼저 들어보면 대화를 시작하기 쉬워요.",
      action: "오늘 친구에게 요즘 즐거웠던 일을 하나 물어보세요.",
    },
  };
  assert.deepEqual(
    parseInterpretationResponse(withAnswer, "relationship", seoulDate, question),
    withAnswer,
  );
  for (const invalid of [
    { ...withAnswer, questionAnswer: { answer: " ", action: "질문해 보세요." } },
    { ...withAnswer, questionAnswer: { answer: "먼저 들어보세요.", action: "<b>질문</b>" } },
  ]) {
    assert.throws(() =>
      parseInterpretationResponse(invalid, "relationship", seoulDate, question),
    );
  }
});

test("취업 시점 질문에는 모델의 임의 날짜 대신 알 수 없다는 답을 보여준다", () => {
  const withInventedDate = {
    ...validReading,
    topic: { kind: "career", headline: "일 이야기", body: "준비 과정을 돌아보세요." },
    questionAnswer: {
      answer: "2027년 3월에 반드시 취업합니다.",
      action: "이번 주에 이력서 한 부분을 다듬어 보세요.",
    },
  };
  for (const question of ["언제 취직을 할 수 있을지 궁금해", "저는 언제 취업할까요?"]) {
    const reading = parseInterpretationResponse(withInventedDate, "career", seoulDate, question);
    assert.match(reading.questionAnswer?.answer ?? "", /정확히.*취(직|업).*알 수 없/);
    assert.doesNotMatch(reading.questionAnswer?.answer ?? "", /2027|3월|반드시/);
    assert.equal(reading.questionAnswer?.action, withInventedDate.questionAnswer.action);
  }
});

test("취업 시점 질문에서 다른 카드나 행동 제안에 섞인 임의 시기도 거절한다", () => {
  const base = {
    personality: { headline: "성향", body: "천천히 준비하는 방식을 생각해 보세요." },
    topic: { kind: "career", headline: "일 이야기", body: "준비 과정을 돌아보세요." },
    today: { date: seoulDate, headline: "오늘", body: "이력서 한 부분을 읽어보세요." },
    questionAnswer: {
      answer: "정확한 취직 시기를 알 수는 없어요.",
      action: "이번 주에 이력서 한 부분을 다듬어 보세요.",
    },
  };
  const question = "언제 취직을 할 수 있을지 궁금해";
  const unsafeBodies = [
    { ...base, personality: { ...base.personality, body: "2027년에 취업할 수 있어요." } },
    { ...base, topic: { ...base.topic, body: "11월에 합격할 거예요." } },
    { ...base, today: { ...base.today, body: "다음 달에 입사하게 됩니다." } },
    { ...base, questionAnswer: { ...base.questionAnswer, action: "내년에 지원하세요." } },
    { ...base, topic: { ...base.topic, body: "올해 상반기에 좋은 결과가 나와요." } },
    { ...base, questionAnswer: { ...base.questionAnswer, action: "3개월 후 면접을 보세요." } },
  ];
  for (const raw of unsafeBodies) {
    assert.throws(() => parseInterpretationResponse(raw, "career", seoulDate, question));
  }
});

test("선택 주제와 날짜가 다른 응답을 거절한다", () => {
  assert.throws(() =>
    parseInterpretationResponse(
      { ...validReading, topic: { ...validReading.topic, kind: "money" } },
      "relationship",
      seoulDate,
    ),
  );
  assert.throws(() =>
    parseInterpretationResponse(
      { ...validReading, today: { ...validReading.today, date: "2026-09-22" } },
      "relationship",
      seoulDate,
    ),
  );
});

test("빈 제목·본문과 텍스트가 아닌 값은 거절한다", () => {
  for (const personality of [
    { headline: " ", body: "설명" },
    { headline: "제목", body: "" },
    { headline: "제목", body: 123 },
  ]) {
    assert.throws(() =>
      parseInterpretationResponse({ ...validReading, personality }, "relationship", seoulDate),
    );
  }
});

test("HTML 태그나 지나치게 긴 생성 문장은 화면에 사용하지 않는다", () => {
  for (const body of ["<script>alert(1)</script>", "긴".repeat(801)]) {
    assert.throws(() => parseInterpretationResponse({
      ...validReading,
      personality: { ...validReading.personality, body },
    }, "relationship", seoulDate));
  }
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test("최근 결과 한 건만 저장·다시 읽기·삭제할 수 있다", () => {
  const storage = new MemoryStorage();
  const reading = parseInterpretationResponse(validReading, "relationship", seoulDate);
  const result: SavedInterpretation = {
    version: 1,
    createdAt: "2026-09-23T01:02:03.000Z",
    chart: calculate(input),
    topic: "relationship",
    reading,
  };

  assert.equal(loadLatestResult(storage), null);
  saveLatestResult(storage, result);
  assert.deepEqual(loadLatestResult(storage), result);
  assert.equal(loadLatestResult(storage)?.reading.weekly, undefined, "이전 저장본의 주간 운세가 없어도 복원");
  assert.equal(storage.length, 1);
  const contents = storage.getItem(storage.key(0)!)!;
  assert.doesNotMatch(contents, /2005-12-23|08:37|친구와 더 잘 대화하고 싶어요/);

  const newer: SavedInterpretation = {
    ...result,
    createdAt: "2026-09-23T01:03:03.000Z",
  };
  saveLatestResult(storage, newer);
  assert.deepEqual(loadLatestResult(storage), newer);
  assert.equal(storage.length, 1);
  clearLatestResult(storage);
  assert.equal(loadLatestResult(storage), null);
});

test("다섯 세부 항목이 없던 예전 저장 결과도 기존 한 문단으로 계속 복원한다", () => {
  const storage = new MemoryStorage();
  const legacy: SavedInterpretation = {
    version: 1,
    createdAt: "2026-09-23T01:02:03.000Z",
    chart: calculate(input),
    topic: "relationship",
    reading: validReading,
  };
  storage.setItem("saju.latest-interpretation.v1", JSON.stringify(legacy));
  const restored = loadLatestResult(storage);
  assert.deepEqual(restored, legacy);
  assert.equal(restored?.reading.personality.details, undefined);
  assert.equal(restored?.reading.topic.details, undefined);
});

test("새 구조 결과를 저장하고 다시 열어도 다섯 세부 항목을 그대로 복원한다", () => {
  const storage = new MemoryStorage();
  const reading = parseInterpretationResponse(structuredReading, "relationship", seoulDate, "", false, true);
  const result: SavedInterpretation = {
    version: 1,
    createdAt: "2026-09-23T01:02:03.000Z",
    chart: calculate(input),
    topic: "relationship",
    reading,
  };

  saveLatestResult(storage, result);
  const restored = loadLatestResult(storage);
  assert.deepEqual(restored, result);
  assert.deepEqual(restored?.reading.personality.details, structuredDetails);
  assert.deepEqual(restored?.reading.topic.details, structuredDetails);
  assert.deepEqual(Object.keys(restored!.reading.personality.details!), ["basis", "meaning", "scene", "balance", "action"]);
});

test("저장된 nested details가 일부 빠지거나 잘못된 형식이면 복원하지 않는다", () => {
  const storage = new MemoryStorage();
  const reading = parseInterpretationResponse(structuredReading, "relationship", seoulDate, "", false, true);
  const result: SavedInterpretation = {
    version: 1,
    createdAt: "2026-09-23T01:02:03.000Z",
    chart: calculate(input),
    topic: "relationship",
    reading,
  };
  const withoutAction = Object.fromEntries(Object.entries(structuredDetails).filter(([key]) => key !== "action"));
  const invalidReadings = [
    { ...reading, personality: { ...reading.personality, details: withoutAction } },
    { ...reading, topic: { ...reading.topic, details: withoutAction } },
    { ...reading, personality: { ...reading.personality, details: "잘못된 형식" } },
    { ...reading, topic: { ...reading.topic, details: { ...structuredDetails, basis: 123 } } },
  ];

  for (const invalidReading of invalidReadings) {
    storage.setItem("saju.latest-interpretation.v1", JSON.stringify({ ...result, reading: invalidReading }));
    assert.equal(loadLatestResult(storage), null);
  }
});

test("손상되었거나 구버전인 저장 자료를 결과로 보여주지 않는다", () => {
  const storage = new MemoryStorage();
  const result: SavedInterpretation = {
    version: 1,
    createdAt: "2026-09-23T01:02:03.000Z",
    chart: calculate(input),
    topic: "relationship",
    reading: parseInterpretationResponse(validReading, "relationship", seoulDate),
  };
  saveLatestResult(storage, result);
  const key = storage.key(0)!;
  storage.setItem(key, "{broken-json");
  assert.equal(loadLatestResult(storage), null);
  storage.setItem(key, JSON.stringify({ ...result, version: 0 }));
  assert.equal(loadLatestResult(storage), null);
});

test("질문에 대한 답도 최근 결과 한 건에 함께 저장되고 다시 열린다", () => {
  const storage = new MemoryStorage();
  const reading = parseInterpretationResponse({
    ...validReading,
    questionAnswer: {
      answer: "짧은 안부부터 시작해 보세요.",
      action: "오늘 친구에게 안부를 물어보세요.",
    },
  }, "relationship", seoulDate, "친구와 어떻게 대화할까요?");
  const result: SavedInterpretation = {
    version: 1,
    createdAt: "2026-09-23T01:02:03.000Z",
    chart: calculate(input),
    topic: "relationship",
    reading,
  };
  saveLatestResult(storage, result);
  assert.deepEqual(loadLatestResult(storage)?.reading.questionAnswer, reading.questionAnswer);
});
