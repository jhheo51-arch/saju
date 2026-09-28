import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avatarForChart, palaceStoryForChart } from "../lib/saju/avatar";
import { calculate, type SajuChart } from "../lib/saju/chart";
import { loadLatestResult, saveLatestResult, type SavedInterpretation } from "../lib/saju/interpretation-storage";
import { koreaDate } from "../lib/saju/interpretation";

const chart = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "career" });
const elements = ["목", "화", "토", "금", "수"] as const;
const expectedAvatars = {
  목: { image: "/avatars/wood-palace-v03.png", nurturesMe: "수", iNurture: "화", balancesMe: "금" },
  화: { image: "/avatars/fire-palace-v03.png", nurturesMe: "목", iNurture: "토", balancesMe: "수" },
  토: { image: "/avatars/earth-palace-v03.png", nurturesMe: "화", iNurture: "금", balancesMe: "목" },
  금: { image: "/avatars/metal-palace-v03.png", nurturesMe: "토", iNurture: "수", balancesMe: "화" },
  수: { image: "/avatars/water-palace-v03.png", nurturesMe: "금", iNurture: "목", balancesMe: "토" },
} as const;
const expectedPalaceRoles = {
  목: ["왕세자·왕세자빈", "정사를 의논하는 정승·판서", "실록을 적는 사관", "왕실 의복을 맡은 수방 나인", "왕실을 돌보는 어의"],
  화: ["궁궐의 왕·왕비", "왕의 뜻을 전하는 승지", "임금 곁을 지키는 내금위", "음식을 맡은 소주방 나인", "궁궐 살림을 돌보는 내시"],
  토: ["궁궐의 어른 대비", "궁녀 조직을 이끄는 상궁", "침전 주변을 지키는 별군직", "왕실을 돌보는 어의", "궁궐 곳간을 돌보는 내시"],
  금: ["정사를 이끄는 정승·판서", "임금 곁을 지키는 겸사복·내금위", "회의를 기록하는 사관", "바느질을 맡은 침방 나인", "왕실 여성을 돌보는 의녀"],
  수: ["궁궐의 후궁", "왕명 출납을 맡은 승지", "왕의 하루를 적는 사관", "왕실 여성을 돌보는 의녀", "궁궐 안팎을 잇는 내시"],
} as const;

