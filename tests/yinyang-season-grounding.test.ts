import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculate, type SajuChart, type SajuInput } from "../lib/saju/chart";
import {
  assertChartGrounding,
  buildInterpretationPayload,
  parseInterpretationResponse,
} from "../lib/saju/interpretation";
import {
  loadLatestResult,
  saveLatestResult,
  type SavedInterpretation,
} from "../lib/saju/interpretation-storage";
import {
  traditionalContextFacts,
  traditionalContextForChart,
} from "../lib/saju/traditional-context";

const stems = {
  甲: ["갑", "목"], 乙: ["을", "목"], 丙: ["병", "화"], 丁: ["정", "화"],
  戊: ["무", "토"], 己: ["기", "토"], 庚: ["경", "금"], 辛: ["신", "금"],
  壬: ["임", "수"], 癸: ["계", "수"],
} as const;
const branches = {
  子: ["자", "수"], 丑: ["축", "토"], 寅: ["인", "목"], 卯: ["묘", "목"],
  辰: ["진", "토"], 巳: ["사", "화"], 午: ["오", "화"], 未: ["미", "토"],
  申: ["신", "금"], 酉: ["유", "금"], 戌: ["술", "토"], 亥: ["해", "수"],
} as const;

type Stem = keyof typeof stems;
type Branch = keyof typeof branches;

function chartWith(stemCharacters: Stem[], branchCharacters: Branch[]): SajuChart {
  assert.equal(stemCharacters.length, 4);
  assert.equal(branchCharacters.length, 4);
  const labels = ["년주", "월주", "일주", "시주"] as const;
  const pillars = labels.map((label, index) => {
    const stem = stemCharacters[index];
    const branch = branchCharacters[index];
    return {
      label,
      text: `${stem}${branch}`,
      korean: `${stems[stem][0]}${branches[branch][0]}`,
      stem,
      branch,
      stemElement: stems[stem][1],
      branchElement: branches[branch][1],
    };
  });
  return {
    pillars,
    elements: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 },
    dayMaster: {
      character: pillars[2].stem,
      korean: pillars[2].korean[0],
      element: pillars[2].stemElement,
    },
    method: "테스트용 공개 분류표",
    engine: "test",
    elementMethod: "테스트",
  };
}

const input: SajuInput = {
  date: "2005-12-23",
  time: "08:37",
  calendar: "solar",
  topic: "relationship",
  question: "친구와 더 잘 대화하고 싶어요",
};
const date = "2026-09-23";

function structuredReading(topicBasis: string) {
  const details = {
    basis: "신금 일간과 을유(목·금) 년주를 참고했어요.",
    meaning: "계산한 두 단서를 일상의 선택과 연결해 살펴봐요.",
    scene: "친구와 이야기하기 전에 생각을 정리하는 장면이에요.",
    balance: "한 가지 단서만으로 성격이나 미래를 확정하지 않아요.",
    action: "오늘 전하고 싶은 말을 한 문장으로 적어보세요.",
  };
  return parseInterpretationResponse({
    personality: { headline: "나의 성향", body: "차분히 살펴봐요.", ...details },
    topic: {
      kind: "relationship",
      headline: "관계의 힌트",
      body: "대화의 순서를 정해봐요.",
      ...details,
      basis: topicBasis,
    },
    today: { date, headline: "오늘", body: "작은 대화를 시작해 보세요." },
  }, "relationship", date, "", false, true);
}

test("천간 10자와 지지 12자를 공개 음양 분류표대로 센다", () => {
  const yangStems = new Set<Stem>(["甲", "丙", "戊", "庚", "壬"]);
  const yangBranches = new Set<Branch>(["子", "寅", "辰", "午", "申", "戌"]);

  for (const stem of Object.keys(stems) as Stem[]) {
    const result = traditionalContextForChart(chartWith(
      [stem, stem, stem, stem],
      ["丑", "丑", "丑", "丑"],
    ));
    assert.deepEqual(
      result.yinYang,
      yangStems.has(stem) ? { yin: 4, yang: 4 } : { yin: 8, yang: 0 },
      `${stem} 천간 분류`,
    );
  }

  for (const branch of Object.keys(branches) as Branch[]) {
    const result = traditionalContextForChart(chartWith(
      ["乙", "乙", "乙", "乙"],
      [branch, branch, branch, branch],
    ));
    assert.deepEqual(
      result.yinYang,
      yangBranches.has(branch) ? { yin: 4, yang: 4 } : { yin: 8, yang: 0 },
      `${branch} 지지 분류`,
    );
  }
});

