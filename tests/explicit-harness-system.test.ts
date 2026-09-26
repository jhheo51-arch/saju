import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const checker = join(root, "scripts", "check-harness.mjs");
const requiredFiles = [
  "AGENTS.md",
  "harness.md",
  "docs/PRD.md",
  "docs/status.md",
  "docs/specs/037-saju-evaluation-harness.md",
  "docs/specs/038-explicit-harness-system.md",
  "evals/saju-answer-cases.json",
  "evals/run_saju_evals.py",
  ".github/workflows/quality.yml",
  "package.json",
];

function check(targetRoot: string) {
  return spawnSync(process.execPath, [checker, "--root", targetRoot], {
    cwd: root,
    encoding: "utf8",
  });
}

test("현재 저장소의 명시적 하네스 연결은 PASS한다", () => {
  const run = check(root);
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /\[HARNESS PASS\]/);
});

test("필수 check:harness 연결을 제거한 임시 루트는 FAIL한다", () => {
  const temp = mkdtempSync(join(tmpdir(), "saju-explicit-harness-"));
  try {
    for (const relative of requiredFiles) {
      const target = join(temp, relative);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(root, relative), target);
    }
    const packagePath = join(temp, "package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
    pkg.scripts.harness = "npm run check && npm run eval:saju";
    writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

    const run = check(temp);
    assert.equal(run.status, 1, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stderr, /\[HARNESS FAIL\]/);
    assert.match(run.stderr, /harness 명령 연결 없음: npm run check:harness/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("package·AGENTS·harness 계약과 CI가 같은 게이트를 가리킨다", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
  const contract = readFileSync(join(root, "harness.md"), "utf8");
  const workflow = readFileSync(join(root, ".github", "workflows", "quality.yml"), "utf8");

  assert.equal(pkg.scripts["check:harness"], "node scripts/check-harness.mjs");
  assert.equal(pkg.scripts.harness, "npm run check:harness && npm run check && npm run eval:saju");
  assert.match(agents, /작업 흐름과 완료 기준은 프로젝트 루트의 `harness\.md`/);
  assert.match(agents, /코드나 프롬프트를 바꾼 뒤에는 `npm run harness`/);
  assert.match(contract, /`npm run check:harness`/);
  assert.match(contract, /FAIL이면 수정·재실행/);
  assert.match(workflow, /- run:\s*npm run harness/);
  assert.match(workflow, /- run:\s*npm run build/);
});
