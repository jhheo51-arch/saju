import type { PillarLabel, SajuChart } from "./chart";

type NobleBranch = {
  character: string;
  korean: string;
};

export type NobleHelperAnalysis = {
  targetLabel: string;
  matches: Array<{ label: PillarLabel; branch: NobleBranch }>;
  calculation: string;
  courtTitle: string;
  courtStory: string;
  meetingSigns: readonly string[];
  openDoor: string;
};

const nobleBranchesByStem: Record<string, readonly NobleBranch[]> = {
  甲: [{ character: "丑", korean: "축" }, { character: "未", korean: "미" }],
  戊: [{ character: "丑", korean: "축" }, { character: "未", korean: "미" }],
  庚: [{ character: "丑", korean: "축" }, { character: "未", korean: "미" }],
  乙: [{ character: "子", korean: "자" }, { character: "申", korean: "신" }],
  己: [{ character: "子", korean: "자" }, { character: "申", korean: "신" }],
  丙: [{ character: "亥", korean: "해" }, { character: "酉", korean: "유" }],
  丁: [{ character: "亥", korean: "해" }, { character: "酉", korean: "유" }],
  辛: [{ character: "寅", korean: "인" }, { character: "午", korean: "오" }],
  壬: [{ character: "卯", korean: "묘" }, { character: "巳", korean: "사" }],
  癸: [{ character: "卯", korean: "묘" }, { character: "巳", korean: "사" }],
};

const courtStories: Record<string, Pick<NobleHelperAnalysis, "courtTitle" | "courtStory" | "meetingSigns" | "openDoor">> = {
  목: {
    courtTitle: "성장을 오래 지켜보는 스승형 귀인",
    courtStory: "궁궐의 오래된 나무를 돌보듯 서두르지 않고 가능성을 키워주는 인연이에요. 답을 대신 정하기보다 내가 스스로 자라도록 기다려주는 모습에 가깝습니다.",
    meetingSigns: ["꾸준히 안부를 묻고 지난 이야기를 기억해줘요.", "당장의 성과보다 다음에 자랄 가능성을 봐줘요."],
    openDoor: "혼자 준비한 생각을 완벽하게 만들기 전에, 오래 지켜본 선배나 동료에게 초안을 보여주고 조언을 구해보세요.",
  },
  화: {
    courtTitle: "가능성을 알아보고 앞에 세워주는 후원자형 귀인",
    courtStory: "어두운 전각에 등불을 밝히듯 내가 가진 장점을 먼저 알아봐 주는 인연이에요. 따뜻한 격려와 소개로 한 걸음 나설 용기를 보태는 모습에 가깝습니다.",
    meetingSigns: ["사람들 앞에서 내 장점을 구체적으로 말해줘요.", "새로운 자리나 사람을 자연스럽게 소개해줘요."],
    openDoor: "도전해 보고 싶은 일을 한 문장으로 정리해 가까운 사람에게 알리고, 작은 소개나 피드백부터 부탁해보세요.",
  },
  토: {
    courtTitle: "말보다 손을 먼저 보태는 버팀목형 귀인",
    courtStory: "궁궐의 주춧돌처럼 눈에 띄지 않아도 필요한 자리를 단단히 받쳐주는 인연이에요. 거창한 약속보다 실제로 함께 정리하고 챙기는 모습에 가깝습니다.",
    meetingSigns: ["바쁜 순간에 해야 할 일을 조용히 나눠 들어줘요.", "약속과 순서를 지키며 오래 곁을 지켜줘요."],
    openDoor: "막연히 힘들다고 참기보다 지금 필요한 도움 한 가지를 구체적으로 말하고, 받은 도움에는 행동으로 고마움을 돌려주세요.",
  },
  금: {
    courtTitle: "기준을 바로 세워주는 조언자형 귀인",
    courtStory: "어지러운 문서를 정리하는 사관처럼 복잡한 상황에서 핵심을 짚어주는 인연이에요. 체면을 상하게 하기보다 따로 조용히, 그러나 솔직하게 말해주는 모습에 가깝습니다.",
    meetingSigns: ["듣기 좋은 말보다 지금 필요한 기준을 알려줘요.", "공개된 자리보다 따로 불러 조심스럽게 조언해줘요."],
    openDoor: "결정을 혼자 끝내기 전에 믿을 만한 사람 한 명에게 내가 놓친 점을 솔직하게 물어보고, 답을 끝까지 들어보세요.",
  },
  수: {
    courtTitle: "사람과 소식을 잇는 연결자형 귀인",
    courtStory: "궁 안팎의 소식을 잇는 승지처럼 필요한 정보와 사람을 자연스럽게 연결해 주는 인연이에요. 막힌 길을 대신 뚫기보다 새로운 선택지를 보여주는 모습에 가깝습니다.",
    meetingSigns: ["내 상황에 맞는 사람이나 정보를 떠올려 연결해줘요.", "한 가지 답을 강요하지 않고 다른 길을 함께 찾아줘요."],
    openDoor: "찾고 있는 정보와 이유를 짧게 정리해 주변에 알리고, 소개받은 인연에는 먼저 예의를 갖춰 연락해보세요.",
  },
};

export function nobleHelperForChart(chart: SajuChart): NobleHelperAnalysis | null {
  const targets = nobleBranchesByStem[chart?.dayMaster?.character];
  const story = courtStories[chart?.dayMaster?.element];
  if (!targets || !story || chart.pillars.length !== 4) return null;

  const matches = chart.pillars.flatMap((pillar) => {
    const branch = targets.find((target) => target.character === pillar.branch);
    return branch ? [{ label: pillar.label, branch }] : [];
  });
  const targetLabel = targets.map(({ korean, character }) => `${korean}(${character})`).join("·");
  const calculation = matches.length
    ? `전통 계산에서 ${chart.dayMaster.korean}(${chart.dayMaster.character}) 일간의 천을귀인 글자는 ${targetLabel}예요. 내 사주에서는 ${matches.map(({ label, branch }) => `${label}의 ${branch.korean}(${branch.character})`).join(", ")}에서 이 글자를 확인할 수 있어요.`
    : `전통 계산에서 ${chart.dayMaster.korean}(${chart.dayMaster.character}) 일간의 천을귀인 글자는 ${targetLabel}예요. 내 사주의 네 아랫글자에는 직접 보이지 않지만, 이 한 가지 표시만으로 도움을 주고받을 인연의 유무를 정하지는 않아요.`;

  return { targetLabel, matches, calculation, ...story };
}
