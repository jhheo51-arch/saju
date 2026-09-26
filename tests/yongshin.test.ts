import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { YongshinSummary } from "../app/yongshin-summary";
import { calculate, type Pillar, type PillarLabel, type SajuChart } from "../lib/saju/chart";
import { yongshinForChart, type FiveElement } from "../lib/saju/yongshin";

const labels: PillarLabel[] = ["년주", "월주", "일주", "시주"];
const stemElement: Record<string, FiveElement> = {
  甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토",
  己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수",
};
const branchElement: Record<string, FiveElement> = {
  子: "수", 丑: "토", 寅: "목", 卯: "목", 辰: "토", 巳: "화",
  午: "화", 未: "토", 申: "금", 酉: "금", 戌: "토", 亥: "수",
};
const stemKorean: Record<string, string> = {
  甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무",
  己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계",
};
const branchKorean: Record<string, string> = {
  子: "자", 丑: "축", 寅: "인", 卯: "묘", 辰: "진", 巳: "사",
  午: "오", 未: "미", 申: "신", 酉: "유", 戌: "술", 亥: "해",
};

function chartFrom(stems: string[], branches: string[], dayStem = stems[2]): SajuChart {
  const pillars: Pillar[] = labels.map((label, index) => ({
    label,
    text: `${stems[index]}${branches[index]}`,
    korean: `${stemKorean[stems[index]]}${branchKorean[branches[index]]}`,
    stem: stems[index],
    branch: branches[index],
    stemElement: stemElement[stems[index]],
    branchElement: branchElement[branches[index]],
  }));

  return {
    pillars,
    elements: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 },
    dayMaster: { character: dayStem, korean: stemKorean[dayStem], element: stemElement[dayStem] },
    method: "테스트 계산",
    engine: "테스트 엔진",
    elementMethod: "테스트 오행 집계",
  };
}

