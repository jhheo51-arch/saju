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

test("하네스 다이어그램은 600×296 안에서 주 흐름·품질 게이트·Agent System을 보여준다", () => {
  const html = readFileSync(join(root, "docs", "diagrams", "saju-harness-workflow.html"), "utf8");
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<svg[^>]*viewBox="0 0 600 296"[^>]*role="img"[^>]*aria-labelledby="saju-harness-title saju-harness-desc"/);
  assert.match(html, /<title id="saju-harness-title">[^<]+<\/title>/);
  assert.match(html, /<desc id="saju-harness-desc">[^<]*harness\.md[^<]*실패하면 에이전트로 돌아가며 성공하면 완료[^<]*<\/desc>/);

  const bodyBeforeSvg = html.match(/<body>([\s\S]*?)<svg/)?.[1] ?? "missing";
  const bodyAfterSvg = html.match(/<\/svg>([\s\S]*?)<\/body>/)?.[1] ?? "missing";
  assert.equal(bodyBeforeSvg.trim(), "", "SVG 밖에 큰 제목이나 설명을 두지 않습니다");
  assert.equal(bodyAfterSvg.trim(), "", "SVG 밖에 별도 설명 블록을 두지 않습니다");
  assert.doesNotMatch(html.slice(html.indexOf("<body>")), /<(?:h1|h2|p)\b/);

  const flow = ["사람 아이디어", "harness.md", "에이전트", "구현 결과"].map((label) => html.indexOf(`>${label}<`));
  assert.ok(flow.every((index) => index >= 0), "사람→명세→에이전트→구현 결과 노드가 모두 있어야 합니다");
  assert.ok(flow.every((index, position) => position === 0 || flow[position - 1] < index), "주 흐름 노드 순서가 맞아야 합니다");
  assert.match(html, /d="M57 112H87"[^>]*marker-end="url\(#arr\)"/);
  assert.match(html, /d="M124 112H162"[^>]*marker-end="url\(#arr\)"/);
  assert.match(html, /d="M229 112H271"[^>]*marker-end="url\(#arr\)"/);

  assert.match(html, />AGENTS\.md</);
  assert.match(html, /수정하면 npm run harness 실행/);
  assert.match(html, />evals\.json</);
  assert.match(html, />npm run harness</);
  assert.match(html, />FAIL</);
  assert.match(html, /d="M292 211Q284 211[^>]*marker-end="url\(#arr\)"/);
  assert.match(html, />PASS</);
  assert.match(html, /d="M333 211H356"[^>]*marker-end="url\(#arr\)"/);
  assert.match(html, />완료</);

  assert.match(html, />Agent System</);
  assert.match(html, />🧠 Model</);
  assert.match(html, />Harness</);
  assert.match(html, />Environment</);
});
