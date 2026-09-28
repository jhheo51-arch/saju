import type { SajuChart } from "./chart";

export type DailyFortuneElement = "목" | "화" | "토" | "금" | "수";
const elements: readonly DailyFortuneElement[] = ["목", "화", "토", "금", "수"];

export type DailyFortune = {
  scheme: "palace-door-v2";
  date: string;
  element: DailyFortuneElement;
  headline: string;
  body: string;
  action: string;
  color: { name: string; hex: string };
  number: number;
};

const colors: Record<DailyFortuneElement, { name: string; hex: string }> = {
  목: { name: "새싹 초록", hex: "#4F7F58" },
  화: { name: "다홍", hex: "#A84842" },
  토: { name: "황토", hex: "#9A7041" },
  금: { name: "은빛 회색", hex: "#69727A" },
  수: { name: "물빛 파랑", hex: "#386D91" },
};

const messages: Record<DailyFortuneElement, readonly { headline: string; body: string; action: string }[]> = {
  목: [
    { headline: "작은 틈을 살펴보는 날", body: "새로운 일을 크게 벌이기보다, 자라게 하고 싶은 한 가지에 자리를 내어보세요.", action: "오늘 할 일 목록에서 가장 작은 첫 단계를 하나 적어보세요." },
    { headline: "방향을 가다듬는 날", body: "급하게 결론을 내리기보다, 지금 하려는 일이 어디로 이어지는지 한 번 더 살펴보면 좋아요.", action: "시작하기 전 목적을 한 문장으로 써보세요." },
  ],
  화: [
    { headline: "온기를 나누는 날", body: "말을 선명하게 전하되, 상대가 답할 여백도 남겨두면 대화가 편안해질 수 있어요.", action: "고마웠던 일을 한 사람에게 짧게 전해보세요." },
    { headline: "힘을 나누어 쓰는 날", body: "하고 싶은 일이 많아도 우선순위를 하나 고르면 오늘의 에너지가 덜 흩어집니다.", action: "가장 중요한 일 하나에 20분만 집중해보세요." },
  ],
  토: [
    { headline: "발밑을 단단히 보는 날", body: "새 계획보다 지금 가진 약속과 준비물을 정리하면 다음 움직임이 편해질 수 있어요.", action: "미뤄둔 작은 정리 한 가지를 마쳐보세요." },
    { headline: "천천히 기준을 세우는 날", body: "다른 사람의 속도보다 내 기준을 확인하면 선택이 더 또렷해질 수 있어요.", action: "오늘 꼭 지키고 싶은 기준 한 가지를 적어보세요." },
  ],
  금: [
    { headline: "선명하게 고르는 날", body: "여러 선택지를 모두 붙잡기보다, 지금은 덜 중요한 것을 내려놓는 판단이 도움이 될 수 있어요.", action: "오늘 하지 않을 일 한 가지를 정해보세요." },
    { headline: "말을 정돈하는 날", body: "핵심을 짧고 분명하게 전하면 서로의 기대를 맞추는 데 도움이 됩니다.", action: "보낼 메시지를 한 번 읽고 핵심 문장만 남겨보세요." },
  ],
  수: [
    { headline: "흐름을 읽는 날", body: "바로 답하기보다 상황을 조금 더 듣고 보면, 더 편안한 선택을 찾을 수 있어요.", action: "대화에서 질문 하나를 먼저 건네보세요." },
    { headline: "여유를 남기는 날", body: "일정 사이에 짧은 빈틈을 두면 생각과 감정을 정리할 시간이 생깁니다.", action: "다음 일정 전 10분의 여유를 남겨보세요." },
  ],
};

function seed(chart: SajuChart, date: string): number {
  return Array.from(`${date}|${chart.dayMaster.character}|${chart.pillars.map((pillar) => pillar.text).join("")}`)
    .reduce((total, character, index) => total + (character.codePointAt(0) || 0) * (index + 1), 0);
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayOrder(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

/**
 * 오늘의 추천 기운은 일간 하나만 고정해 쓰지 않는다.
 * 사주에서 상대적으로 적은 오행을 우선순위로 두고 한국 날짜의 순환을 더한다.
 */
export function dailyFortuneElement(chart: SajuChart, date: string): DailyFortuneElement {
  const dayMasterIndex = elements.indexOf(chart.dayMaster.element as DailyFortuneElement);
  const ranked = [...elements].sort((left, right) => {
    const countDifference = chart.elements[left] - chart.elements[right];
    if (countDifference) return countDifference;
    const leftDistance = (elements.indexOf(left) - dayMasterIndex + elements.length) % elements.length;
    const rightDistance = (elements.indexOf(right) - dayMasterIndex + elements.length) % elements.length;
    return leftDistance - rightDistance;
  });
  return ranked[dayOrder(date) % ranked.length];
}

export function dailyFortuneRecommendation(chart: SajuChart, date: string) {
  const element = dailyFortuneElement(chart, date);
  const chartWeight = elements.reduce((total, item, index) => total + chart.elements[item] * (index + 2), 0);
  return {
    element,
    color: colors[element],
    // 날짜는 매일 한 칸씩 움직이고, 같은 날에는 사주의 분포가 숫자를 구분합니다.
    number: (chartWeight + dayOrder(date) + elements.indexOf(element) * 3) % 9 + 1,
  };
}

export function createDailyFortune(chart: SajuChart, date: string): DailyFortune {
  if (!isDate(date)) throw new Error("오늘의 운세 날짜 형식이 올바르지 않습니다.");
  const recommendation = dailyFortuneRecommendation(chart, date);
  const element = recommendation.element;
  const entries = messages[element] || messages.토;
  const value = seed(chart, date);
  const message = entries[value % entries.length];
  return {
    scheme: "palace-door-v2",
    date,
    element,
    ...message,
    color: recommendation.color,
    number: recommendation.number,
  };
}

export function isDailyFortune(value: unknown): value is DailyFortune {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.scheme === "palace-door-v2" && isDate(item.date) && elements.includes(item.element as DailyFortuneElement)
    && ["headline", "body", "action"].every((key) => typeof item[key] === "string" && item[key].trim().length > 0)
    && typeof item.number === "number" && Number.isInteger(item.number) && item.number >= 1 && item.number <= 9
    && !!item.color && typeof item.color === "object" && !Array.isArray(item.color)
    && typeof (item.color as Record<string, unknown>).name === "string"
    && /^#[0-9a-f]{6}$/i.test(String((item.color as Record<string, unknown>).hex));
}
