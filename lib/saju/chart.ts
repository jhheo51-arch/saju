import lunar from "lunar-javascript";
import { isReadingTopic, type ReadingTopic } from "./topics";

const { Solar } = lunar;

export type SajuInput = {
  date: string;
  time: string;
  calendar: "solar";
  topic: "general" | ReadingTopic;
  question?: string;
  unknownTime?: boolean;
  approximateTime?: "dawn" | "morning" | "afternoon" | "evening";
};

export type PillarLabel = "년주" | "월주" | "일주" | "시주";

export type Pillar = {
  label: PillarLabel;
  text: string;
  korean: string;
  stem: string;
  branch: string;
  stemElement: string;
  branchElement: string;
};

export type SajuChart = {
  pillars: Pillar[];
  elements: Record<"목" | "화" | "토" | "금" | "수", number>;
  dayMaster: { character: string; korean: string; element: string };
  method: string;
  engine: string;
  elementMethod: string;
  timeBasis?: "exact" | "approximate" | "unknown";
  timeNote?: string;
};

export class InputError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

export function parseQuestion(value: unknown, required = false): string {
  if (value === undefined || value === null || value === "") {
    if (required) throw new InputError("궁금한 점을 입력해주세요.", "question");
    return "";
  }
  if (typeof value !== "string") throw new InputError("질문은 글자로 입력해주세요.", "question");
  const question = value.trim();
  if (required && !question) throw new InputError("궁금한 점을 입력해주세요.", "question");
  if (question.length > 200) throw new InputError("질문은 200자까지 입력할 수 있어요.", "question");
  return question;
}

const stems = [..."甲乙丙丁戊己庚辛壬癸"];
const branches = [..."子丑寅卯辰巳午未申酉戌亥"];
const stemKo = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const branchKo = [
  "자",
  "축",
  "인",
  "묘",
  "진",
  "사",
  "오",
  "미",
  "신",
  "유",
  "술",
  "해",
];
const stemElement = [
  "목",
  "목",
  "화",
  "화",
  "토",
  "토",
  "금",
  "금",
  "수",
  "수",
];
const branchElement = [
  "수",
  "토",
  "목",
  "목",
  "토",
  "화",
  "화",
  "토",
  "금",
  "금",
  "토",
  "수",
];

export const CALCULATION =
  "양력 · 한국 표준시(UTC+9) · 23시 일자 변경 · 진태양시 보정 없음";

export function validateInput(raw: SajuInput): SajuInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new InputError("입력 내용을 확인해주세요.");
  if (raw.calendar !== "solar")
    throw new InputError(
      "이번 버전은 양력만 지원합니다. 양력 날짜를 입력해주세요.",
      "calendar",
    );

  const date = raw.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new InputError("생년월일을 입력해주세요.", "date");

  const [year, month, day] = date.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  )
    throw new InputError("실제로 존재하는 날짜를 입력해주세요.", "date");
  if (year < 1990)
    throw new InputError("1990년 1월 1일 이후의 날짜를 지원합니다.", "date");
  const approximateTime = raw.approximateTime;
  if (approximateTime !== undefined && !["dawn", "morning", "afternoon", "evening"].includes(approximateTime))
    throw new InputError("대략적인 출생 시간대를 다시 골라주세요.", "approximateTime");
  const limitedTime = raw.unknownTime === true || approximateTime !== undefined;
  if (!limitedTime && (
    typeof raw.time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time)
  ))
    throw new InputError("태어난 시각을 정확히 입력해주세요.", "time");
  if (raw.topic !== "general" && !isReadingTopic(raw.topic))
    throw new InputError("풀이 주제를 선택해주세요.", "topic");
  const question = parseQuestion(raw.question);

  return {
    date,
    time: limitedTime ? "" : raw.time,
    calendar: "solar",
    unknownTime: raw.unknownTime === true,
    ...(approximateTime ? { approximateTime } : {}),
    topic: raw.topic,
    question,
  };
}

function pillar(label: PillarLabel, text: string): Pillar {
  const [stem, branch] = [...text];
  return {
    label,
    text,
    korean: stemKo[stems.indexOf(stem)] + branchKo[branches.indexOf(branch)],
    stem,
    branch,
    stemElement: stemElement[stems.indexOf(stem)],
    branchElement: branchElement[branches.indexOf(branch)],
  };
}

export function calculate(raw: SajuInput): SajuChart {
  const input = validateInput(raw);
  const [year, month, day] = input.date.split("-").map(Number);
  const limitedTime = input.unknownTime === true || input.approximateTime !== undefined;
  const [hour, minute] = limitedTime ? [12, 0] : input.time.split(":").map(Number);

  const chinaTime = new Date(
    Date.UTC(year, month - 1, day, hour - 1, minute),
  );
  const terms = Solar.fromYmdHms(
    chinaTime.getUTCFullYear(),
    chinaTime.getUTCMonth() + 1,
    chinaTime.getUTCDate(),
    chinaTime.getUTCHours(),
    minute,
    0,
  )
    .getLunar()
    .getEightChar();
  const local = Solar.fromYmdHms(year, month, day, hour, minute, 0)
    .getLunar()
    .getEightChar();
  local.setSect(1);

  const pillars: Pillar[] = [
    pillar("년주", terms.getYear()),
    pillar("월주", terms.getMonth()),
    pillar("일주", local.getDay()),
  ];
  if (!limitedTime) pillars.push(pillar("시주", local.getTime()));
  const elements: SajuChart["elements"] = {
    목: 0,
    화: 0,
    토: 0,
    금: 0,
    수: 0,
  };
  pillars.forEach((item) => {
    elements[item.stemElement as keyof typeof elements]++;
    elements[item.branchElement as keyof typeof elements]++;
  });

  return {
    pillars,
    elements,
    dayMaster: {
      character: pillars[2].stem,
      korean: stemKo[stems.indexOf(pillars[2].stem)],
      element: pillars[2].stemElement,
    },
    method: CALCULATION,
    engine: "lunar-javascript@1.7.7",
    elementMethod:
      limitedTime
        ? "출생시간을 제외한 년주·월주·일주의 천간과 지지 6자를 센 값입니다. 시주·지장간·계절 가중치는 반영하지 않습니다."
        : "천간과 지지의 대표 오행 8자를 센 값입니다. 지장간과 계절 가중치를 반영한 강약 판단은 아닙니다.",
    timeBasis: input.approximateTime ? "approximate" : input.unknownTime ? "unknown" : "exact",
    timeNote: input.approximateTime
      ? "대략적인 시간대만 알아 시주는 제외했습니다. 출생시간을 확인하면 세부 결과가 달라질 수 있어요."
      : input.unknownTime
        ? "출생시간을 몰라 시주는 제외했습니다. 특히 밤 11시 전후 출생이라면 일주도 달라질 수 있어요."
        : "입력한 출생시간으로 시주까지 계산했습니다.",
  };
}
