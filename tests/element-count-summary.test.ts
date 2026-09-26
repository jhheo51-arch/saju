import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ElementCountSummary } from "../app/element-count-summary";

test("오행 한눈 요약은 가장 많은 기운과 상대적으로 적은 기운을 실제 값으로 표시한다", () => {
  const markup = renderToStaticMarkup(createElement(ElementCountSummary, {
    values: { 목: 1, 화: 2, 토: 1, 금: 2, 수: 2 },
  }));

  assert.match(markup, /오행 한눈 요약/);
  assert.match(markup, /많이 보이는 기운<\/dt><dd>화·금·수 · 각 2개/);
  assert.match(markup, /상대적으로 적게 보이는 기운<\/dt><dd>목·토 · 각 1개/);
  assert.match(markup, /다섯 기운 모두 있음 · 차이 1개/);
  assert.match(markup, /많고 적음이 좋고 나쁨을 뜻하지는 않아요/);
});

test("다섯 기운의 수가 같으면 부족한 기운을 꾸며내지 않는다", () => {
  const markup = renderToStaticMarkup(createElement(ElementCountSummary, {
    values: { 목: 2, 화: 2, 토: 2, 금: 2, 수: 2 },
  }));

  assert.match(markup, /고르게 보이는 기운<\/dt><dd>목·화·토·금·수 · 각 2개/);
  assert.doesNotMatch(markup, /상대적으로 적게 보이는 기운/);
  assert.match(markup, /차이 0개/);
});

test("요약은 그래프 바로 뒤에 있고 작은 화면에서는 한 열로 읽힌다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /<ElementRadar values=\{result\.chart\.elements\} \/><ElementCountSummary values=\{result\.chart\.elements\} \/>/);
  assert.match(css, /\.element-radar-basis\s*\{[^}]*display:\s*flex;[^}]*align-self:\s*stretch;/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.element-count-summary dl > div\s*\{[^}]*grid-template-columns:\s*1fr;/);
});