test("월지 12자를 봄·여름·가을·겨울 전통 구간에 빠짐없이 매핑한다", () => {
  const expected = {
    寅: "봄", 卯: "봄", 辰: "봄",
    巳: "여름", 午: "여름", 未: "여름",
    申: "가을", 酉: "가을", 戌: "가을",
    亥: "겨울", 子: "겨울", 丑: "겨울",
  } as const;

  for (const [monthBranch, season] of Object.entries(expected) as [Branch, typeof expected[Branch]][]) {
    const result = traditionalContextForChart(chartWith(
      ["甲", "乙", "丙", "丁"],
      ["子", monthBranch, "寅", "卯"],
    ));
    assert.equal(result.season.name, season, `${monthBranch}월의 계절`);
    assert.equal(result.season.monthBranch, monthBranch);
    assert.equal(result.season.monthLabel, `${branches[monthBranch][0]}월`);
  }
});

test("공개 기준 입력은 여덟 글자의 음양 합계와 자월의 겨울 구간을 재현한다", () => {
  const chart = calculate(input);
  const result = traditionalContextForChart(chart);

  assert.equal(result.yinYang.yin + result.yinYang.yang, 8);
  assert.deepEqual(result.yinYang, { yin: 4, yang: 4 });
  assert.deepEqual(result.season, { name: "겨울", monthBranch: "子", monthLabel: "자월" });
  assert.deepEqual(traditionalContextFacts(result), {
    yinYang: "음 4·양 4",
    season: "겨울(자월)",
  });
});

test("Gemini 전달 자료에는 계산된 전통 맥락만 있고 원본 생년월일·출생시간은 없다", () => {
  const chart = calculate(input);
  const payload = buildInterpretationPayload(input, chart, date);
  const serialized = JSON.stringify(payload);

  assert.deepEqual(payload.chart.traditionalContext, {
    yinYang: { yin: 4, yang: 4 },
    season: { name: "겨울", monthBranch: "子", monthLabel: "자월" },
  });
  assert.doesNotMatch(serialized, /2005-12-23/);
  assert.doesNotMatch(serialized, /08:37/);
  assert.doesNotMatch(serialized, /친구와 더 잘 대화하고 싶어요/);
});

test("강화 검증은 주제 근거의 정확한 음양 개수와 계절을 요구하되 기본 호출은 호환된다", () => {
  const chart = calculate(input);
  const oldBasis = "신금 일간과 무자(토·수) 월주를 참고했어요.";
  const oldReading = structuredReading(oldBasis);
  const grounded = structuredReading(`${oldBasis} 음 4·양 4이며 겨울(자월)에 해당해요.`);

  assert.doesNotThrow(() => assertChartGrounding(oldReading, chart));
  assert.throws(() => assertChartGrounding(oldReading, chart, true));
  assert.doesNotThrow(() => assertChartGrounding(grounded, chart, true));

  for (const [label, basis] of [
    ["음양 누락", `${oldBasis} 겨울(자월)에 해당해요.`],
    ["계절 누락", `${oldBasis} 음 4·양 4예요.`],
    ["음양 오류", `${oldBasis} 음 5·양 3이며 겨울(자월)에 해당해요.`],
    ["계절 오류", `${oldBasis} 음 4·양 4이며 가을(유월)에 해당해요.`],
  ]) {
    assert.throws(
      () => assertChartGrounding(structuredReading(basis), chart, true),
      label,
    );
  }
});

