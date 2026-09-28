import type { SajuChart } from "./chart";

type ElementName = "목" | "화" | "토" | "금" | "수";

const colors: Record<ElementName, readonly { name: string; hex: string }[]> = {
  목: [{ name: "새싹 초록", hex: "#6E9F72" }, { name: "청록", hex: "#4F8F83" }],
  화: [{ name: "다홍", hex: "#D86455" }, { name: "살구", hex: "#E89A73" }],
  토: [{ name: "황토", hex: "#B88657" }, { name: "모래빛", hex: "#C7A66A" }],
  금: [{ name: "은빛 회색", hex: "#89929B" }, { name: "아이보리", hex: "#D8CDB5" }],
  수: [{ name: "남색", hex: "#4D638A" }, { name: "물빛 파랑", hex: "#5B8FA8" }],
};

function cueSeed(chart: SajuChart, date: string) {
  return Array.from(`${date}|${chart.dayMaster.character}|${chart.pillars[1].text}`)
    .reduce((total, character, index) => total + (character.codePointAt(0) || 0) * (index + 1), 0);
}

export function dailyFortuneCues(chart: SajuChart, date: string) {
  const seed = cueSeed(chart, date);
  const element = chart.dayMaster.element as ElementName;
  const palette = colors[element] || colors.토;

  return {
    color: palette[seed % palette.length],
    number: seed % 9 + 1,
  };
}
