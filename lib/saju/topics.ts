export const readingTopics = [
  { value: "relationship", label: "연애", detail: "마음 표현과 대화", focus: "연애에서는 마음을 표현하고 상대와 대화하는 방식을 다루세요." },
  { value: "career", label: "일", detail: "협업과 일하는 방식", focus: "일에서는 동료와 협업하고 일을 정리하는 방식을 다루세요." },
  { value: "money", label: "재물", detail: "소비와 계획 습관", focus: "재물에서는 소비를 돌아보고 계획을 세우는 습관을 다루세요. 투자나 수익을 보장하지 마세요." },
  { value: "friends", label: "인간관계", detail: "사람들과의 거리·대화", focus: "인간관계에서는 주변 사람과 적당한 거리를 찾고 대화를 이어가는 방식을 다루세요." },
  { value: "family", label: "가족", detail: "가족과의 소통", focus: "가족에서는 서로 다른 생각을 듣고 편안하게 소통하는 방식을 다루세요." },
  { value: "study", label: "공부", detail: "배우고 정리하는 방식", focus: "공부에서는 새 내용을 배우고 복습하며 정리하는 습관을 다루세요. 성적을 예언하지 마세요." },
  { value: "path", label: "진로", detail: "관심 분야 탐색", focus: "진로에서는 관심 분야를 탐색하고 작은 경험을 쌓는 방식을 다루세요. 취업 시기나 합격을 예언하지 마세요." },
  { value: "hobby", label: "취미", detail: "즐거움과 꾸준함", focus: "취미에서는 즐거움을 발견하고 부담 없이 꾸준히 해보는 방식을 다루세요." },
  { value: "health", label: "건강", detail: "휴식과 생활 리듬", focus: "건강에서는 휴식과 생활 리듬을 돌아보는 가벼운 자기돌봄만 다루세요. 사주로 질병이나 건강 상태를 예측·진단하지 말고 치료 효과나 의료 조언을 말하지 마세요." },
] as const;

export type ReadingTopic = (typeof readingTopics)[number]["value"] | "self";

export function isReadingTopic(value: unknown): value is ReadingTopic {
  return value === "self" || readingTopics.some((topic) => topic.value === value);
}
