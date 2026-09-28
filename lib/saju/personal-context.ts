export const personalSituations = [
  { value: "exploring", label: "방향을 찾는 중이에요" },
  { value: "deciding", label: "중요한 선택을 앞두고 있어요" },
  { value: "changing", label: "변화를 준비하고 있어요" },
  { value: "continuing", label: "꾸준히 이어가는 중이에요" },
  { value: "resting", label: "잠시 쉬며 균형을 찾고 있어요" },
] as const;

export const desiredDirections = [
  { value: "strengths", label: "내 강점을 이해하고 싶어요" },
  { value: "criteria", label: "선택 기준을 얻고 싶어요" },
  { value: "communication", label: "관계와 대화를 풀고 싶어요" },
  { value: "action", label: "바로 할 작은 행동을 찾고 싶어요" },
  { value: "balance", label: "무리하지 않는 균형을 찾고 싶어요" },
  { value: "patterns", label: "반복되는 내 모습을 알고 싶어요" },
  { value: "feelings", label: "지금의 마음을 정리하고 싶어요" },
  { value: "caution", label: "조심해서 살펴볼 점을 알고 싶어요" },
  { value: "outlook", label: "앞으로의 흐름을 가볍게 보고 싶어요" },
] as const;

export type PersonalSituation = (typeof personalSituations)[number]["value"];
export type DesiredDirection = (typeof desiredDirections)[number]["value"];

export type PersonalContext = {
  situation: PersonalSituation;
  direction: DesiredDirection;
};

export class PersonalContextError extends Error {}

export function parsePersonalContext(value: unknown, required = false): PersonalContext | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    if (!required && value === undefined) return undefined;
    throw new PersonalContextError("현재 상황과 원하는 방향을 다시 골라주세요.");
  }
  const raw = value as Record<string, unknown>;
  const hasSituation = raw.situation !== undefined;
  const hasDirection = raw.direction !== undefined;
  if (!hasSituation && !hasDirection && !required) return undefined;
  const situation = personalSituations.find((item) => item.value === raw.situation)?.value;
  const direction = desiredDirections.find((item) => item.value === raw.direction)?.value;
  if (!situation || !direction) throw new PersonalContextError("현재 상황과 원하는 방향을 다시 골라주세요.");
  return { situation, direction };
}

export function personalContextLabels(context: PersonalContext): { situation: string; direction: string } {
  return {
    situation: personalSituations.find((item) => item.value === context.situation)!.label,
    direction: desiredDirections.find((item) => item.value === context.direction)!.label,
  };
}
