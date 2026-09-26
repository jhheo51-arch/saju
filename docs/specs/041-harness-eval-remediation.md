# 041-harness-eval-remediation — 하네스 평가 결과 반영

- 작성일: 2026-09-26
- 상태: 완료

## 목적

`harness-eval`의 Track B·C 합의 보고서에서 확정된 중복 지침과 오래된 PRD 내용을 제거하되, 행동을 바꾸는 프로젝트 계약은 유지한다.

## 변경 범위

- Track B `Ship` 4건만 `AGENTS.md`와 사주 답변 검사 스킬에서 제거한다.
- Track B `Review`와 `Hold` 항목은 변경하지 않는다.
- Track C `11-mixed-apply.md`의 KEEP/CUT 계획에 따라 `docs/PRD.md`만 정리한다.
- `AGENTS.md`, 답변 검사 스킬, `docs/status.md`, `harness.md`의 Keep-core 계약은 유지한다.

## 완료 기준

- Track B `Ship` 문장이 제거된다.
- PRD의 현재 제품 계약과 미완료 범위는 유지되고, 오래된 프로토타입 목표·테스트·완료 일기는 제거된다.
- 전체 하네스와 프로덕션 빌드가 통과한다.

## 검증

- Track B `Ship` 4개 문장 제거 확인
- Track C `11-mixed-apply.md`의 KEEP 계약 유지와 CUT 범위 제거 확인
- 수정 후 Track A 재실행: 깨진 경로·명령 0건, 정상 경로 18건
- 전체 테스트 187/187, 사주 평가 7/7 통과
- `npm run harness`, `npm run build`, `git diff --check` 통과
