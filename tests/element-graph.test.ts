import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ElementRadar } from "../app/element-radar";

const elementOrder = ["목", "화", "토", "금", "수"] as const;
const elementHanja = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" } as const;

function assertAppearsInOrder(source: string, values: readonly string[]) {
  let previousIndex = -1;

  for (const value of values) {
    const index = source.indexOf(value, previousIndex + 1);
    assert.ok(index > previousIndex, `"${value}"가 앞선 항목 다음에 있어야 합니다.`);
    previousIndex = index;
  }
}

test("계산 근거의 방사형 그래프는 chart.elements 실제 값을 받는다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ElementGraph|elementGraphForChart|element-graph/);
  assert.match(source, /result\.chart\.pillars\.length \* 2\}개 글자의 <TermHelp term="오행"/);
  assert.match(source, /<ElementRadar values=\{result\.chart\.elements\} \/>/);
  assert.match(source, /오행 숫자는 현재 계산에 포함된 글자 수예요/);
});

test("넓은 화면은 왼쪽 방사형 그래프와 오른쪽 일간·월주 사실 카드로 구성된다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const layoutStart = source.indexOf('className="chart-basis-layout"');
  const layoutEnd = source.indexOf('className="chart-basis-note"', layoutStart);
  const layout = source.slice(layoutStart, layoutEnd);

  assert.ok(layoutStart >= 0 && layoutEnd > layoutStart, "계산 근거 배치 영역이 있어야 합니다.");
  assertAppearsInOrder(layout, [
    'className="element-radar-basis"',
    "<ElementRadar values={result.chart.elements} />",
    'className="chart-basis-facts"',
    'className="chart-basis-fact day-master-fact"',
    'term="일간"',
    'className="chart-basis-fact month-pillar-fact"',
    'term="월주"',
  ]);

  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.chart-basis-layout\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(280px, 0\.9fr\) minmax\(260px, 1\.1fr\);[^}]*\}/,
  );
  assert.match(css, /\.chart-basis-facts\s*\{[^}]*grid-template-rows:\s*repeat\(2, auto\);[^}]*align-content:\s*center;[^}]*\}/);
});

test("일간과 월주는 기존 풀이를 반복하지 않고 실제 글자 구조를 작은 배지로 풀어준다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const basisStart = source.indexOf('className="chart-basis-facts"');
  const basisEnd = source.indexOf('className="chart-basis-note"', basisStart);
  const facts = source.slice(basisStart, basisEnd);

  assert.match(source, /const yangStemCharacters = "甲丙戊庚壬"/);
  assert.match(facts, /aria-label="일간을 풀어본 값"/);
  assert.match(facts, /<dt>한자<\/dt><dd>\{result\.chart\.dayMaster\.character\}<\/dd>/);
  assert.match(facts, /term="음양"/);
  assert.match(facts, /yangStemCharacters\.includes\(result\.chart\.dayMaster\.character\) \? "양" : "음"/);
  assert.match(facts, /term="오행"/);
  assert.match(facts, /aria-label="월주의 두 글자를 풀어본 값"/);
  assert.match(facts, /<dt>윗글자<\/dt><dd>\{result\.chart\.pillars\[1\]\.stem\}/);
  assert.match(facts, /<dt>아랫글자<\/dt><dd>\{result\.chart\.pillars\[1\]\.branch\}/);

  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.chart-basis-detail-list\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*8px;[^}]*\}/);
  assert.match(css, /\.chart-basis-detail-list > div\s*\{[^}]*white-space:\s*nowrap;[^}]*\}/);
});

test("SVG 축은 한글·한자 오행만, 아래 배지는 기존 한글 오행과 정확한 값을 표시한다", () => {
  const values = { 목: 2, 화: 1, 토: 3, 금: 0, 수: 2 };
  const markup = renderToStaticMarkup(createElement(ElementRadar, { values }));

  assert.match(markup, /<title id="element-radar-title">오행 글자 수 방사형 그래프<\/title>/);
  assert.match(
    markup,
    /<desc id="element-radar-description">목 2개, 화 1개, 토 3개, 금 0개, 수 2개\. 바깥선은 4개 기준입니다\.<\/desc>/,
  );
  assert.match(
    markup,
    /aria-label="정확한 오행 글자 수: 목 2개, 화 1개, 토 3개, 금 0개, 수 2개"/,
  );

  assertAppearsInOrder(markup, elementOrder.map((element) => `>${element}(${elementHanja[element]})</text>`));
  assert.doesNotMatch(markup, />목\(木\) 2<\/text>/);
  assertAppearsInOrder(markup, elementOrder.map((element) => `<strong>${element}</strong> ${values[element]}</span>`));
});

test("기본 축 최댓값은 4이고 4 초과 값은 실제 최댓값으로 안전하게 늘어난다", () => {
  const defaultScale = renderToStaticMarkup(
    createElement(ElementRadar, { values: { 목: 4, 화: 0, 토: 1, 금: 2, 수: 1 } }),
  );
  const expandedScale = renderToStaticMarkup(
    createElement(ElementRadar, { values: { 목: 5, 화: 0, 토: 1, 금: 1, 수: 1 } }),
  );

  assert.match(defaultScale, /바깥선은 4개 기준입니다\./);
  assert.match(expandedScale, /목 5개, 화 0개, 토 1개, 금 1개, 수 1개\. 바깥선은 5개 기준입니다\./);
  assert.doesNotMatch(expandedScale, /NaN|Infinity/);
  assert.match(expandedScale, /<text[^>]*>목\(木\)<\/text>/);
  assert.match(expandedScale, /<text[^>]*>화\(火\)<\/text>/);
});

test("모바일에서는 계산 근거 배치가 한 열로 바뀐다", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileStart = css.indexOf("@media (max-width: 680px)");
  const mobileEnd = css.indexOf("@media (prefers-reduced-motion: reduce)", mobileStart);
  const mobileCss = css.slice(mobileStart, mobileEnd);

  assert.ok(mobileStart >= 0 && mobileEnd > mobileStart, "모바일 스타일 영역이 있어야 합니다.");
  assert.match(mobileCss, /\.chart-basis-layout\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*\}/);
});

test("02 풀이 다음에 03 아바타와 04 오늘·이번 주 운세가 나온다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const section02 = source.indexOf('className="section-step">02</span>');
  const section03 = source.indexOf('className="section-step">03</span>');
  const section04 = source.indexOf('className="section-step">04</span>');
  assert.ok(section02 >= 0 && section02 < section03 && section03 < section04);
  assert.match(source.slice(section02, section03), /<ElementRadar values=\{result\.chart\.elements\} \/>/);
  assert.match(source.slice(section03, section04), /나의 아바타/);
  assert.match(source.slice(section03, section04), /className="avatar-card"/);
  assert.match(source.slice(section04), /오늘과 이번 주 운세/);
  assert.match(source.slice(section04), /id="today-title"/);
  assert.match(source.slice(section04), /id="weekly-title"/);
  assert.match(source.slice(section04), /저장된 이전 결과에는 이번 주 풀이가 없어요/);
});
