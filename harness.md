# 사주 서비스 하네스

이 문서는 아이디어가 검증된 변경으로 끝나는 과정을 설명하는 프로젝트의 하네스 계약입니다. 설명만 있는 체크리스트가 아니라 아래 파일과 명령으로 실제 연결됩니다.

## 피드백 루프

`요청 → PRD/Spec → 구현 → npm run harness → FAIL이면 수정·재실행 → PASS이면 npm run build → 완료 기록`

## 구성

| 층 | 실제 연결 |
|---|---|
| Context | `AGENTS.md`, `docs/PRD.md`, 관련 `docs/specs/*.md` |
| Agent loop | 요구 이해 → 작은 구현 → 독립 테스트 → 전체 검증 → 실패 수정 |
| Tool routing | npm, TypeScript, Node.js, Python 평가기, GitHub Actions |
| State | `docs/status.md`, Spec 검증 기록, `evals/reports/latest.json`, 루트 `작업일지.md` |
| Guardrails | 사주 계산은 `lib/saju`, Gemini 키는 서버 환경변수, 개인정보·확정 예언 금지 |
| Validation | `check:harness` → 타입·테스트 → 고정 사주 평가 → 프로덕션 빌드 |
| Subagent | 코드 변경 시 구현을 맡지 않은 서브에이전트가 관련 테스트를 작성·보강 |
| Environment | 저장소 파일, PowerShell/CI 셸, Gemini API, Supabase DB |

## 실행 명령

- `npm run check:harness` — 필수 문서·스크립트·평가·CI 연결이 끊기지 않았는지 검사합니다.
- `npm run check` — TypeScript 타입 검사와 전체 자동 테스트를 실행합니다.
- `npm run eval:saju` — 고정된 대표 답변의 품질 판정과 오류 코드를 비교합니다.
- `npm run harness` — 위 세 검사를 순서대로 한 번에 실행합니다.
- `npm run build` — Next.js 프로덕션 빌드 가능 여부를 확인합니다.

GitHub Actions의 `.github/workflows/quality.yml`도 `npm run harness`와 `npm run build`를 그대로 실행합니다.

## 완료 조건

1. 관련 Spec의 완료 조건이 충족됩니다.
2. 독립 테스트가 추가되거나 기존 테스트가 충분한지 확인됩니다.
3. `npm run harness`와 `npm run build`가 모두 PASS입니다.
4. 실패 원인과 수정 결과를 Spec에 기록합니다.
5. `docs/status.md`와 루트 `작업일지.md`를 실제 상태로 갱신합니다.

## 실패 처리

- `check:harness` FAIL: 누락된 파일, 스크립트, CI 연결을 복구합니다.
- 타입·테스트 FAIL: 구현과 테스트 기대값 중 무엇이 틀렸는지 확인해 수정합니다.
- 사주 평가 FAIL: 사례의 계산 근거, 구조, 개인화, 안전 규칙을 확인합니다.
- 빌드 FAIL: 실행 환경과 Next.js 빌드 오류를 해결합니다.
- 실패를 건너뛰거나 성공으로 기록하지 않습니다.

고정 평가 사례는 실시간 Gemini 품질을 보장하지 않습니다. 실호출과 사용자 말맛 평가는 별도 검증으로 구분합니다.

