import type { SajuChart, SajuInput } from "./chart";
import { isReadingTopic, type ReadingTopic } from "./topics";
import { parsePersonalContext, type PersonalContext } from "./personal-context";
import { traditionalContextFacts, traditionalContextForChart } from "./traditional-context";

export { isReadingTopic } from "./topics";
export type { ReadingTopic } from "./topics";

export type ReadingDetails = {
  basis: string;
  meaning: string;
  scene: string;
  balance: string;
  action: string;
};

export type ReadingSection = {
  headline: string;
  body: string;
  details?: ReadingDetails;
};

export type DailyFortune = { date: string; body: string };

export type Interpretation = {
  context?: PersonalContext;
  questionAnswer?: { basis?: string; answer: string; action: string };
  personality: ReadingSection;
  topic: ReadingSection & { kind: ReadingTopic };
  today: ReadingSection & { date: string; action?: string };
  weekly?: ReadingSection & { startDate: string; endDate: string; action?: string; days?: DailyFortune[] };
};

export class InvalidInterpretationError extends Error {}

export function koreaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function koreaWeekRange(date: string): { startDate: string; endDate: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new InvalidInterpretationError("날짜 형식이 올바르지 않습니다.");
  const day = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) {
    throw new InvalidInterpretationError("날짜 형식이 올바르지 않습니다.");
  }
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const startDate = day.toISOString().slice(0, 10);
  day.setUTCDate(day.getUTCDate() + 6);
  return { startDate, endDate: day.toISOString().slice(0, 10) };
}

export function buildInterpretationPayload(input: SajuInput, chart: SajuChart, date: string, context?: PersonalContext) {
  if (!isReadingTopic(input.topic)) throw new InvalidInterpretationError("지원하지 않는 주제입니다.");
  const traditionalContext = traditionalContextForChart(chart);
  return {
    chart: {
      pillars: chart.pillars.map(({ label, korean, stem, branch, stemElement, branchElement }) => ({ label, korean, stem, branch, stemElement, branchElement })),
      dayMaster: chart.dayMaster,
      elements: chart.elements,
      elementMethod: chart.elementMethod,
      traditionalContext,
    },
    topic: input.topic,
    ...(context ? { context } : {}),
    date,
    week: koreaWeekRange(date),
  };
}

