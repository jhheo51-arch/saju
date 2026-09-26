import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const experiments = join(root, "docs", "diagrams", "experiments");
const methods = ["Data measured SVG", "Figma FigJam", "GitHub diagram-maker"];

function read(name: string) {
  return readFileSync(join(experiments, name), "utf8");
}

function assertAccessibleSvg(html: string) {
  const labelledBy = html.match(/<svg[^>]*role="img"[^>]*aria-labelledby="([^"]+)"/)?.[1].split(/\s+/);
  assert.equal(labelledBy?.length, 2, "SVG는 title과 desc를 aria-labelledby로 참조해야 합니다");
  assert.match(html, new RegExp(`<title id="${labelledBy![0]}">[^<]+</title>`));
  assert.match(html, new RegExp(`<desc id="${labelledBy![1]}">[^<]+</desc>`));
}

test("비교 CSV에는 정확히 세 방식과 0~100 범위의 다섯 점수가 있다", () => {
  const [header, ...rows] = read("visual-method-comparison.csv").trim().split(/\r?\n/).map((line) => line.split(","));
  assert.deepEqual(header.slice(0, 6), [
    "method",
    "reference_fidelity",
    "editability",
    "exact_layout_control",
    "maintainability",
    "accessibility",
  ]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(([method]) => method), methods);
  for (const row of rows) {
    assert.equal(row.length, header.length);
    for (const score of row.slice(1, 6)) {
      assert.match(score, /^\d+(?:\.\d+)?$/);
      assert.ok(Number(score) >= 0 && Number(score) <= 100, `${row[0]} 점수 ${score}는 0~100이어야 합니다`);
    }
  }
});

test("Data 비교 차트는 루브릭임을 밝히고 세 방식과 접근성 설명을 제공한다", () => {
  const html = read("data-method-comparison.html");
  assert.match(html, /100점 만점의 검토 루브릭/);
  assert.match(html, /실제 사용 데이터나 통계가 아닌 방법 비교 점수/);
  assertAccessibleSvg(html);
  for (const method of methods) assert.match(html, new RegExp(`>${method}<`));
});

test("GitHub diagram-maker 결과는 외부 의존성 없는 독립 HTML로 전체 하네스 흐름을 보여준다", () => {
  const html = read("github-diagram-maker-harness.html");
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<style>[\s\S]+<\/style>/);
  assert.match(html, /<svg\b/);
  assert.doesNotMatch(html, /<(?:script|link|img|iframe|object|embed)\b/i);
  assert.doesNotMatch(html, /@import\b|url\(\s*["']?https?:|\bhttps?:\/\//i);
  assertAccessibleSvg(html);

  const flow = ["사람의 요청", "harness.md", "Codex 에이전트", "구현 결과"].map((label) => html.indexOf(`>${label}<`));
  assert.ok(flow.every((index) => index >= 0));
  assert.ok(flow.every((index, position) => position === 0 || flow[position - 1] < index));
  for (const label of ["evals.json", "npm run harness", "PASS / FAIL", "PASS", "FAIL · 수정 반복", "Agent System"]) {
    assert.match(html, new RegExp(`>${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`));
  }
});

test("039 명세와 상태표는 검증을 마친 세 방식 비교 작업을 완료 상태로 연결한다", () => {
  const specName = "039-visualization-method-comparison.md";
  const spec = readFileSync(join(root, "docs", "specs", specName), "utf8");
  const status = readFileSync(join(root, "docs", "status.md"), "utf8");
  assert.match(spec, /^# 039-visualization-method-comparison/m);
  assert.match(spec, /Data, Figma, 공개 GitHub 스킬의 세 방식/);
  assert.match(spec, /실제 사용 통계가 아닌 검토 루브릭/);
  assert.match(spec, /- 상태: 완료/);
  assert.match(spec, /전체 테스트 185\/185/);
  assert.match(status, /- \[x\] `039-visualization-method-comparison\.md` — Data·Figma·GitHub 스킬/);
});
