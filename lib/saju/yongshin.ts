import type { SajuChart } from "./chart";

export const fiveElements = ["목", "화", "토", "금", "수"] as const;
export type FiveElement = (typeof fiveElements)[number];

const stemElements: Record<string, FiveElement> = {
  甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토",
  己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수",
};

const hiddenStems: Record<string, readonly string[]> = {
  子: ["癸"], 丑: ["己", "癸", "辛"], 寅: ["甲", "丙", "戊"], 卯: ["乙"],
  辰: ["戊", "乙", "癸"], 巳: ["丙", "戊", "庚"], 午: ["丁", "己"], 未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"], 酉: ["辛"], 戌: ["戊", "辛", "丁"], 亥: ["壬", "甲"],
};

const generation: Record<FiveElement, FiveElement> = {
  목: "화", 화: "토", 토: "금", 금: "수", 수: "목",
};
const control: Record<FiveElement, FiveElement> = {
  목: "토", 화: "금", 토: "수", 금: "목", 수: "화",
};
const elementHanja: Record<FiveElement, string> = {
  목: "木", 화: "火", 토: "土", 금: "金", 수: "水",
};

const hiddenWeights: Record<number, readonly number[]> = {
  1: [1],
  2: [0.7, 0.3],
  3: [0.6, 0.3, 0.1],
};

export type YongshinRole = {
  label: "용신" | "희신" | "기신";
  element: FiveElement;
  hanja: string;
  summary: string;
};

export type YongshinBalance = {
  method: "간이 억부용신";
  tendency: "신강 쪽" | "신약 쪽";
  supportPercent: number;
  weightedElements: Record<FiveElement, number>;
  roles: [YongshinRole, YongshinRole, YongshinRole];
  basis: string;
};

function previousInGeneration(element: FiveElement): FiveElement {
  const found = fiveElements.find((candidate) => generation[candidate] === element);
  if (!found) throw new Error("오행의 생 관계를 확인할 수 없습니다.");
  return found;
}

function previousInControl(element: FiveElement): FiveElement {
  const found = fiveElements.find((candidate) => control[candidate] === element);
  if (!found) throw new Error("오행의 극 관계를 확인할 수 없습니다.");
  return found;
}

function role(label: YongshinRole["label"], element: FiveElement, summary: string): YongshinRole {
  return { label, element, hanja: elementHanja[element], summary };
}

export function yongshinForChart(chart: SajuChart): YongshinBalance {
  const dayMaster = stemElements[chart.dayMaster.character];
  if (!dayMaster) throw new Error("일간의 오행을 확인할 수 없습니다.");

  const weightedElements = Object.fromEntries(fiveElements.map((element) => [element, 0])) as Record<FiveElement, number>;

  chart.pillars.forEach((pillar, pillarIndex) => {
    const visibleStemElement = stemElements[pillar.stem];
    if (!visibleStemElement) throw new Error("천간의 오행을 확인할 수 없습니다.");
    weightedElements[visibleStemElement] += 1;

    const stems = hiddenStems[pillar.branch];
    const weights = stems && hiddenWeights[stems.length];
    if (!stems || !weights) throw new Error("지장간을 확인할 수 없습니다.");
    const branchMultiplier = pillarIndex === 1 ? 2 : 1;
    stems.forEach((stem, index) => {
      weightedElements[stemElements[stem]] += weights[index] * branchMultiplier;
    });
  });

  const resource = previousInGeneration(dayMaster);
  const controller = previousInControl(dayMaster);
  const support = weightedElements[dayMaster] + weightedElements[resource];
  const total = Object.values(weightedElements).reduce((sum, value) => sum + value, 0);
  const supportPercent = Math.round((support / total) * 100);
  const strong = supportPercent >= 50;

  if (strong) {
    const helpful = control[dayMaster];
    return {
      method: "간이 억부용신",
      tendency: "신강 쪽",
      supportPercent,
      weightedElements,
      roles: [
        role("용신", controller, `${dayMaster} 기운을 조절하는 중심 역할`),
        role("희신", helpful, `${controller} 기운이 이어지도록 돕는 보조 역할`),
        role("기신", resource, `${dayMaster} 기운을 더 보태는 쪽이라 주의해서 보는 역할`),
      ],
      basis: `일간 ${chart.dayMaster.korean}${dayMaster}, 그리고 이를 돕는 ${resource}의 가중 비중이 ${supportPercent}%라 신강 쪽으로 분류했어요.`,
    };
  }

  return {
    method: "간이 억부용신",
    tendency: "신약 쪽",
    supportPercent,
    weightedElements,
    roles: [
      role("용신", resource, `${dayMaster} 기운을 보태는 중심 역할`),
      role("희신", dayMaster, `같은 ${dayMaster} 기운으로 힘을 나누는 보조 역할`),
      role("기신", controller, `${dayMaster} 기운을 누르는 쪽이라 주의해서 보는 역할`),
    ],
    basis: `일간 ${chart.dayMaster.korean}${dayMaster}, 그리고 이를 돕는 ${resource}의 가중 비중이 ${supportPercent}%라 신약 쪽으로 분류했어요.`,
  };
}
