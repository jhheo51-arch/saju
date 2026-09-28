# 051-local-supabase-runtime — 로컬 Supabase 설정 오류 복구

작성일: 2026-09-28  
상태: 구현·자동 검사·운영 빌드 완료, 로그인 화면 확인 대기

## 문제

Vercel Production 환경변수는 비밀값을 다시 내려받을 수 없어, 로컬 `.env.local`에 `[SENSITIVE]` 자리표시자가 생깁니다. 이 값이 Supabase URL로 전달되면 페이지가 시작 단계에서 런타임 오류로 중단됩니다.

## 해결 원칙

- URL·공개 키가 없거나 자리표시자이면 Supabase 클라이언트를 만들지 않고 로그인 설정 안내로 안전하게 전환합니다.
- 로컬 개발에서만 `DAILY_FORTUNE_LOCAL_PROXY_ORIGIN`을 명시했을 때, 오늘 운세의 인증 요청을 운영 API로 중계합니다.
- 운영 배포와 Cron은 이 개발 전용 설정을 사용하지 않습니다.
- 비밀값은 코드, Git, 문서에 기록하지 않습니다.

## 완료 조건

- `[SENSITIVE]` 설정으로 `Invalid supabaseUrl` 오류가 나지 않는다.
- 로컬에서 공개 로그인 설정과 오늘 운세 API 호출 경로를 확인할 수 있다.
- Production API, Cron 보안, 기존 오늘·이번 주 운세 흐름이 유지된다.
- TypeScript, 관련 자동 테스트, 품질 하네스, Production 빌드가 통과한다.

## 검증 결과

- TypeScript 검사 통과
- 자동 테스트 213개 통과
- 품질 하네스 11개 연결 및 사주 평가 10/10 통과
- Production 빌드 통과
- 로컬 `/`은 HTTP 200, 로그인 전 오늘 운세 조회는 기대한 HTTP 401을 응답함
