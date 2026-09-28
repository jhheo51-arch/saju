import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ElementRadar } from "../app/element-radar";

const elements = [
  ["목", "木", 1],
  ["화", "火", 2],
  ["토", "土", 0],
  ["금", "金", 5],
  ["수", "水", 3],
] as const;

const values = { 목: 1, 화: 2, 토: 0, 금: 5, 수: 3 };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function elementGroup(markup: string, element: string) {
  const match = markup.match(new RegExp(`<g[^>]*class="element-radar-element"[^>]*data-element="${element}"[^>]*>([\\s\\S]*?)<\\/g>`));
  assert.ok(match, `${element} 축 그룹은 고유한 data-element 식별자를 가져야 합니다.`);
  return match[1];
}

function rgb(hex: string) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function colorDistance(left: string, right: string) {
  const [lr, lg, lb] = rgb(left);
  const [rr, rg, rb] = rgb(right);
  return Math.hypot(lr - rr, lg - rg, lb - rb);
}

test("다섯 축은 같은 오행 식별자로 원형 바탕·데이터 점·한글과 한자를 묶는다", () => {
  const markup = renderToStaticMarkup(createElement(ElementRadar, { values }));

  for (const [element, hanja] of elements) {
    const group = elementGroup(markup, element);
    assert.match(group, /<circle class="element-radar-label-halo"[^>]*><\/circle>/, `${element} 축의 옅은 원형 바탕`);
    assert.match(group, /<circle class="element-radar-point"[^>]*><\/circle>/, `${element} 축의 실제 데이터 점`);
    assert.match(
      group,
      new RegExp(`<text[^>]*class="element-radar-label"[^>]*>${escapeRegExp(`${element}(${hanja})`)}<\\/text>`),
      `${element} 축의 한글·한자 이름`,
    );
  }
});

test("정확한 값 배지는 축과 같은 식별자를 쓰고 0개와 4개 초과 값도 그대로 보인다", () => {
  const markup = renderToStaticMarkup(createElement(ElementRadar, { values }));

  for (const [element, , count] of elements) {
    assert.match(
      markup,
      new RegExp(`<span data-element="${element}"><strong>${element}<\\/strong> ${count}<\\/span>`),
      `${element} 값 배지`,
    );
  }

  assert.match(markup, /바깥선은 5개 기준입니다\./);
  assert.doesNotMatch(markup, /NaN|Infinity/);
});

test("색을 보지 못해도 제목·오행 이름·한자·개수와 화면 읽기 설명이 유지된다", () => {
  const markup = renderToStaticMarkup(createElement(ElementRadar, { values }));
  const valueText = "목 1개, 화 2개, 토 0개, 금 5개, 수 3개";

  assert.match(markup, /<svg[^>]*role="img"[^>]*aria-labelledby="element-radar-title element-radar-description"/);
  assert.match(markup, /<title id="element-radar-title">오행 글자 수 방사형 그래프<\/title>/);
  assert.match(markup, new RegExp(`<desc id="element-radar-description">${valueText}\\. 바깥선은 5개 기준입니다\\.<\\/desc>`));
  assert.match(markup, new RegExp(`aria-label="정확한 오행 글자 수: ${valueText}"`));

  for (const [element, hanja] of elements) {
    assert.match(markup, new RegExp(`>${escapeRegExp(`${element}(${hanja})`)}<\\/text>`));
  }
});

