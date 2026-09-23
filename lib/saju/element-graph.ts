import type { SajuChart } from "./chart";

const elementGraphRows = [
  { key: "목", meaning: "나무", className: "wood" },
  { key: "화", meaning: "불", className: "fire" },
  { key: "토", meaning: "흙", className: "earth" },
  { key: "금", meaning: "쇠", className: "metal" },
  { key: "수", meaning: "물", className: "water" },
] as const;

export function elementGraphForChart(elements: SajuChart["elements"]) {
  return {
    total: elementGraphRows.reduce((sum, row) => sum + elements[row.key], 0),
    rows: elementGraphRows.map((row) => ({
      ...row,
      count: elements[row.key],
      slots: Array.from({ length: 8 }, (_, index) => index < elements[row.key]),
    })),
  };
}
