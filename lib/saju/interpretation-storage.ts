import type { SajuChart } from "./chart";
import { isReadingTopic, parseInterpretationResponse, type Interpretation, type ReadingTopic } from "./interpretation";

export const LATEST_RESULT_KEY = "saju.latest-interpretation.v1";

export type SavedInterpretation = {
  version: 1;
  createdAt: string;
  chart: SajuChart;
  topic: ReadingTopic;
  reading: Interpretation;
};

export function saveLatestResult(storage: Storage, result: SavedInterpretation): void {
  storage.setItem(LATEST_RESULT_KEY, JSON.stringify(result));
}

export function clearLatestResult(storage: Storage): void {
  storage.removeItem(LATEST_RESULT_KEY);
}

export function loadLatestResult(storage: Storage): SavedInterpretation | null {
  const raw = storage.getItem(LATEST_RESULT_KEY);
  if (!raw) return null;
  try {
    return parseSavedInterpretation(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function parseSavedInterpretation(value: unknown): SavedInterpretation | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const saved = value as Partial<SavedInterpretation>;
    if (saved.version !== 1 || typeof saved.createdAt !== "string" || !Number.isFinite(Date.parse(saved.createdAt)) ||
      !isReadingTopic(saved.topic) || !saved.chart || typeof saved.chart !== "object" ||
      !Array.isArray(saved.chart.pillars) || saved.chart.pillars.length !== 4 ||
      !saved.chart.pillars.every((pillar) => typeof pillar?.label === "string" && typeof pillar?.korean === "string" && typeof pillar?.stem === "string" && typeof pillar?.branch === "string") ||
      typeof saved.chart.method !== "string" || !saved.chart.dayMaster || !saved.chart.elements || !saved.reading) return null;
    const reading = parseInterpretationResponse(saved.reading, saved.topic, saved.reading.today?.date);
    return { version: 1, createdAt: saved.createdAt, chart: saved.chart, topic: saved.topic, reading };
  } catch {
    return null;
  }
}