export function assertChartGrounding(reading: Interpretation, chart: SajuChart, requireTraditionalContext = false): void {
  const dayMaster = `${chart.dayMaster.korean}${chart.dayMaster.element}`;
  const monthPillar = chart.pillars[1]?.korean;
  const monthPillarFact = chart.pillars[1] ? `${chart.pillars[1].korean}(${chart.pillars[1].stemElement}·${chart.pillars[1].branchElement})` : "";
  const personalityBasis = reading.personality.details?.basis || reading.personality.body;
  const topicBasis = reading.topic.details?.basis || reading.topic.body;
  const traditionalFacts = traditionalContextFacts(traditionalContextForChart(chart));
  const traditionalInterpretationText = [
    reading.topic.headline,
    reading.topic.body,
    reading.topic.details?.meaning || "",
    reading.topic.details?.scene || "",
    reading.topic.details?.action || "",
    reading.today.body,
    reading.weekly?.body || "",
  ].join(" ");
  const overstatesYinYang = /음\s*\d+\s*·\s*양\s*\d+\s*의\s*(?:균형|조화)|음양(?:의|이)\s*(?:균형|조화)/.test(traditionalInterpretationText);
  const otherPillar = chart.pillars.some((pillar, index) => index !== 2 && personalityBasis.includes(`${pillar.korean}(${pillar.stemElement}·${pillar.branchElement})`));
  const structuredGroundingInvalid = Boolean(reading.personality.details || reading.topic.details) && (
    !reading.personality.details || !reading.topic.details || !otherPillar ||
    !topicBasis.includes(dayMaster) || !topicBasis.includes(monthPillarFact) ||
    (requireTraditionalContext && (!topicBasis.includes(traditionalFacts.yinYang) || !topicBasis.includes(traditionalFacts.season) || overstatesYinYang))
  );
  if (!personalityBasis.includes(dayMaster) || !monthPillar || !topicBasis.includes(monthPillar) || structuredGroundingInvalid) {
    throw new InvalidInterpretationError("사주 계산 근거가 풀이에 반영되지 않았습니다.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readingText(value: unknown, max: number): string {
  if (typeof value !== "string") throw new InvalidInterpretationError("해석 형식이 올바르지 않습니다.");
  const text = value.trim();
  if (!text || text.length > max || /<[^>]+>/.test(text)) {
    throw new InvalidInterpretationError("해석 형식이 올바르지 않습니다.");
  }
  return text;
}

function readingDetails(value: Record<string, unknown>): ReadingDetails | undefined {
  if (value.details !== undefined && !isRecord(value.details)) {
    throw new InvalidInterpretationError("구조화된 풀이 형식이 올바르지 않습니다.");
  }
  const source = isRecord(value.details) ? value.details : value;
  const keys = ["basis", "meaning", "scene", "balance", "action"] as const;
  const present = keys.filter((key) => source[key] !== undefined);
  if (present.length === 0) return undefined;
  if (present.length !== keys.length) throw new InvalidInterpretationError("구조화된 풀이 항목이 빠졌습니다.");
  return {
    basis: readingText(source.basis, 320),
    meaning: readingText(source.meaning, 400),
    scene: readingText(source.scene, 400),
    balance: readingText(source.balance, 320),
    action: readingText(source.action, 240),
  };
}

export function isTimingQuestion(question: string): boolean {
  return /언제|시기|때쯤|몇\s*(?:월|년|일|개월)|올해|내년/.test(question);
}

function directTimingAnswer(question: string, topic: ReadingTopic): string {
  if (topic === "career" && /취직|취업|입사|일자리|직장|채용|합격/.test(question)) {
    return "정확히 언제 취직할지는 사주로 알 수 없어요.";
  }
  return "정확한 시기는 사주만으로 알 수 없어요.";
}

function containsUnsupportedTiming(text: string): boolean {
  return /20\d{2}년|(?:^|\D)\d{1,2}월|내년|다음\s*달|올해\s*(?:상반기|하반기)|\d+\s*개월\s*후/.test(text);
}

export function parseQuestionAnswerResponse(
  raw: unknown,
  question: string,
  topic: ReadingTopic,
  requiredBasis: string[] = [],
): NonNullable<Interpretation["questionAnswer"]> {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new InvalidInterpretationError("질문 답변 형식이 올바르지 않습니다.");
    }
  }
  if (!isRecord(value)) throw new InvalidInterpretationError("질문에 대한 답이 빠졌습니다.");
  const basis = value.basis === undefined ? undefined : readingText(value.basis, 320);
  if (requiredBasis.length && (!basis || requiredBasis.some((fact) => !basis.includes(fact)))) {
    throw new InvalidInterpretationError("질문 답변에 실제 사주 근거가 빠졌습니다.");
  }
  const timingQuestion = isTimingQuestion(question);
  const answer = timingQuestion ? directTimingAnswer(question, topic) : readingText(value.answer, 520);
  if (requiredBasis.length && !timingQuestion && answer.length < 160) {
    throw new InvalidInterpretationError("질문 답변의 구체적인 설명이 부족합니다.");
  }
  const action = readingText(value.action, 240);
  if (timingQuestion && containsUnsupportedTiming(action)) {
    throw new InvalidInterpretationError("확실하지 않은 시기가 행동 제안에 포함되었습니다.");
  }
  return { ...(basis ? { basis } : {}), answer, action };
}

