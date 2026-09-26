import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basicTerms, stemTerms, tenStars } from "../lib/saju/glossary";
import { calculate } from "../lib/saju/chart";

test("기본 용어 11개와 십성 10개를 제공한다", () => {
  assert.equal(basicTerms.length, 11);
  assert.equal(tenStars.length, 10);
  assert.equal(stemTerms.length, 10);
});

test("요청한 어려운 용어를 모두 설명한다", () => {
  const basicNames = new Set<string>(basicTerms.map(({ term }) => term));
  const starNames = new Set<string>(tenStars.map(({ term }) => term));
  for (const term of ["천간", "지지", "일간", "년주", "월주", "일주", "시주", "오행", "음양", "십성", "천을귀인"])
    assert.ok(basicNames.has(term), `${term} 기본 설명 누락`);
  for (const term of ["편관", "비견", "편인", "정인", "식신"])
    assert.ok(starNames.has(term), `${term} 십성 설명 누락`);
});

test("용어가 중복되지 않고 모든 뜻에 읽을 내용이 있다", () => {
  const entries = [...basicTerms, ...tenStars, ...stemTerms];
  const names = entries.map(({ term }) => term);
  assert.equal(new Set(names).size, names.length);
  for (const { term, meaning } of entries) {
    assert.ok(term.trim().length > 0, "빈 용어가 있습니다");
    assert.ok(meaning.trim().length > 0, `${term} 뜻이 비어 있습니다`);
  }
});

test("천간 이름 10개가 올바른 오행과 자연 비유로 설명된다", () => {
  const expected = [
    ["갑목", "나무", /큰 나무/],
    ["을목", "나무", /풀|덩굴/],
    ["병화", "불", /햇빛/],
    ["정화", "불", /등불/],
    ["무토", "흙", /산|땅/],
    ["기토", "흙", /밭흙/],
    ["경금", "쇠", /쇠/],
    ["신금", "쇠", /금속/],
    ["임수", "물", /강|바다/],
    ["계수", "물", /비|이슬/],
  ] as const;
  assert.deepEqual(stemTerms.map(({ term }) => term), expected.map(([term]) => term));
  for (const [term, element, image] of expected) {
    const meaning = stemTerms.find((entry) => entry.term === term)?.meaning;
    assert.ok(meaning, `${term} 설명 누락`);
    assert.match(meaning, new RegExp(`${element} 기운`), `${term} 오행 불일치`);
    assert.match(meaning, image, `${term} 자연 비유 불일치`);
  }
  const mu = stemTerms.find(({ term }) => term === "무토")!.meaning;
  assert.match(mu, /나무 기운을 뜻하지는 않아요/);
});

test("천간 설명은 위치가 아니라 하늘의 기운과 자연물 비유를 알려준다", () => {
  const meaning = basicTerms.find(({ term }) => term === "천간")?.meaning;
  assert.ok(meaning, "천간 뜻 누락");
  assert.match(meaning, /하늘.*기운/);
  assert.match(meaning, /열\s*가지.*상징/);
  assert.match(meaning, /갑.*을.*나무/);
  assert.match(meaning, /병.*정.*불/);
  assert.doesNotMatch(meaning, /^(?:사주의?\s*)?윗글자(?:예요|입니다|다\.)?$/);
});

test("지지 설명은 위치가 아니라 땅의 기운과 계절·시간의 의미를 알려준다", () => {
  const meaning = basicTerms.find(({ term }) => term === "지지")?.meaning;
  assert.ok(meaning, "지지 뜻 누락");
  assert.match(meaning, /땅.*기운/);
  assert.match(meaning, /계절.*시간/);
  assert.match(meaning, /열두\s*가지.*상징/);
  assert.match(meaning, /자.*축.*인/);
  assert.doesNotMatch(meaning, /^(?:사주의?\s*)?아랫글자(?:예요|입니다|다\.)?$/);
});

test("월주는 태어난 달의 두 글자임을 쉽게 설명한다", () => {
  const meaning = basicTerms.find(({ term }) => term === "월주")?.meaning;
  assert.ok(meaning, "월주 뜻 누락");
  assert.match(meaning, /태어난 달/);
  assert.match(meaning, /두 글자/);
  assert.match(meaning, /성격을 정하지/);
});

test("년주·일주·시주는 각각 태어난 해·날·시간의 두 글자로 설명한다", () => {
  for (const [term, time] of [["년주", "해"], ["일주", "날"], ["시주", "시간"]] as const) {
    const meaning = basicTerms.find((entry) => entry.term === term)?.meaning;
    assert.ok(meaning, `${term} 뜻 누락`);
    assert.match(meaning, new RegExp(`태어난 ${time}`));
    assert.match(meaning, /두 글자/);
  }
});

test("표시할 천간과 지지가 계산된 각 기둥의 두 글자와 일치한다", () => {
  const chart = calculate({
    date: "2005-12-23",
    time: "08:37",
    calendar: "solar",
    topic: "general",
  });
  assert.equal(chart.pillars.length, 4);
  for (const pillar of chart.pillars) {
    assert.deepEqual([...pillar.text], [pillar.stem, pillar.branch]);
  }
});

