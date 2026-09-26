import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculate, type SajuChart } from "../lib/saju/chart";
import { nobleHelperForChart } from "../lib/saju/noble-helper";

const chart = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "career" });

test("열 가지 일간을 표준 천을귀인 두 글자와 연결한다", () => {
  const expected = [
    ["甲", "갑", "목", "축(丑)·미(未)"],
    ["乙", "을", "목", "자(子)·신(申)"],
    ["丙", "병", "화", "해(亥)·유(酉)"],
    ["丁", "정", "화", "해(亥)·유(酉)"],
    ["戊", "무", "토", "축(丑)·미(未)"],
    ["己", "기", "토", "자(子)·신(申)"],
    ["庚", "경", "금", "축(丑)·미(未)"],
    ["辛", "신", "금", "인(寅)·오(午)"],
    ["壬", "임", "수", "묘(卯)·사(巳)"],
    ["癸", "계", "수", "묘(卯)·사(巳)"],
  ] as const;

  for (const [character, korean, element, targetLabel] of expected) {
    const analysis = nobleHelperForChart({
      ...chart,
      dayMaster: { character, korean, element },
    });
    assert.ok(analysis, `${korean} 일간 분석`);
    assert.equal(analysis.targetLabel, targetLabel, `${korean} 천을귀인 글자`);
  }
});

test("네 기둥의 아랫글자에서 귀인 글자와 만난 자리만 찾는다", () => {
  const pillars: SajuChart["pillars"] = chart.pillars.map((pillar, index) => ({
    ...pillar,
    branch: index === 0 ? "寅" : index === 2 ? "午" : pillar.branch,
  }));
  const analysis = nobleHelperForChart({
    ...chart,
    dayMaster: { character: "辛", korean: "신", element: "금" },
    pillars,
  });
  assert.ok(analysis);
  assert.deepEqual(analysis.matches.map(({ label }) => label), ["년주", "일주"]);
  assert.match(analysis.calculation, /년주의 인\(寅\)/);
  assert.match(analysis.calculation, /일주의 오\(午\)/);
});

test("귀인 글자가 직접 보이지 않아도 인연이 없다고 단정하지 않는다", () => {
  const analysis = nobleHelperForChart(chart);
  assert.ok(analysis);
  assert.equal(analysis.targetLabel, "인(寅)·오(午)");
  assert.equal(analysis.matches.length, 0);
  assert.match(analysis.calculation, /직접 보이지 않지만/);
  assert.match(analysis.calculation, /인연의 유무를 정하지는 않아요/);
  assert.doesNotMatch(analysis.calculation, /귀인이 없다|귀인복이 없다/);
});

test("다섯 오행의 궁궐 이야기는 한국적인 도움 장면과 먼저 여는 행동을 담는다", () => {
  const samples = [
    ["甲", "갑", "목"], ["丙", "병", "화"], ["戊", "무", "토"], ["辛", "신", "금"], ["壬", "임", "수"],
  ] as const;
  for (const [character, korean, element] of samples) {
    const analysis = nobleHelperForChart({ ...chart, dayMaster: { character, korean, element } });
    assert.ok(analysis);
    assert.equal(analysis.meetingSigns.length, 2);
    assert.match(analysis.courtStory, /궁궐|전각|주춧돌|사관|승지/);
    assert.ok(analysis.openDoor.length >= 30);
    assert.doesNotMatch(`${analysis.courtStory} ${analysis.openDoor}`, /반드시|운명|구원자|귀인복이 없다/);
  }
});

test("03 아바타 영역에 반응형 궁궐 귀인전과 용어 설명을 표시한다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const avatarStart = source.indexOf('className="preview visual-preview"');
  const fortuneStart = source.indexOf('className="preview today-preview"');
  const section = source.slice(avatarStart, fortuneStart);
  assert.match(section, /궁궐 귀인전/);
  assert.match(section, /나의 귀인패/);
  assert.match(section, /궁궐에서 만나는 모습/);
  assert.match(section, /귀인을 알아보는 장면/);
  assert.match(section, /내가 여는 궁문/);
  assert.match(section, /TermHelp term="천을귀인"/);
  assert.match(css, /\.noble-court-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.noble-court-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
});

test("천을귀인 안내는 짧아도 비단정·창작 의미를 유지하고 글자를 억지로 한 줄에 맞추지 않는다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const disclaimer = source.match(/<p className="noble-disclaimer">([\s\S]*?)<\/p>/)?.[1] ?? "";
  const disclaimerCss = css.match(/\.noble-disclaimer\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(disclaimer, /TermHelp term="천을귀인"/);
  assert.match(disclaimer, /전통 명리의 보조 표시/);
  assert.match(disclaimer, /특정 띠·성별·직업을 귀인으로 단정하지 않/);
  assert.match(disclaimer, /궁궐 이야기는 이해를 위한 창작/);
  assert.doesNotMatch(disclaimerCss, /white-space\s*:\s*nowrap/);
  const pixelFontSize = disclaimerCss.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/);
  if (pixelFontSize) assert.ok(Number(pixelFontSize[1]) >= 14, "안내문을 한 줄에 맞추려고 14px보다 작게 줄이면 안 됩니다");
});
