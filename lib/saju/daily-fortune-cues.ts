import type { SajuChart } from "./chart";
import { dailyFortuneRecommendation } from "./daily-fortune";

export function dailyFortuneCues(chart: SajuChart, date: string) {
  const { color, number } = dailyFortuneRecommendation(chart, date);
  return { color, number };
}
