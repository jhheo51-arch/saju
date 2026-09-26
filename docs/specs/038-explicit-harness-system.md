# 038-explicit-harness-system — 명시적 하네스 시스템

작성일: 2026-09-26  
상태: 구현·자동 검증 완료

## 목적

문서, 코드 검사, 사주 답변 평가, CI가 따로 존재하는 상태를 벗어나 프로젝트 루트 `harness.md`와 한 개의 실행 명령으로 연결합니다. 현재 연결 상태와 실패 반환 경로를 첨부 레퍼런스와 같은 교육용 인포그래픽으로 보여줍니다.

## 범위

1. `harness.md`에 Context, Agent loop, Tool routing, State, Guardrails, Validation, Subagent, Environment를 실제 파일과 명령으로 기록합니다.
2. `scripts/check-harness.mjs`가 필수 파일·npm 스크립트·CI 연결을 결정적으로 검사합니다.
3. `npm run harness`가 계약 검사, 타입·테스트, 고정 사주 평가를 순서대로 실행합니다.
4. `AGENTS.md`가 `harness.md`와 FAIL 재실행 규칙을 참조합니다.
5. `docs/diagrams/saju-harness-workflow.html`과 PNG가 사람→명세→에이전트→구현, 검증 PASS/FAIL, Model/Harness/Environment의 관계를 보여줍니다.
6. 개인 전역 Codex 스킬 `harness`가 같은 구축·검사·시각화 규칙을 재사용합니다.

## 완료 조건

- `npm run check:harness`가 현재 저장소에서 PASS하고 의도적으로 연결을 제거한 임시 저장소에서는 FAIL합니다.
- `npm run harness`와 `npm run build`가 PASS합니다.
- 전역 스킬 구조 검사가 PASS합니다.
- HTML 다이어그램의 접근성·기하 검사가 PASS하고 PNG를 열어 글자와 연결선을 확인합니다.
- 실제로 존재하지 않는 실시간 Gemini 평가를 자동 하네스라고 표현하지 않습니다.

## 검증 기록

- 독립 테스트는 현재 저장소 PASS, `check:harness` 연결을 제거한 임시 루트 FAIL, package·AGENTS·계약·CI 연결을 확인했습니다. 새 명시적 하네스 검사 3개와 갱신된 평가 하네스 검사 4개가 모두 통과했습니다.
- 전체 `npm run harness`는 계약 검사, 타입 검사, 자동 테스트 181/181, 고정 사주 평가 7/7을 통과했습니다. `npm run build`와 `git diff --check`도 통과했습니다.
- 다이어그램 HTML은 전용 접근성·구조 검사와 연결선 기하 검사에서 오류가 없었고, 같은 1200×630 SVG를 내보냈습니다. PNG용 Playwright가 설치되어 있지 않아 환경을 임의 변경하지 않고 SVG를 결과 이미지로 사용했습니다.
- 전역 `harness` 스킬은 `SKILL.md`, `agents/openai.yaml`, `references/harness.md`의 구조·메타데이터·참조 연결을 검사했습니다. 공식 검사 스크립트는 현재 Python에 PyYAML이 없어 실행하지 못했으며, 같은 필수 항목을 로컬 구조 검사로 확인했습니다.
- 고정 사례 평가는 실시간 Gemini 품질을 보장하지 않으며, 실제 로그인 응답과 사용자 말맛 확인은 별도입니다.
- 사용자 피드백에 따라 시각화를 레퍼런스와 같은 600×296 구도로 다시 작성했습니다. 큰 외부 제목·설명·푸터를 제거하고 사람→`harness.md`→에이전트→구현 결과, 위 `AGENTS.md`, 아래 FAIL/PASS, 오른쪽 Agent System의 위치와 밀도를 맞췄습니다. 실제 브라우저 렌더링에서 겹침을 수정한 뒤 다이어그램 검사, 하네스 181/181, 평가 7/7, 빌드를 다시 통과했습니다.
- 공개 `saju`에는 비공개 `saju-service`의 최신 커밋 `c411bc5`가 이미 조상 커밋으로 포함되어 있음을 확인했습니다. 앱을 하위 폴더로 다시 복사하거나 비공개 저장소를 서브모듈로 연결하면 중복 또는 접근 불가가 생기므로, 저장소 중첩은 적용하지 않았습니다.
