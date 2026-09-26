import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const casesPath = join(root, "evals", "saju-answer-cases.json");
const reportPath = join(root, "evals", "reports", "latest.json");
const cases = JSON.parse(readFileSync(casesPath, "utf8")) as Array<{
  id: string;
  expectedStatus: string;
  expectedCodes: string[];
  payload: unknown;
}>;

function python(args: string[]) {
  return spawnSync("python", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
  });
}

test("고정된 사주 사례 일곱 개가 모두 기대 판정을 통과하고 latest.json에 기록된다", () => {
  const run = python(["evals/run_saju_evals.py"]);
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /Saju evals: 7\/7 passed/);

  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert.deepEqual(report.summary, { total: 7, passed: 7, failed: 0 });
  assert.deepEqual(report.results.map((result: { id: string }) => result.id), cases.map((item) => item.id));
  assert.ok(report.results.every((result: { passed: boolean }) => result.passed));
});

test("검사 결과와 기대 판정이 다르면 하네스가 종료코드 1과 실패 요약을 남긴다", () => {
  const temp = mkdtempSync(join(tmpdir(), "saju-eval-mismatch-"));
  try {
    const casePath = join(temp, "cases.json");
    const tempReport = join(temp, "latest.json");
    writeFileSync(casePath, JSON.stringify([{ ...cases[0], expectedStatus: "FAIL" }]), "utf8");
    const code = [
      "import importlib.util, pathlib, sys",
      "spec=importlib.util.spec_from_file_location('runner', sys.argv[1])",
      "runner=importlib.util.module_from_spec(spec); spec.loader.exec_module(runner)",
      "runner.CASES_PATH=pathlib.Path(sys.argv[2]); runner.REPORT_PATH=pathlib.Path(sys.argv[3])",
      "raise SystemExit(runner.main())",
    ].join("; ");
    const run = python(["-c", code, join(root, "evals", "run_saju_evals.py"), casePath, tempReport]);
    assert.equal(run.status, 1, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /\[FAIL\] personalized-relationship-pass/);
    const report = JSON.parse(readFileSync(tempReport, "utf8"));
    assert.deepEqual(report.summary, { total: 1, passed: 0, failed: 1 });
    assert.equal(report.results[0].expectedStatus, "FAIL");
    assert.equal(report.results[0].actualStatus, "PASS");
    assert.equal(report.results[0].passed, false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("npm과 GitHub Actions가 같은 품질 하네스를 실행한다", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const workflow = readFileSync(join(root, ".github", "workflows", "quality.yml"), "utf8");
  assert.equal(pkg.scripts["eval:saju"], "python evals/run_saju_evals.py");
  assert.equal(pkg.scripts.harness, "npm run check:harness && npm run check && npm run eval:saju");
  assert.match(workflow, /actions\/setup-node@v4[\s\S]*?node-version:\s*22/);
  assert.match(workflow, /actions\/setup-python@v5[\s\S]*?python-version:\s*["']3\.12["']/);
  assert.match(workflow, /- run:\s*npm ci/);
  assert.match(workflow, /- run:\s*npm run harness/);
  assert.match(workflow, /- run:\s*npm run build/);
});

test("기본 하네스 그림은 436×267 레퍼런스형 단일 인포그래픽과 접근성 설명을 제공한다", () => {
  const html = readFileSync(join(root, "docs", "diagrams", "saju-harness-workflow.html"), "utf8");
  const svg = readFileSync(join(root, "docs", "diagrams", "saju-harness-workflow.svg"), "utf8");
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<img src="saju-harness-workflow\.svg" alt="[^"]+">/);
  assert.match(svg, /<svg[^>]*viewBox="0 0 436 267"[^>]*role="img"[^>]*aria-labelledby="title desc"/);
  assert.match(svg, /<title id="title">[^<]+<\/title>/);
  assert.match(svg, /<desc id="desc">[^<]*harness\.md[^<]*실패하면 에이전트로 돌아가고 통과하면 완료[^<]*<\/desc>/);
  assert.match(svg, /<rect width="436" height="267" fill="#30312f"\/>/);
  assert.match(svg, /<rect x="10" y="9" width="416" height="253"[^>]*fill="#fff"\/>/);

  const flow = ["사람 아이디어", "harness.md", "에이전트", "구현 결과"].map((label) => svg.indexOf(`>${label}<`));
  assert.ok(flow.every((index) => index >= 0), "사람→명세→에이전트→구현 결과 노드가 모두 있어야 합니다");
  assert.ok(flow.every((index, position) => position === 0 || flow[position - 1] < index), "주 흐름 노드 순서가 맞아야 합니다");
  for (const label of ["AGENTS.md", "evals.json", "npm run harness", "FAIL", "PASS", "완료"]) {
    assert.match(svg, new RegExp(`>${label.replace(".", "\\.")}<`));
  }
  assert.doesNotMatch(svg, />Agent System</);
});

test("기본 하네스 HTML과 SVG는 외부 폰트·스크립트·이미지에 의존하지 않는다", () => {
  const html = readFileSync(join(root, "docs", "diagrams", "saju-harness-workflow.html"), "utf8");
  const svg = readFileSync(join(root, "docs", "diagrams", "saju-harness-workflow.svg"), "utf8");
  assert.doesNotMatch(html, /<(?:script|link|iframe|object|embed)\b|@import\b|\bhttps?:\/\//i);
  assert.doesNotMatch(svg.replace('xmlns="http://www.w3.org/2000/svg"', ""), /<(?:script|image|foreignObject)\b|@import\b|\bhttps?:\/\//i);
});

test("040 명세와 상태표는 검증을 마친 레퍼런스형 하네스 그림을 완료 상태로 연결한다", () => {
  const spec = readFileSync(join(root, "docs", "specs", "040-reference-harness-visual.md"), "utf8");
  const status = readFileSync(join(root, "docs", "status.md"), "utf8");
  assert.match(spec, /^# 040-reference-harness-visual/m);
  assert.match(spec, /436×267 캔버스에서 흰 종이와 짙은 외곽 배경/);
  assert.match(spec, /외부 폰트·스크립트·이미지 의존성 없이 접근 가능한 SVG/);
  assert.match(spec, /- 상태: 완료/);
  assert.match(spec, /전체 테스트 187\/187/);
  assert.match(status, /- \[x\] `040-reference-harness-visual\.md` — 첨부 레퍼런스와 같은 밀도·구도의 단일 하네스 그림/);
});
