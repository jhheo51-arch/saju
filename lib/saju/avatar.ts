import type { SajuChart } from "./chart";

export type AvatarStyle = "original" | "male" | "female";

export type AvatarProfile = {
  element: keyof SajuChart["elements"];
  name: string;
  image: string;
  relations: {
    nurturesMe: ElementRelation;
    iNurture: ElementRelation;
    balancesMe: ElementRelation;
  };
};

export type ElementRelation = {
  element: keyof SajuChart["elements"];
  description: string;
};

export type PalaceStory = {
  role: string;
  duty: string;
  teamwork: string;
};

const palaceRoles: Record<AvatarProfile["element"], readonly string[]> = {
  목: ["왕세자·왕세자빈", "정사를 의논하는 정승·판서", "실록을 적는 사관", "왕실 의복을 맡은 수방 나인", "왕실을 돌보는 어의"],
  화: ["궁궐의 왕·왕비", "왕의 뜻을 전하는 승지", "임금 곁을 지키는 내금위", "음식을 맡은 소주방 나인", "궁궐 살림을 돌보는 내시"],
  토: ["궁궐의 어른 대비", "궁녀 조직을 이끄는 상궁", "침전 주변을 지키는 별군직", "왕실을 돌보는 어의", "궁궐 곳간을 돌보는 내시"],
  금: ["정사를 이끄는 정승·판서", "임금 곁을 지키는 겸사복·내금위", "회의를 기록하는 사관", "바느질을 맡은 침방 나인", "왕실 여성을 돌보는 의녀"],
  수: ["궁궐의 후궁", "왕명 출납을 맡은 승지", "왕의 하루를 적는 사관", "왕실 여성을 돌보는 의녀", "궁궐 안팎을 잇는 내시"],
};

const styledAvatarImages: Record<"male" | "female", Record<AvatarProfile["element"], string>> = {
  male: {
    목: "/avatars/wood-palace-male-v01.png",
    화: "/avatars/fire-palace-v03.png",
    토: "/avatars/earth-palace-male-v01.png",
    금: "/avatars/metal-palace-male-v01.png",
    수: "/avatars/water-palace-male-v01.png",
  },
  female: {
    목: "/avatars/wood-palace-v03.png",
    화: "/avatars/fire-palace-female-v01.png",
    토: "/avatars/earth-palace-v03.png",
    금: "/avatars/metal-palace-v03.png",
    수: "/avatars/water-palace-v03.png",
  },
};

const dutyImages: Record<AvatarProfile["element"], string> = {
  목: "새로운 생각을 키우고 사람들의 이야기를 이어",
  화: "따뜻한 기운으로 자리를 밝히고 움직임을 북돋아",
  토: "흔들리는 일을 차분히 받치고 순서를 세워",
  금: "복잡한 일을 또렷하게 가르고 기준을 다듬어",
  수: "사람과 소식이 막히지 않도록 유연하게 이어",
};

const avatars: Record<AvatarProfile["element"], AvatarProfile> = {
  목: {
    element: "목",
    name: "솔빛 궁인",
    image: "/avatars/wood-palace-v03.png",
    relations: {
      nurturesMe: { element: "수", description: "물은 나무가 자랄 바탕을 만들어줘요." },
      iNurture: { element: "화", description: "나무는 불이 오래 타도록 힘을 보태요." },
      balancesMe: { element: "금", description: "나무 기운이 넘칠 때 금의 단단함이 가지를 정돈해요." },
    },
  },
  화: {
    element: "화",
    name: "불빛 궁인",
    image: "/avatars/fire-palace-v03.png",
    relations: {
      nurturesMe: { element: "목", description: "나무는 불이 피어날 힘을 보태요." },
      iNurture: { element: "토", description: "불이 지나간 자리는 흙의 바탕이 돼요." },
      balancesMe: { element: "수", description: "불 기운이 넘칠 때 물의 차분함이 열기를 식혀줘요." },
    },
  },
  토: {
    element: "토",
    name: "산담 궁인",
    image: "/avatars/earth-palace-v03.png",
    relations: {
      nurturesMe: { element: "화", description: "불의 온기는 흙을 단단하게 만들어요." },
      iNurture: { element: "금", description: "흙 속에서는 단단한 금속이 자라요." },
      balancesMe: { element: "목", description: "흙 기운이 넘칠 때 나무의 뿌리가 길을 내줘요." },
    },
  },
  금: {
    element: "금",
    name: "은별 궁인",
    image: "/avatars/metal-palace-v03.png",
    relations: {
      nurturesMe: { element: "토", description: "흙은 금속이 생겨날 자리를 품어요." },
      iNurture: { element: "수", description: "금속 표면에는 맑은 물방울이 맺혀요." },
      balancesMe: { element: "화", description: "금 기운이 넘칠 때 불의 온기가 단단함을 부드럽게 다듬어요." },
    },
  },
  수: {
    element: "수",
    name: "물결 궁인",
    image: "/avatars/water-palace-v03.png",
    relations: {
      nurturesMe: { element: "금", description: "금속의 맑은 기운은 물의 흐름을 도와요." },
      iNurture: { element: "목", description: "물은 나무와 새싹이 자라게 해요." },
      balancesMe: { element: "토", description: "물 기운이 넘칠 때 흙의 둑이 흐름을 잡아줘요." },
    },
  },
};

export function avatarForChart(chart: SajuChart, style: AvatarStyle = "original"): AvatarProfile | null {
  const element = chart?.dayMaster?.element;
  if (!Object.hasOwn(avatars, element)) return null;
  const avatar = avatars[element as AvatarProfile["element"]];
  return style === "original" ? avatar : { ...avatar, image: styledAvatarImages[style][avatar.element] };
}

export function palaceStoryForChart(chart: SajuChart): PalaceStory | null {
  const avatar = avatarForChart(chart);
  if (!avatar || chart.pillars.length !== 4) return null;
  const elements = ["목", "화", "토", "금", "수"] as const;
  const monthElement = chart.pillars[1].branchElement;
  const byMostVisible = [...elements].sort((a, b) =>
    chart.elements[b] - chart.elements[a] || Number(b === monthElement) - Number(a === monthElement));
  const byLeastVisible = [...elements].sort((a, b) =>
    chart.elements[a] - chart.elements[b] || Number(a === avatar.element) - Number(b === avatar.element));
  const strongest = byMostVisible[0];
  const leastVisible = byLeastVisible[0];
  const role = palaceRoles[avatar.element][elements.indexOf(strongest)];
  const month = chart.pillars[1]?.korean;
  return {
    role,
    duty: `일간 ${chart.dayMaster.korean}${avatar.element}에, 여덟 글자 중 ${strongest}가 ${chart.elements[strongest]}개로 가장 눈에 띄어요. 월주 ${month}의 분위기도 더해 ${dutyImages[strongest]} 궁궐의 하루를 도와요.`,
    teamwork: `${leastVisible} 기운은 여덟 글자 중 ${chart.elements[leastVisible]}개 보여요. 이야기 속에서는 ${leastVisible} 기운의 동료와 서로 다른 장점을 나눠요. 실제로 특정 사람을 만나야 한다는 뜻은 아니에요.`,
  };
}