function png(path: string): Buffer {
  const bytes = readFileSync(new URL(`../public${path}`, import.meta.url));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path} PNG 파일`);
  assert.ok(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0, `${path} 이미지 크기`);
  return bytes;
}

test("일간의 다섯 오행은 서로 다른 궁궐 아바타를 안정적으로 선택한다", () => {
  const images = new Set<string>();
  const names = new Set<string>();
  for (const element of elements) {
    const input = { ...chart, dayMaster: { ...chart.dayMaster, element } } satisfies SajuChart;
    const avatar = avatarForChart(input);
    assert.ok(avatar, `${element} 아바타`);
    assert.equal(avatar.element, element);
    assert.deepEqual(avatarForChart(input), avatar, `${element} 재계산 결과`);
    assert.ok(avatar.name.trim());
    images.add(avatar.image);
    names.add(avatar.name);
  }
  assert.equal(images.size, 5);
  assert.equal(names.size, 5);
  assert.equal(avatarForChart({ ...chart, dayMaster: { ...chart.dayMaster, element: "미정" } }), null);
});

test("아바타와 궁궐 이야기는 최근 저장 결과를 다시 읽어도 사주만으로 동일하게 복원된다", () => {
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();
    get length() { return this.values.size; }
    clear() { this.values.clear(); }
    getItem(key: string) { return this.values.get(key) ?? null; }
    key(index: number) { return [...this.values.keys()][index] ?? null; }
    removeItem(key: string) { this.values.delete(key); }
    setItem(key: string, value: string) { this.values.set(key, value); }
  }
  const storage = new MemoryStorage();
  const result: SavedInterpretation = {
    version: 1,
    createdAt: "2026-09-23T01:02:03.000Z",
    chart,
    topic: "career",
    reading: {
      personality: { headline: "성향", body: `${chart.dayMaster.korean}${chart.dayMaster.element}은 나를 대표하는 글자예요.` },
      topic: { kind: "career", headline: "일", body: `${chart.pillars[1].korean}은 태어난 달의 두 글자예요.` },
      today: { date: koreaDate(), headline: "오늘", body: "작은 행동을 해보세요." },
    },
  };
  const expected = avatarForChart(result.chart);
  const expectedStory = palaceStoryForChart(result.chart);
  saveLatestResult(storage, result);
  const restored = loadLatestResult(storage);
  assert.ok(restored);
  assert.deepEqual(avatarForChart(restored.chart), expected);
  assert.deepEqual(palaceStoryForChart(restored.chart), expectedStory);
  assert.doesNotMatch(storage.getItem("saju.latest-interpretation.v1")!, /"avatar"\s*:/, "아바타는 별도 개인정보나 저장 형식을 요구하지 않는다");
});

test("아바타 원화 다섯 장에는 투명도 채널이 있고 첨부 그림 배경은 별도 이미지다", () => {
  for (const element of elements) {
    const avatar = avatarForChart({ ...chart, dayMaster: { ...chart.dayMaster, element } });
    assert.ok(avatar);
    const bytes = png(avatar.image);
    assert.equal(bytes[25], 6, `${avatar.image} RGBA 투명도 채널`);
  }
  const background = png("/avatars/saju-landscape.png");
  assert.equal(background.readUInt32BE(16), 607);
  assert.equal(background.readUInt32BE(20), 1000);
});

test("다섯 오행은 새 궁궐 원화 경로와 상생·균형 관계를 명세대로 사용한다", () => {
  for (const element of elements) {
    const avatar = avatarForChart({ ...chart, dayMaster: { ...chart.dayMaster, element } });
    assert.ok(avatar);
    const expected = expectedAvatars[element];
    assert.equal(avatar.image, expected.image, `${element} 새 원화 경로`);
    assert.equal(avatar.relations.nurturesMe.element, expected.nurturesMe, `${element}을 북돋는 기운`);
    assert.equal(avatar.relations.iNurture.element, expected.iNurture, `${element}이 북돋는 기운`);
    assert.equal(avatar.relations.balancesMe.element, expected.balancesMe, `${element}의 균형을 돕는 기운`);

    for (const [relation, value] of Object.entries(avatar.relations)) {
      assert.ok(value.description.trim().length >= 10, `${element} ${relation} 쉬운 설명`);
      assert.doesNotMatch(
        value.description,
        /반드시|꼭 만나|같이 다녀|피해야|멀리해야|궁합이 (?:좋|나쁘)/,
        `${element} ${relation} 관계를 사람 사이의 지시나 궁합으로 단정하지 않는다`,
      );
    }
  }
});

test("궁궐 역할은 사용자 제공 후보에서 고르고 같은 사주에는 항상 같은 이야기를 돌려준다", () => {
  const avatarSource = readFileSync(new URL("../lib/saju/avatar.ts", import.meta.url), "utf8");
  for (const element of elements) {
    for (const role of expectedPalaceRoles[element]) {
      assert.ok(avatarSource.includes(JSON.stringify(role)), `${element} 역할 후보: ${role}`);
    }
  }

  const first = palaceStoryForChart(chart);
  assert.ok(first);
  assert.deepEqual(palaceStoryForChart(chart), first, "같은 사주는 같은 궁궐 이야기");
  const chartElement = chart.dayMaster.element as keyof typeof expectedPalaceRoles;
  assert.ok((expectedPalaceRoles[chartElement] as readonly string[]).includes(first.role), "역할은 해당 오행 후보 중 하나");
  assert.match(first.duty, new RegExp(`${chart.dayMaster.korean}${chart.dayMaster.element}`), "맡은 일에 일간 표시");
  assert.match(first.duty, new RegExp(`월주 ${chart.pillars[1].korean}`), "맡은 일에 월주 표시");
  const leastCount = Math.min(...Object.values(chart.elements));
  assert.match(first.teamwork, new RegExp(`기운은 여덟 글자 중 ${leastCount}개`), "함께할 기운에 개인별 오행 분포 표시");
});

test("일간 오행이 같은 일부 다른 사주는 서로 다른 궁궐 역할을 받을 수 있다", () => {
  const samples = ["2005-12-02", "2005-12-03"].map((date) =>
    calculate({ date, time: "08:37", calendar: "solar", topic: "career" }));
  assert.equal(samples[0].dayMaster.element, samples[1].dayMaster.element, "비교 사례의 일간 오행이 같다");
  const stories = samples.map((sample) => palaceStoryForChart(sample));
  assert.ok(stories[0] && stories[1]);
  assert.match(stories[0].duty, new RegExp(`월주 ${samples[0].pillars[1].korean}`));
  assert.match(stories[1].duty, new RegExp(`월주 ${samples[1].pillars[1].korean}`));
  assert.equal(avatarForChart(samples[0])?.image, avatarForChart(samples[1])?.image, "같은 오행 그림은 유지");
});

test("결과 화면에 궁궐 이야기와 창작 설정 안내가 있다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /const avatar = result && avatarStyle \? avatarForChart\(result\.chart, avatarStyle\) : null/);
  assert.match(source, /section-step">03<\/span>[\s\S]*?avatar-card[\s\S]*?section-step">04<\/span>/);
  assert.match(source, /className="avatar-title-line">[\s\S]*?<h2 id="visual-title">나의 아바타<\/h2>[\s\S]*?태어난 날의 오행/);
  assert.match(css, /\.avatar-title-line\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/);
  assert.doesNotMatch(source, /ElementGraph/);
  assert.match(source, /<Image[\s\S]*?src=\{avatar\.image\}[\s\S]*?className="avatar-figure"/);
  assert.ok(source.includes("<dt>궁궐 역할</dt><dd>{palaceStory.role}</dd>"), "궁궐 역할 표시");
  for (const [label, value, id] of [["맡은 일", "duty", "avatar-duty"], ["함께할 기운", "teamwork", "avatar-teamwork"]]) {
    assert.ok(source.includes(`<dt>${label}</dt><dd><ExplainedText text={palaceStory.${value}} id="${id}" pillars={result.chart.pillars} /></dd>`), `${label}의 사주 용어 설명 표시`);
  }
  assert.match(source, /창작 설정이며 실제 직업·신분·성별을 알아낸 결과가 아닙니다/);
  assert.match(source, /전통 상징을 쉽게 풀어본 참고/);
  assert.match(source, /실제 궁합이나 인간관계를 확정하지 않아요/);
  assert.doesNotMatch(source, /반드시 (?:만나|같이 다녀)|피해야 (?:해|합니다)/, "특정 오행 사람을 만나거나 피하라고 지시하지 않는다");
  assert.match(css, /\.avatar-scene\s*\{[^}]*radial-gradient/);
  assert.doesNotMatch(css, /url\("\/avatars\/saju-landscape\.png"\)/, "원본 배경 파일은 보존하되 화면에서는 쓰지 않는다");
});
