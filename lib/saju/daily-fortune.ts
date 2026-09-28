import type { SajuChart } from "./chart";

type Element = "목" | "화" | "토" | "금" | "수";

export type DailyFortune = {
  date: string;
  headline: string;
  body: string;
  action: string;
  color: { name: string; hex: string };
  number: number;
};

const colors: Record<Element, { name: string; hex: string }> = {
  목: { name: "새싹 초록", hex: "#4F7F58" },
  화: { name: "다홍", hex: "#A84842" },
  토: { name: "황토", hex: "#9A7041" },
  금: { name: "은빛 회색", hex: "#69727A" },
  수: { name: "물빛 파랑", hex: "#386D91" },
};

const messages: Record<Element, readonly { headline: string; body: string; action: string }[]> = {
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

export function createDailyFortune(chart: SajuChart, date: string): DailyFortune {
  if (!isDate(date)) throw new Error("오늘의 운세 날짜 형식이 올바르지 않습니다.");
  const element = chart.dayMaster.element as Element;
  const entries = messages[element] || messages.토;
  const value = seed(chart, date);
  const message = entries[value % entries.length];
  return {
    date,
    ...message,
    color: colors[element] || colors.토,
    number: value % 9 + 1,
  };
}

export function isDailyFortune(value: unknown): value is DailyFortune {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return isDate(item.date) && ["headline", "body", "action"].every((key) => typeof item[key] === "string" && item[key].trim().length > 0)
    && typeof item.number === "number" && Number.isInteger(item.number) && item.number >= 1 && item.number <= 9
    && !!item.color && typeof item.color === "object" && !Array.isArray(item.color)
    && typeof (item.color as Record<string, unknown>).name === "string"
    && /^#[0-9a-f]{6}$/i.test(String((item.color as Record<string, unknown>).hex));
}
