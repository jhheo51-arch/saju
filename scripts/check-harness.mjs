import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootArg = process.argv.indexOf("--root");
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const failures = [];

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`필수 파일 없음: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8");
}

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
];

const contents = Object.fromEntries(requiredFiles.map((file) => [file, read(file)]));
const packageText = read("package.json");
let packageJson;
try {
  packageJson = JSON.parse(packageText);
} catch {
  failures.push("package.json을 읽을 수 없음");
  packageJson = { scripts: {} };
}

for (const script of ["check", "check:harness", "eval:saju", "harness", "build"]) {
  if (!packageJson.scripts?.[script]) failures.push(`npm 스크립트 없음: ${script}`);
}

const harnessCommand = packageJson.scripts?.harness ?? "";
for (const command of ["npm run check:harness", "npm run check", "npm run eval:saju"]) {
  if (!harnessCommand.includes(command)) failures.push(`harness 명령 연결 없음: ${command}`);
}

const workflow = contents[".github/workflows/quality.yml"];
for (const command of ["npm run harness", "npm run build"]) {
  if (!workflow.includes(command)) failures.push(`CI 명령 연결 없음: ${command}`);
}

if (!contents["AGENTS.md"].includes("harness.md")) failures.push("AGENTS.md에서 harness.md를 참조하지 않음");
if (!contents["harness.md"].includes("FAIL이면 수정·재실행")) failures.push("harness.md에 실패 재실행 규칙이 없음");

if (failures.length > 0) {
  console.error("[HARNESS FAIL]");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`[HARNESS PASS] ${requiredFiles.length + 1}개 파일과 명령 연결을 확인했습니다.`);