function assertClose(actual: number, expected: number, message: string) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: 기대 ${expected}, 실제 ${actual}`);
}

function colorDistance(left: string, right: string) {
  const channels = (hex: string) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const [lr, lg, lb] = channels(left);
  const [rr, rg, rb] = channels(right);
  return Math.hypot(lr - rr, lg - rg, lb - rb);
}

test("천간 1점과 지장간 본기·중기·여기 가중치에 월지만 두 배를 적용한다", () => {
  const chart = chartFrom(["甲", "甲", "甲", "甲"], ["子", "丑", "午", "寅"]);
  const result = yongshinForChart(chart);

  // 천간 목 4점 + 寅 여기의 목 0.6점
  assertClose(result.weightedElements.목, 4.6, "목 가중치");
  // 午 본기 화 0.7점 + 寅 중기 화 0.3점
  assertClose(result.weightedElements.화, 1, "화 가중치");
  // 월지 丑 본기 0.6×2 + 午 중기 0.3 + 寅 여기 0.1
  assertClose(result.weightedElements.토, 1.6, "토 가중치");
  // 월지 丑 여기 0.1×2
  assertClose(result.weightedElements.금, 0.2, "금 가중치");
  // 子 본기 1 + 월지 丑 중기 0.3×2
  assertClose(result.weightedElements.수, 1.6, "수 가중치");
  assertClose(Object.values(result.weightedElements).reduce((sum, value) => sum + value, 0), 9, "전체 가중치");
  assert.equal(result.supportPercent, 69);
});

test("도움 비중이 정확히 50%이면 신강 쪽으로 분류한다", () => {
  const boundary = chartFrom(["丙", "戊", "甲", "庚"], ["子", "子", "辰", "未"], "甲");
  const result = yongshinForChart(boundary);

  assert.equal(result.supportPercent, 50);
  assert.equal(result.tendency, "신강 쪽");
  assert.deepEqual(result.roles.map(({ label, element }) => [label, element]), [
    ["용신", "금"],
    ["희신", "토"],
    ["기신", "수"],
  ]);
});

test("다섯 일간의 신강 분기는 생극 관계에 따라 서로 다른 용신·희신·기신을 고른다", () => {
  const cases = [
    ["甲", "卯", ["금", "토", "수"]],
    ["丙", "寅", ["수", "금", "목"]],
    ["戊", "午", ["목", "수", "화"]],
    ["庚", "丑", ["화", "목", "토"]],
    ["壬", "子", ["토", "화", "금"]],
  ] as const;

  for (const [dayStem, branch, expected] of cases) {
    const result = yongshinForChart(chartFrom([dayStem, dayStem, dayStem, dayStem], [branch, branch, branch, branch]));
    assert.equal(result.tendency, "신강 쪽", `${dayStem} 일간의 분류`);
    assert.deepEqual(result.roles.map((role) => role.element), expected, `${dayStem} 일간의 용신·희신·기신`);
  }
});

test("다섯 일간의 신약 분기는 생하는 오행·같은 오행·극하는 오행 순서로 고른다", () => {
  const cases = [
    ["甲", "庚", "酉", ["수", "목", "금"]],
    ["丙", "壬", "子", ["목", "화", "수"]],
    ["戊", "甲", "卯", ["화", "토", "목"]],
    ["庚", "丙", "午", ["토", "금", "화"]],
    ["壬", "戊", "戌", ["금", "수", "토"]],
  ] as const;

  for (const [dayStem, controllerStem, branch, expected] of cases) {
    const result = yongshinForChart(chartFrom(
      [controllerStem, controllerStem, dayStem, controllerStem],
      [branch, branch, branch, branch],
    ));
    assert.equal(result.tendency, "신약 쪽", `${dayStem} 일간의 분류`);
    assert.deepEqual(result.roles.map((role) => role.element), expected, `${dayStem} 일간의 용신·희신·기신`);
  }
});

test("실제 calculate 결과 여러 사례에서도 기둥·비중·세 역할을 재현한다", () => {
  const cases = [
    ["2005-12-23", "08:37", "乙酉 戊子 辛巳 壬辰", "신약 쪽", 44, ["토", "금", "화"]],
    ["2000-02-29", "23:30", "庚辰 戊寅 戊午 壬子", "신약 쪽", 49, ["화", "토", "목"]],
    ["2020-06-15", "12:00", "庚子 壬午 己丑 庚午", "신강 쪽", 51, ["목", "수", "화"]],
  ] as const;

  for (const [date, time, pillars, tendency, supportPercent, roles] of cases) {
    const chart = calculate({ date, time, calendar: "solar", topic: "general" });
    const result = yongshinForChart(chart);
    assert.equal(chart.pillars.map((pillar) => pillar.text).join(" "), pillars, `${date}의 네 기둥`);
    assert.equal(result.tendency, tendency, `${date}의 경향`);
    assert.equal(result.supportPercent, supportPercent, `${date}의 도움 비중`);
    assert.deepEqual(result.roles.map((role) => role.element), roles, `${date}의 세 역할`);
  }
});

test("카드는 역할명·한글·한자·실제 근거와 제한을 색 없이도 읽을 수 있게 표시한다", () => {
  const chart = calculate({ date: "2020-06-15", time: "12:00", calendar: "solar", topic: "general" });
  const markup = renderToStaticMarkup(createElement(YongshinSummary, { chart }));
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(markup, /<section class="yongshin-summary" aria-labelledby="yongshin-summary-title">/);
  assert.match(markup, /class="yongshin-kicker">간이 [\s\S]*?aria-label="억부용신 뜻 보기">억부용신<\/button>[\s\S]*? 참고 결과<\/p>/);
  assert.match(markup, /class="yongshin-tendency">[\s\S]*?aria-label="신강 뜻 보기">신강<\/button>[\s\S]*? 쪽 · 도움 비중 51%<\/span>/);
  assert.match(markup, /class="yongshin-basis">일간 기토[\s\S]*?이를 돕는 화[\s\S]*?51%라 신강 쪽으로 분류했어요\.<\/p>/);

  const expected = [
    ["용신", "목", "木", "토 기운을 조절하는 중심 역할"],
    ["희신", "수", "水", "목 기운이 이어지도록 돕는 보조 역할"],
    ["기신", "화", "火", "토 기운을 더 보태는 쪽이라 주의해서 보는 역할"],
  ] as const;
  for (const [role, element, hanja, summary] of expected) {
    const article = markup.match(new RegExp(`<article[^>]*data-element="${element}"[^>]*data-role="${role}"[^>]*>([\\s\\S]*?)<\\/article>`));
    assert.ok(article, `${role} 카드는 역할과 오행 식별자를 가져야 합니다.`);
    assert.match(article[1], new RegExp(`<span class="yongshin-role-label">[\\s\\S]*?aria-label="${role} 뜻 보기">${role}<\\/button>`));
    assert.match(article[1], new RegExp(`<span class="yongshin-element-mark" aria-hidden="true">${hanja}<\\/span>`));
    assert.match(article[1], new RegExp(`<strong>${element}\\(${hanja}\\)<\\/strong>`));
    assert.match(article[1], new RegExp(`<p>${summary}<\\/p>`));
  }

  const disclaimer = markup.match(/<p class="yongshin-disclaimer">([\s\S]*?)<\/p>/)?.[1] ?? "";
  assert.match(disclaimer, /월지 2배/);
  assert.match(disclaimer, /지장간 가중치/);
  assert.match(disclaimer, /합·충·특수격국·조후는 제외/);
  assert.match(disclaimer, /참고로만 봐주세요/);

  const disclaimerCss = [...css.matchAll(/\.yongshin-disclaimer\s*\{([^}]*)\}/g)]
    .map((match) => match[1])
    .join("\n");
  assert.doesNotMatch(disclaimerCss, /white-space\s*:\s*nowrap/);
  const pixelFontSize = disclaimerCss.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/);
  assert.ok(pixelFontSize, "용신 안내문 글자 크기가 명시되어야 합니다.");
  assert.ok(Number(pixelFontSize[1]) >= 14, "용신 안내문은 14px 이상이어야 합니다.");
});

test("이전 저장 결과도 현재 chart에서 다시 계산하며 별도 저장 필드를 요구하지 않는다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");

  assert.match(source, /<YongshinSummary chart=\{result\.chart\} \/>/);
  assert.doesNotMatch(source, /result\.(?:reading\.)?yongshin/);
});

test("넓은 화면은 세 카드 한 줄, 680px 이하는 한 열이며 내용이 가로로 넘치지 않는다", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileStart = css.indexOf("@media (max-width: 680px)");
  const mobileEnd = css.indexOf("@media (prefers-reduced-motion: reduce)", mobileStart);
  const mobileCss = css.slice(mobileStart, mobileEnd);

  assert.match(css, /\.yongshin-role-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.yongshin-role\s*\{[^}]*min-width:\s*0;/);
  assert.ok(mobileStart >= 0 && mobileEnd > mobileStart, "680px 이하 모바일 스타일 영역이 있어야 합니다.");
  assert.match(mobileCss, /\.yongshin-summary-header\s*\{[^}]*display:\s*grid;/);
  assert.match(mobileCss, /\.yongshin-tendency\s*\{[^}]*white-space:\s*normal;/);
  assert.match(mobileCss, /\.yongshin-role-grid\s*\{[^}]*grid-template-columns:\s*1fr;/);
  assert.match(mobileCss, /\.yongshin-role\s*\{[^}]*grid-template-columns:\s*auto auto minmax\(0, 1fr\);/);
});

test("용신 카드의 금·수는 그래프와 같은 전경·배경을 쓰고 색상 거리도 충분하다", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").toLowerCase();
  const metal = { foreground: "#59514a", background: "#f4f0ec" };
  const water = { foreground: "#155f9b", background: "#deefff" };

  assert.ok(colorDistance(metal.foreground, water.foreground) >= 90, "금·수 카드 전경색이 충분히 달라야 합니다.");
  assert.ok(colorDistance(metal.background, water.background) >= 25, "금·수 카드 배경색이 충분히 달라야 합니다.");

  for (const [element, palette] of [["금", metal], ["수", water]] as const) {
    assert.match(
      css,
      new RegExp(`\\.yongshin-role\\[data-element="${element}"\\]\\s*\\{[^}]*--element-color:\\s*${palette.foreground};[^}]*--element-soft:\\s*${palette.background};[^}]*\\}`),
      `${element} 용신 카드 팔레트`,
    );
  }

  assert.match(css, /\.yongshin-role\s*\{[^}]*border:[^;}]*var\(--element-color\)[^;}]*;[^}]*background:\s*var\(--element-soft\);/);
  assert.match(css, /\.yongshin-element-mark\s*\{[^}]*border:[^;}]*var\(--element-color\)[^;}]*;[^}]*color:\s*var\(--element-color\);/);
});
