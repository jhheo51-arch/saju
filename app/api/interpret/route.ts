import { NextResponse } from "next/server";
import { calculate, InputError, type SajuInput } from "../../../lib/saju/chart";
import { assertChartGrounding, buildInterpretationPayload, isReadingTopic, koreaDate, parseInterpretationResponse } from "../../../lib/saju/interpretation";
import { readingTopics } from "../../../lib/saju/topics";

export const runtime = "nodejs";

const model = "gemini-3.5-flash-lite";
const section = {
  type: "object",
  properties: { headline: { type: "string" }, body: { type: "string" } },
  required: ["headline", "body"],
};
const responseSchema = {
  type: "object",
  properties: {
    personality: section,
    topic: { type: "object", properties: { kind: { type: "string", enum: readingTopics.map((topic) => topic.value) }, headline: { type: "string" }, body: { type: "string" } }, required: ["kind", "headline", "body"] },
    today: { type: "object", properties: { date: { type: "string" }, headline: { type: "string" }, body: { type: "string" } }, required: ["date", "headline", "body"] },
    weekly: { type: "object", properties: { startDate: { type: "string" }, endDate: { type: "string" }, headline: { type: "string" }, body: { type: "string" } }, required: ["startDate", "endDate", "headline", "body"] },
  },
  required: ["personality", "topic", "today", "weekly"],
};