test("각 오행은 축과 값 배지가 공유하는 서로 다른 고유색과 옅은 바탕색을 갖는다", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const colors = new Set<string>();
  const softColors = new Set<string>();

  for (const [element] of elements) {
    const rule = css.match(new RegExp(
      `\\.element-radar-element\\[data-element="${element}"\\],\\s*\\.element-radar-values span\\[data-element="${element}"\\]\\s*\\{([^}]*)\\}`,
    ));
    assert.ok(rule, `${element} 축과 값 배지는 같은 색 토큰 규칙을 공유해야 합니다.`);

    const color = rule[1].match(/--element-color:\s*(#[0-9a-fA-F]{6})\s*;/)?.[1].toLowerCase();
    const soft = rule[1].match(/--element-soft:\s*(#[0-9a-fA-F]{6})\s*;/)?.[1].toLowerCase();
    assert.ok(color, `${element}의 읽기 쉬운 6자리 고유색이 필요합니다.`);
    assert.ok(soft, `${element}의 옅은 원형·배지 바탕색이 필요합니다.`);
    colors.add(color);
    softColors.add(soft);
  }

  assert.equal(colors.size, 5, "목·화·토·금·수의 고유색은 모두 달라야 합니다.");
  assert.equal(softColors.size, 5, "목·화·토·금·수의 옅은 바탕색은 모두 달라야 합니다.");
  assert.match(css, /\.element-radar-label-halo\s*\{[^}]*fill:\s*var\(--element-soft\);[^}]*stroke:\s*currentColor;/);
  assert.match(css, /\.element-radar-point\s*\{[^}]*stroke:\s*currentColor;/);
  assert.match(css, /\.element-radar-label\s*\{[^}]*fill:\s*currentColor;/);
  assert.match(css, /\.element-radar-values span\s*\{[^}]*color:\s*var\(--element-color\);[^}]*background:\s*var\(--element-soft\);/);
});

test("금은 중성 갈색, 수는 파랑으로 충분히 구분되고 그래프·운세 배지에 같은 전경과 배경을 쓴다", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").toLowerCase();
  const metal = { foreground: "#59514a", background: "#f4f0ec" };
  const water = { foreground: "#155f9b", background: "#deefff" };

  assert.ok(colorDistance(metal.foreground, water.foreground) >= 90, "금·수 전경색은 색상 거리 90 이상이어야 합니다.");
  assert.ok(colorDistance(metal.background, water.background) >= 25, "금·수 옅은 배경도 눈에 띄게 달라야 합니다.");

  const metalChannels = rgb(metal.foreground);
  const waterChannels = rgb(water.foreground);
  assert.ok(Math.max(...metalChannels) - Math.min(...metalChannels) <= 20, "금 전경은 채도가 낮은 중성 갈색이어야 합니다.");
  assert.ok(waterChannels[2] - waterChannels[0] >= 120, "수 전경은 파랑 성분이 뚜렷해야 합니다.");

  for (const [element, palette] of [["금", metal], ["수", water]] as const) {
    assert.match(
      css,
      new RegExp(`\\.element-radar-element\\[data-element="${element}"\\],[\\s\\S]*?--element-color:\\s*${palette.foreground};[\\s\\S]*?--element-soft:\\s*${palette.background};`),
      `${element} 그래프 전경·배경`,
    );
    assert.match(
      css,
      new RegExp(`\\.fortune-badge\\[data-element="${element}"\\]\\s*\\{[^}]*--element-color:\\s*${palette.foreground};[^}]*--element-soft:\\s*${palette.background};[^}]*\\}`),
      `${element} 운세 배지 전경·배경`,
    );
  }

  assert.match(css, /\.fortune-badge\s*\{[^}]*border:[^;}]*var\(--element-color\)[^;}]*;[^}]*background:\s*var\(--element-soft\);/);
  assert.match(css, /\.fortune-badge-dot\s*\{[^}]*background:\s*var\(--element-color\);/);
});

test("그래프와 값 배지는 작은 화면에서도 바깥으로 잘리지 않도록 축소·줄바꿈된다", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileStart = css.indexOf("@media (max-width: 680px)");
  const reducedMotionStart = css.indexOf("@media (prefers-reduced-motion: reduce)", mobileStart);
  const mobileCss = css.slice(mobileStart, reducedMotionStart);

  assert.match(css, /\.element-radar\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*260px;/);
  assert.match(css, /\.element-radar svg\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*overflow:\s*visible;/);
  assert.match(css, /\.element-radar-values\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*justify-content:\s*center;/);
  assert.ok(mobileStart >= 0 && reducedMotionStart > mobileStart, "680px 이하 모바일 스타일 영역이 있어야 합니다.");
  assert.match(mobileCss, /\.element-radar\s*\{[^}]*max-width:\s*300px;/);
});
