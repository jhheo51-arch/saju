import type { SajuChart, SajuInput } from "./chart";
import { isReadingTopic, type ReadingTopic } from "./topics";

export { isReadingTopic } from "./topics";
export type { ReadingTopic } from "./topics";

type ReadingSection = { headline: string; body: string };

export type Interpretation = {
  questionAnswer?: { answer: string; action: string };
  personality: ReadingSection;
  topic: ReadingSection & { kind: ReadingTopic };
  today: ReadingSection & { date: string };
  weekly?: ReadingSection & { startDate: string; endDate: string };
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

export function buildInterpretationPayload(input: SajuInput, chart: SajuChart, date: string) {
  if (!isReadingTopic(input.topic)) throw new InvalidInterpretationError("지원하지 않는 주제입니다.");
  return {
    chart: {
      pillars: chart.pillars.map(({ label, korean, stem, branch, stemElement, branchElement }) => ({ label, korean, stem, branch, stemElement, branchElement })),
      dayMaster: chart.dayMaster,
      elements: chart.elements,
      elementMethod: chart.elementMethod,
    },
    topic: input.topic,
    date,
    week: koreaWeekRange(date),
  };
}

export function assertChartGrounding(reading: Interpretation, chart: SajuChart): void {
  const dayMaster = `${chart.dayMaster.korean}${chart.dayMaster.element}`;
  const monthPillar = chart.pillars[1]?.korean;
  if (!reading.personality.body.includes(dayMaster) || !monthPillar || !reading.topic.body.includes(monthPillar)) {
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

export function parseInterpretationResponse(raw: unknown, topic: ReadingTopic, date: string, question = "", requireWeekly = false): Interpretation {
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
  let weekly: Interpretation["weekly"];
  if (value.weekly !== undefined) {
    if (!isRecord(value.weekly)) throw new InvalidInterpretationError("이번 주 풀이 형식이 올바르지 않습니다.");
    const range = koreaWeekRange(date);
    if (value.weekly.startDate !== range.startDate || value.weekly.endDate !== range.endDate) {
      throw new InvalidInterpretationError("이번 주 풀이 기간이 일치하지 않습니다.");
    }
    weekly = {
      ...range,
      headline: readingText(value.weekly.headline, 80),
      body: readingText(value.weekly.body, 800),
    };
  }
  let questionAnswer: Interpretation["questionAnswer"];
  if (question.trim() || value.questionAnswer !== undefined) {
    if (!isRecord(value.questionAnswer)) throw new InvalidInterpretationError("질문에 대한 답이 빠졌습니다.");
    const modelAnswer = readingText(value.questionAnswer.answer, 300);
    const action = readingText(value.questionAnswer.action, 240);
    questionAnswer = {
      answer: question.trim() && isTimingQuestion(question) ? directTimingAnswer(question, topic) : modelAnswer,
      action,
    };
  }
  const interpretation: Interpretation = {
    ...(questionAnswer ? { questionAnswer } : {}),
    personality: {
      headline: readingText(value.personality.headline, 80),
      body: readingText(value.personality.body, 800),
    },
    topic: {
      kind: topic,
      headline: readingText(value.topic.headline, 80),
      body: readingText(value.topic.body, 800),
    },
    today: {
      date,
      headline: readingText(value.today.headline, 80),
      body: readingText(value.today.body, 800),
    },
    ...(weekly ? { weekly } : {}),
  };
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