function modelText(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null || !("status" in raw) || raw.status !== "completed" || !("steps" in raw) || !Array.isArray(raw.steps)) return null;
  const output = raw.steps.filter((step: unknown) => typeof step === "object" && step !== null && "type" in step && step.type === "model_output").at(-1);
  if (!output || typeof output !== "object" || !("content" in output) || !Array.isArray(output.content)) return null;
  const texts = output.content.filter((part: unknown) => typeof part === "object" && part !== null && "type" in part && part.type === "text" && "text" in part && typeof part.text === "string").map((part: { text: string }) => part.text);
  return texts.length ? texts.join("") : null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return NextResponse.json({ error: "입력 내용이 너무 깁니다." }, { status: 413 });
  }

  let input: SajuInput;
  let chart;
  try {
    const body = await request.text();
    if (body.length > 4096) return NextResponse.json({ error: "입력 내용이 너무 깁니다." }, { status: 413 });
    input = JSON.parse(body) as SajuInput;
    chart = calculate(input);
    if (!isReadingTopic(input.topic) || !readingTopics.some((topic) => topic.value === input.topic)) {
      throw new InputError("관심 있는 주제를 다시 골라주세요.");
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof InputError ? error.message : "입력 내용을 확인해주세요." }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "해석 기능 설정이 필요합니다. API 키를 확인해주세요." }, { status: 503 });

  const date = koreaDate();
  const payload = buildInterpretationPayload(input, chart, date);
  const selectedTopic = readingTopics.find((topic) => topic.value === input.topic)!;
  const dayMasterName = `${chart.dayMaster.korean}${chart.dayMaster.element}`;
  const monthPillarName = chart.pillars[1].korean;
  const monthPillarElements = `${chart.pillars[1].stemElement}·${chart.pillars[1].branchElement}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response: Response;
  try {
    response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        model,
        store: false,
        input: JSON.stringify(payload),
        system_instruction: [
          "당신은 사주 계산기가 아니라 사주 계산 결과를 쉬운 한국어로 설명하는 글쓴이입니다.",
          "입력의 chart만 전통적 상징으로 참고하세요. 계산값을 바꾸거나 새로운 십성·지장간·대운을 계산하지 마세요.",
          `이 사람의 일간은 ${dayMasterName}, 월주는 ${monthPillarName}(${monthPillarElements})입니다. personality.body에 '${dayMasterName}'을, topic.body에 '${monthPillarName}'을 정확히 한 번 이상 적으세요. 이름만 끼워 넣은 공통 문장은 개인화된 풀이가 아닙니다.`,
          "각 풀이에서는 '실제 계산 근거 → 그 상징을 쉬운 말로 → 이 사람의 선택 주제에서 떠올릴 수 있는 생활 장면 → 해볼 만한 작은 행동'이 자연스럽게 이어져야 합니다. 같은 풀이를 다른 사주나 다른 관심 주제에 이름만 바꿔 그대로 쓸 수 있다면 근거와 장면을 다시 고르세요.",
          `personality.body는 ${dayMasterName}의 정확한 자연 비유를 먼저 풀고, chart.pillars의 다른 실제 글자나 오행 특징 하나를 더 골라 두 단서를 연결하세요. 왜 그런 모습을 떠올렸는지 설명한 뒤, 대화나 일 정리처럼 일상에서 있을 법한 구체적 행동 예를 하나 드세요. 두 단서만으로 성격을 확정하지 마세요.`,
          `topic.body는 월주 ${monthPillarName}의 실제 오행(윗글자: ${chart.pillars[1].stemElement}, 아랫글자: ${chart.pillars[1].branchElement})과 일간 ${dayMasterName}을 함께 선택 주제의 상황에 연결하세요. 두 글자의 이름이나 오행만 나열하지 말고, 이 조합을 왜 그런 생활 장면으로 읽었는지 쉬운 말로 설명하세요. 월주의 구조를 길게 설명하는 문장으로 분량을 채우지 마세요.`,
          "추가 근거를 적을 때는 chart.pillars에 제공된 한글 두 글자 이름이나 실제 오행만 그대로 사용하세요. 낱글자의 한글 읽기나 새로운 사주 이름을 추측해 만들지 마세요. 생활 예시는 전통 상징을 풀어본 가능성이지 실제 성격이나 행동을 알아낸 사실이 아닙니다. 제목에서도 성격을 단정하지 마세요.",
          "오행 분포는 실제 여덟 글자의 개수만 참고하세요. 어떤 오행이 많거나 적다는 이유만으로 성격의 강약, 부족한 능력, 운명의 좋고 나쁨을 판단하지 마세요.",
          "중학생도 이해할 수 있는 한국어로 쓰세요. 한 문장에는 생각 하나만 담고, 전문 용어 뒤에는 쉬운 뜻을 붙이세요. personality와 topic은 각각 3~4개의 짧은 문장으로 작성하고 추상적인 칭찬 대신 서로 다른 구체적 일상 장면을 한 가지씩 드세요.",
          `이번 관심 주제는 '${selectedTopic.label}'입니다. ${selectedTopic.focus} 다른 주제로 바꿔 쓰지 마세요.`,
          "'능력이 있습니다', '반드시 ~합니다'처럼 성격이나 결과를 확정하는 문장은 피하세요. '이렇게 읽어볼 수 있어요', '이런 모습을 떠올릴 수 있어요'처럼 전통적 상징에 대한 가능한 해석임을 드러내세요.",
          "questionAnswer는 만들지 마세요. 취업·연애·돈 등 미래의 정확한 날짜나 합격·수익을 예언하지 마세요.",
          "today에는 주어진 한국 날짜를 그대로 쓰세요. 선택 주제와 위에서 설명한 실제 사주 단서 하나를 이어 오늘 생각해 볼 점과 작은 행동 제안 하나만 적으세요. 오늘 날짜의 별도 사주나 미래 사건·수익을 계산한 척하거나 보장하지 마세요.",
          "weekly에는 입력 week.startDate와 week.endDate를 정확히 복사하세요. 한국 시간 월요일부터 일요일까지의 이번 주를 한 문단으로 설명하세요. 실제 사주 단서와 선택 주제를 연결해 이번 주에 살펴볼 점과 할 수 있는 작은 행동 하나를 쉬운 한국어로 쓰세요. 특정 요일의 사건·합격·수익·건강 결과를 예언하거나 이번 주의 별도 사주를 계산한 척하지 마세요.",
          "오행 숫자는 여덟 글자의 개수일 뿐, 성격 강약·운명 판단 근거가 아닙니다.",
          "자연 비유를 쓸 때 목=나무, 화=불, 토=흙·산, 금=쇠, 수=물의 대응을 반드시 지키세요. 특히 무토는 흙·산이지 나무가 아닙니다. 일간의 오행과 다른 자연물을 그 일간 자체에 비유하지 마세요.",
          "전문 용어는 천간, 지지, 일간, 월주, 오행, 음양, 십성, 비견, 겁재, 식신, 상관, 편재, 정재, 편관, 정관, 편인, 정인, 갑목, 을목, 병화, 정화, 무토, 기토, 경금, 신금, 임수, 계수 중 설명에 꼭 필요한 것만 사용하고, 그 외에는 쉬운 말로 바꾸세요.",
          "입력에 없는 생년월일이나 이름을 추측하지 마세요. 불안·공포를 조장하거나 의료·투자 조언을 하지 마세요.",
          "topic.kind, today.date, weekly.startDate, weekly.endDate는 입력값을 정확히 복사하세요. JSON 형식만 출력하세요.",
        ].join("\n"),
        response_format: { type: "text", mime_type: "application/json", schema: responseSchema },
        generation_config: { max_output_tokens: 1800, temperature: 0.45 },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "해석 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const status = response.status === 429 ? 429 : response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404 ? 502 : 503;
    const error = response.status === 429
      ? "해석 요청이 잠시 많습니다. 조금 뒤 다시 시도해주세요."
      : response.status === 404
        ? "선택한 Gemini 모델을 사용할 수 없습니다. 모델 설정을 확인해주세요."
        : response.status === 400 || response.status === 401 || response.status === 403
          ? "Gemini 연결 설정을 확인해주세요."
          : "해석 서비스에 문제가 생겼습니다. 잠시 후 다시 시도해주세요.";
    return NextResponse.json({ error }, { status });
  }

  try {
    const raw: unknown = await response.json();
    const text = modelText(raw);
    if (!text) throw new Error("empty model response");
    const reading = parseInterpretationResponse(text, input.topic, date, "", true);
    delete reading.questionAnswer;
    assertChartGrounding(reading, chart);
    return NextResponse.json({ chart, reading }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "해석 결과를 확인할 수 없습니다. 다시 시도해주세요." }, { status: 502 });
  }
}
