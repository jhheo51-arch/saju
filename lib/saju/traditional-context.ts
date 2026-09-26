import type { SajuChart } from "./chart";

const yangStems = new Set([..."甲丙戊庚壬"]);
const yinStems = new Set([..."乙丁己辛癸"]);
const yangBranches = new Set([..."子寅辰午申戌"]);
const yinBranches = new Set([..."丑卯巳未酉亥"]);

const seasons = {
  spring: { name: "봄", branches: "寅卯辰" },
  summer: { name: "여름", branches: "巳午未" },
  autumn: { name: "가을", branches: "申酉戌" },
  winter: { name: "겨울", branches: "亥子丑" },
} as const;

export type TraditionalContext = {
  yinYang: { yin: number; yang: number };
  season: { name: "봄" | "여름" | "가을" | "겨울"; monthBranch: string; monthLabel: string };
};

export function traditionalContextForChart(chart: SajuChart): TraditionalContext {
  let yin = 0;
  let yang = 0;
  for (const pillar of chart.pillars) {
    if (yangStems.has(pillar.stem)) yang++;
    else if (yinStems.has(pillar.stem)) yin++;
    else throw new Error("천간의 음양을 확인할 수 없습니다.");

    if (yangBranches.has(pillar.branch)) yang++;
    else if (yinBranches.has(pillar.branch)) yin++;
    else throw new Error("지지의 음양을 확인할 수 없습니다.");
  }
  if (yin + yang !== 8) throw new Error("여덟 글자의 음양 합계가 올바르지 않습니다.");

  const monthPillar = chart.pillars[1];
  const season = Object.values(seasons).find((item) => item.branches.includes(monthPillar.branch));
  if (!season) throw new Error("월지의 계절 구간을 확인할 수 없습니다.");

  return {
    yinYang: { yin, yang },
    season: {
      name: season.name,
      monthBranch: monthPillar.branch,
      monthLabel: `${monthPillar.korean[1]}월`,
    },
  };
}

export function traditionalContextFacts(context: TraditionalContext): { yinYang: string; season: string } {
  return {
    yinYang: `음 ${context.yinYang.yin}·양 ${context.yinYang.yang}`,
    season: `${context.season.name}(${context.season.monthLabel})`,
  };
}