export function parseInterpretationResponse(
  raw: unknown,
  topic: ReadingTopic,
  date: string,
  question = "",
  requireWeekly = false,
  requireDetails = false,
  requireFortuneActions = false,
  requireDailyFortunes = false,
): Interpretation {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new InvalidInterpretationError("해석 형식이 올바르지 않습니다.");
    }
  }
  if (!isRecord(value) || !isRecord(value.personality) || !isRecord(value.topic) || !isRecord(value.today)) {
    throw new InvalidInterpretationError("해석 형식이 올바르지 않습니다.");
  }
  if (value.topic.kind !== topic || value.today.date !== date) {
    throw new InvalidInterpretationError("해석의 주제 또는 날짜가 일치하지 않습니다.");
  }
  if (requireWeekly && !isRecord(value.weekly)) {
    throw new InvalidInterpretationError("이번 주 풀이가 빠졌습니다.");
  }
  if (requireFortuneActions && (value.today.action === undefined || !isRecord(value.weekly) || value.weekly.action === undefined)) {
    throw new InvalidInterpretationError("오늘과 이번 주의 작은 행동이 빠졌습니다.");
  }
  if (requireDailyFortunes && (!isRecord(value.weekly) || value.weekly.days === undefined)) {
    throw new InvalidInterpretationError("날짜별 풀이가 빠졌습니다.");
  }
  const personalityDetails = readingDetails(value.personality);
  const topicDetails = readingDetails(value.topic);
  if (requireDetails && (!personalityDetails || !topicDetails)) {
    throw new InvalidInterpretationError("구조화된 풀이가 빠졌습니다.");
  }
  let weekly: Interpretation["weekly"];
  if (value.weekly !== undefined) {
    if (!isRecord(value.weekly)) throw new InvalidInterpretationError("이번 주 풀이 형식이 올바르지 않습니다.");
    const range = koreaWeekRange(date);
    if (value.weekly.startDate !== range.startDate || value.weekly.endDate !== range.endDate) {
      throw new InvalidInterpretationError("이번 주 풀이 기간이 일치하지 않습니다.");
    }
    let days: DailyFortune[] | undefined;
    if (value.weekly.days !== undefined) {
      if (!Array.isArray(value.weekly.days) || value.weekly.days.length !== 7) {
        throw new InvalidInterpretationError("날짜별 풀이가 일곱 개가 아닙니다.");
      }
      const first = new Date(`${range.startDate}T00:00:00Z`);
      days = value.weekly.days.map((day, index) => {
        first.setUTCDate(first.getUTCDate() + (index === 0 ? 0 : 1));
        const expectedDate = first.toISOString().slice(0, 10);
        if (!isRecord(day) || day.date !== expectedDate) {
          throw new InvalidInterpretationError("날짜별 풀이 날짜가 일치하지 않습니다.");
        }
        return { date: expectedDate, body: readingText(day.body, 320) };
      });
    }
    weekly = {
      ...range,
      headline: readingText(value.weekly.headline, 80),
      body: readingText(value.weekly.body, 800),
      ...(value.weekly.action !== undefined ? { action: readingText(value.weekly.action, 160) } : {}),
      ...(days ? { days } : {}),
    };
  }
  let questionAnswer: Interpretation["questionAnswer"];
  if (question.trim() || value.questionAnswer !== undefined) {
    questionAnswer = parseQuestionAnswerResponse(value.questionAnswer, question, topic);
  }
  const interpretation: Interpretation = {
    ...(value.context !== undefined ? { context: parsePersonalContext(value.context, true)! } : {}),
    ...(questionAnswer ? { questionAnswer } : {}),
    personality: {
      headline: readingText(value.personality.headline, 80),
      body: readingText(value.personality.body, 800),
      ...(personalityDetails ? { details: personalityDetails } : {}),
    },
    topic: {
      kind: topic,
      headline: readingText(value.topic.headline, 80),
      body: readingText(value.topic.body, 800),
      ...(topicDetails ? { details: topicDetails } : {}),
    },
    today: {
      date,
      headline: readingText(value.today.headline, 80),
      body: readingText(value.today.body, 800),
      ...(value.today.action !== undefined ? { action: readingText(value.today.action, 160) } : {}),
    },
    ...(weekly ? { weekly } : {}),
  };
  const sameDay = interpretation.weekly?.days?.find((day) => day.date === date);
  if (sameDay) sameDay.body = interpretation.today.body;
  if (question.trim() && isTimingQuestion(question)) {
    const prose = [interpretation.personality.headline, interpretation.personality.body,
      interpretation.topic.headline, interpretation.topic.body,
      interpretation.today.headline, interpretation.today.body,
      interpretation.weekly?.headline || "", interpretation.weekly?.body || "",
      interpretation.questionAnswer?.action || ""].join(" ");
    if (containsUnsupportedTiming(prose)) {
      throw new InvalidInterpretationError("확실하지 않은 시기가 해석에 포함되었습니다.");
    }
  }
  return interpretation;
}
