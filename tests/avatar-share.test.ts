import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avatarForChart, palaceStoryForChart } from "../lib/saju/avatar";
import { calculate, type SajuChart } from "../lib/saju/chart";

const chart = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "career" });

test("남자·여자 아바타는 다섯 오행마다 다른 투명 PNG를 쓴다", () => {
  for (const element of ["목", "화", "토", "금", "수"] as const) {
    const sample = { ...chart, dayMaster: { ...chart.dayMaster, element } } satisfies SajuChart;
    const male = avatarForChart(sample, "male");
    const female = avatarForChart(sample, "female");
    assert.ok(male && female);
    assert.notEqual(male.image, female.image);
    assert.equal(male.name, female.name);
    for (const avatar of [male, female]) {
      const bytes = readFileSync(new URL(`../public${avatar.image}`, import.meta.url));
      assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      assert.equal(bytes[25], 6, `${avatar.image} RGBA 투명도`);
    }
  }
});

test("아바타 모습 선택은 그림만 바꾸고 궁궐 이야기는 사주로만 정한다", () => {
  assert.notEqual(avatarForChart(chart, "male")?.image, avatarForChart(chart, "female")?.image);
  const story = palaceStoryForChart(chart);
  assert.ok(story);
  assert.deepEqual(palaceStoryForChart(chart), story);
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.match(source, /palaceStoryForChart\(result\.chart\)/);
  assert.doesNotMatch(source, /palaceStoryForChart\(result\.chart, avatarStyle\)/);
});

test("남자·여자 선택 후 숨겨진 저장 영역만 1080×1350 PNG로 만든다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.match(source, /<fieldset className="avatar-style-picker">/);
  assert.match(source, /<div className="avatar-style-row">[\s\S]*<div className="avatar-style-options">[\s\S]*<p id="avatar-style-hint">/);
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.avatar-style-row\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/);
  assert.match(source, /\["male", "남자"\], \["female", "여자"\]/);
  assert.doesNotMatch(source, /"original", "기본"|미리보기|인스타 피드용/);
  assert.match(source, /className="avatar-export-stage" aria-hidden="true"/);
  assert.match(source, /ref=\{avatarShareRef\} className="avatar-share-card"/);
  assert.match(source, /toPng\(avatarShareRef\.current/);
  assert.match(source, /canvasWidth: 1080/);
  assert.match(source, /canvasHeight: 1350/);
  assert.match(source, /disabled=\{!avatarStyle \|\| avatarSaving\}/);
  assert.match(source, /아바타 이미지 저장/);
});