test("별도 용어 사전 대신 원자료의 천간·지지에서 뜻을 열 수 있다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /처음 보는 사주 단어/);
  assert.doesNotMatch(source, /tenStars\.map\(/);
  assert.match(source, /<TermHelp term="천간"/);
  assert.match(source, /<TermHelp term="지지"/);
  assert.match(source, /<button[^>]*popoverTarget=\{id\}[^>]*>/);
  assert.match(source, /<(?:div|span)[^>]*id=\{id\}[^>]*popover="auto"/);
  assert.match(source, /\{meaning\}/);
});

test("생성된 해석의 요약과 다섯 세부 항목을 모두 클릭형 설명과 연결한다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.match(source, /import \{[^}]*stemTerms[^}]*\} from "\.\.\/lib\/saju\/glossary"/);
  assert.match(source, /const glossary = \[\.\.\.basicTerms, \.\.\.tenStars, \.\.\.stemTerms\]/);
  assert.match(source, /text\.split\(explainedPattern\)/);
  assert.match(source, /known \? <TermHelp/);
  assert.match(source, /<ExplainedText text=\{section\.body\}/);
  for (const [key, label] of [
    ["basis", "이렇게 읽은 단서"],
    ["meaning", "내 안의 흐름"],
    ["scene", "이럴 때 드러나요"],
    ["balance", "반대 모습도 있어요"],
    ["action", "지금 해볼 것"],
  ]) {
    assert.match(source, new RegExp(`${key}: "${label}"`));
  }
  assert.match(source, /Object\.keys\(readingDetailLabels\)[\s\S]*\.map\(\(key\)/);
  assert.match(source, /<ExplainedText text=\{section\.details!\[key\]\}/);
  assert.match(source, /<ReadingCardContent section=\{result\.reading\.personality\}/);
  assert.match(source, /<ReadingCardContent section=\{result\.reading\.topic\}/);
});

test("무자·을유 같은 실제 네 기둥 이름은 풀이·아바타·운세 어디서든 눌러 설명을 연다", () => {
  const chart = calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" });
  const names = chart.pillars.map((pillar) => pillar.korean);
  assert.ok(names.includes("을유"), "검사 사례의 을유 누락");
  assert.ok(names.includes("무자"), "검사 사례의 무자 누락");

  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.match(source, /const pillarByName = new Map\(pillars\.map\(\(pillar\) => \[pillar\.korean, pillar\]\)\)/);
  assert.match(source, /const inlineGlossary = glossary\.filter\(\(\{ term \}\) => !\["년주", "일주", "시주"\]\.includes\(term\)\)/);
  assert.match(source, /inlineGlossary\.map\(\(entry\) => entry\.term\)/);
  assert.match(source, /if \(pillar\) return <PillarHelp/);
  assert.match(source, /function topicParticle\(word: string\): "은" \| "는"/);
  assert.match(source, /\$\{pillar\.korean\}\$\{topicParticle\(pillar\.korean\)\} 사주의 한 기둥/);
  assert.match(source, /위 글자 \$\{pillar\.korean\[0\]\}\(\$\{pillar\.stem\}\)/);
  assert.match(source, /아래 글자 \$\{pillar\.korean\[1\]\}\(\$\{pillar\.branch\}\)/);
  assert.match(source, /<ReadingCardContent[^>]*pillars=\{result\.chart\.pillars\}/);
  assert.match(source, /<ExplainedText text=\{palaceStory\.duty\}[^>]*pillars=\{result\.chart\.pillars\}/);
  assert.match(source, /<ExplainedText text=\{result\.reading\.today\.body\}[^>]*pillars=\{result\.chart\.pillars\}/);
  assert.match(source, /<ExplainedText text=\{result\.reading\.weekly\.body\}[^>]*pillars=\{result\.chart\.pillars\}/);
  assert.match(source, /<PillarHelp pillar=\{result\.chart\.pillars\[1\]\} id="fortune-month-pillar-name"/);
  assert.match(source, /<TermHelp term=\{item\.label\} id=\{`\$\{item\.label\}-meaning-help`\}/);
});

test("계산 근거의 일간·월주·오행과 일간·월주 이름에도 클릭형 뜻풀이가 있다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.match(source, /<TermHelp term="일간" id="basis-day-master-help"/);
  assert.match(source, /<TermHelp term="월주" id="basis-month-pillar-help"/);
  assert.match(source, /<TermHelp term="오행" id="basis-elements-help"/);
  assert.match(source, /<ExplainedText text=\{`\$\{result\.chart\.dayMaster\.korean\}\$\{result\.chart\.dayMaster\.element\}`\}/);
  assert.match(source, /<PillarHelp pillar=\{result\.chart\.pillars\[1\]\} id="basis-month-pillar-name"/);
  assert.match(source, /aria-label=\{`\$\{pillar\.korean\} 뜻 보기`\}/);
});