test("음양 개수를 성격의 균형·조화로 과장하면 거절하고 비단정 주의 문장은 허용한다", () => {
  const chart = calculate(input);
  const basis = "신금 일간과 무자(토·수) 월주를 참고했어요. 음 4·양 4이며 겨울(자월)에 해당해요.";
  const grounded = structuredReading(basis);
  const caution = {
    ...grounded,
    topic: {
      ...grounded.topic,
      details: {
        ...grounded.topic.details!,
        balance: "음양 개수가 같아도 성격이나 능력을 단정할 수 없어요.",
      },
    },
  };
  assert.doesNotThrow(() => assertChartGrounding(caution, chart, true));

  const cases = [
    ["주제 제목", { ...grounded, topic: { ...grounded.topic, headline: "음양의 균형이 좋은 사람" } }],
    ["주제 요약", { ...grounded, topic: { ...grounded.topic, body: "음 4·양 4의 조화가 능력이 돼요." } }],
    ["쉬운 뜻", { ...grounded, topic: { ...grounded.topic, details: { ...grounded.topic.details!, meaning: "음양이 균형을 이뤄 침착해요." } } }],
    ["생활 장면", { ...grounded, topic: { ...grounded.topic, details: { ...grounded.topic.details!, scene: "음양의 조화로 대화를 잘해요." } } }],
    ["작은 행동", { ...grounded, topic: { ...grounded.topic, details: { ...grounded.topic.details!, action: "음 4·양 4의 균형을 활용해 결정하세요." } } }],
    ["오늘 풀이", { ...grounded, today: { ...grounded.today, body: "음양이 조화로워 무엇이든 잘 풀려요." } }],
    ["주간 풀이", {
      ...grounded,
      weekly: {
        startDate: "2026-09-21",
        endDate: "2026-09-27",
        headline: "이번 주",
        body: "음 4·양 4의 균형이 관계를 좋게 만들어요.",
      },
    }],
  ] as const;
  for (const [label, reading] of cases) {
    assert.throws(() => assertChartGrounding(reading, chart, true), label);
  }
});

test("결과 화면은 두 계산 사실과 비단정 안내를 모바일 친화 카드로 표시한다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /result\.chart\.pillars\.length \* 2\}개 글자의[\s\S]*term="음양"/);
  assert.match(source, /음 \{chartContext\.yinYang\.yin\} · 양 \{chartContext\.yinYang\.yang\}/);
  assert.match(source, /월지의 전통 계절 구간/);
  assert.match(source, /\{chartContext\.season\.name\} · \{chartContext\.season\.monthLabel\}/);
  assert.match(source, /어느 쪽이 더 좋다는 뜻은 아니에요/);
  assert.match(source, /실제 출생지의 날씨가 아니라 월지로 나눈 전통 달력 구간/);
  assert.match(css, /\.traditional-context-facts\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(220px,\s*100%\),\s*1fr\)\)/);
  assert.match(css, /\.traditional-context-facts article\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /\.traditional-context-facts small\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test("이전 형식으로 저장된 실제 차트에서도 음양과 계절을 다시 계산한다", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  } as Storage;
  const chart = calculate(input);
  const reading = parseInterpretationResponse({
    personality: { headline: "성향", body: "신금의 특징을 참고해요." },
    topic: { kind: "relationship", headline: "관계", body: "무자 월주의 흐름도 살펴봐요." },
    today: { date, headline: "오늘", body: "짧게 안부를 전해보세요." },
  }, "relationship", date);
  const saved: SavedInterpretation = {
    version: 1,
    createdAt: "2026-09-23T00:00:00.000Z",
    chart,
    topic: "relationship",
    reading,
  };

  saveLatestResult(storage, saved);
  const restored = loadLatestResult(storage);
  assert.ok(restored);
  assert.equal("traditionalContext" in restored.chart, false, "기존 저장 형식에는 새 파생값이 없어도 됨");
  assert.deepEqual(traditionalContextForChart(restored.chart), {
    yinYang: { yin: 4, yang: 4 },
    season: { name: "겨울", monthBranch: "子", monthLabel: "자월" },
  });
});
