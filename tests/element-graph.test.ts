import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("큰 오행 칸 그래프 없이 계산 근거의 간단한 오행 글자 수는 남는다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ElementGraph|elementGraphForChart|element-graph/);
  assert.match(source, /여덟 글자의 <TermHelp term="오행"/);
  assert.match(source, /Object\.entries\(result\.chart\.elements\).*`\$\{element\} \$\{count\}`/);
  assert.match(source, /오행 숫자는 글자 수예요/);
});

test("02 풀이 다음에 03 아바타와 04 오늘·이번 주 운세가 나온다", () => {
  const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const section02 = source.indexOf('className="section-step">02</span>');
  const section03 = source.indexOf('className="section-step">03</span>');
  const section04 = source.indexOf('className="section-step">04</span>');
  assert.ok(section02 >= 0 && section02 < section03 && section03 < section04);
  assert.match(source.slice(section03, section04), /나의 아바타/);
  assert.match(source.slice(section03, section04), /className="avatar-card"/);
  assert.match(source.slice(section04), /오늘과 이번 주 운세/);
  assert.match(source.slice(section04), /id="today-title"/);
  assert.match(source.slice(section04), /id="weekly-title"/);
  assert.match(source.slice(section04), /저장된 이전 결과에는 이번 주 풀이가 없어요/);
});
