# Status

Spec을 만들면 아래 목록에 파일명을 추가합니다. 구현과 검증이 모두 끝난 뒤에만 체크합니다.

## 기능 진행 상황

<!-- 예시: - [ ] `001-save-results.md` -->

- [x] `001-prototype-flow.md` — 입력과 결과 화면 흐름 프로토타입
- [x] `002-easy-terms.md` — 어려운 사주 용어 쉬운 설명
- [x] `003-inline-term-help.md` — 사주 용어를 눌러 뜻 보기
- [x] `004-term-meaning-copy.md` — 위치가 아닌 사주 용어의 뜻 설명
- [x] `005-gemini-interpretation.md` — Gemini 해석과 브라우저 최근 결과 1건 저장(구현·자동 검증, 참가자 확인 전)
- [x] `006-direct-question-answer.md` — 궁금한 점에 먼저 답하기(구현·자동 검사 완료, 새 질문의 화면 확인 전)
- [ ] `007-google-sign-in.md` — Google 로그인
- [ ] `008-account-result-storage.md` — 계정에 최근 해석 1건 저장
- [x] `009-chart-grounded-reading.md` — 질문 입력을 없애고 계산 근거 중심으로 쉽게 풀이(자동·로컬 확인, 참가자 확인 전)
- [ ] `010-palace-visual-theme.md` — 궁궐 사진을 참고한 화면 디자인
- [x] `011-nine-reading-topics.md` — 관심 주제 9개와 주제별 풀이(자동·로컬 확인, 참가자 확인 전)
- [x] `012-saju-avatar-prototype.md` — 사주 기반 비인간 아바타와 첨부 그림 배경(자동·로컬 확인, 참가자 확인 전)
- [ ] `013-topic-labels-and-hero-copy.md` — 주제 이름 변경과 제목 설명 줄바꿈
- [ ] `014-palace-palette-and-gungsuh-type.md` — 지정 색상·글꼴 변경 취소, 이전 테마 복구
- [x] `015-cute-service-theme.md` — 서비스 전체의 귀엽고 친근한 화면 분위기(자동·로컬 확인, 참가자 확인 전)
- [ ] `016-five-element-avatar-relations.md` — 궁궐형 오행 아바타 5개와 개인별 역할 이야기(구현·아바타 검사 완료, 전체 검사 대기)
- [x] `017-personalized-reading-prompt.md` — 계산 근거와 생활 장면을 잇는 개인화 프롬프트(자동·가상 입력 확인, 참가자 확인 전)
- [ ] `018-element-graph-section.md` — 당시 독립된 03 그래프 영역 기록(020에서 화면 제거)
- [ ] `019-avatar-copy-and-simple-background.md` — 아바타 문장 줄바꿈과 단순한 배경
- [x] `020-weekly-fortune-no-graph.md` — 오행 칸 그래프 제거와 이번 주 운세 추가(자동·로컬 확인, 참가자 확인 전)
- [x] `021-structured-reading-sections.md` — 계산 근거·쉬운 뜻·생활 장면·균형·작은 행동으로 풀이 구조화(자동·로컬 확인, 참가자 확인 전)
- [x] `022-fortune-visual-cues.md` — 운세 근거 배지·한 걸음·절기 주간 띠(자동·로컬 확인, 참가자 확인 전)
- [x] `023-compact-element-radar.md` — 계산 근거의 오행 5축 방사형 그래프(자동·로컬 확인, 참가자 확인 전)
- [x] `024-personal-context-selects.md` — 현재 상황과 원하는 방향을 선택해 주제 풀이에 반영(자동·로컬 확인, 참가자 확인 전)
- [x] `024-radar-basis-layout.md` — 그래프 왼쪽·일간/월주 오른쪽 배치와 한자 축(자동·로컬 확인, 참가자 확인 전)
- [x] `026-basis-card-details.md` — 일간·월주 글자 구조 배지와 카드 여백 정리(자동·PC·375px·가로 화면 확인, 참가자 확인 전)
- [x] `027-yinyang-season-grounding.md` — 여덟 글자의 음양 분포와 월지 계절을 풀이 근거로 확장(자동·실제 Gemini·PC·모바일 확인, 참가자 확인 전)
- [x] `025-readable-term-popover-daily-fortune.md` — 용어 설명 줄바꿈과 날짜 선택 운세(자동·로컬 확인, 참가자 확인 전)
- [ ] `028-daily-fun-cues.md` — 오늘 카드 여백 정리와 재미용 색상·숫자
- [x] `029-element-count-summary.md` — 방사형 그래프 아래 오행 글자 수 요약(자동·로컬 확인, 참가자 확인 전)
- [x] `029-all-saju-term-help.md` — 무자·을유 등 실제 네 기둥 이름과 모든 사주 용어 설명 연결(자동·PC·375px 확인, 참가자 확인 전)
- [ ] `030-login-required-reading.md` — Google 로그인 사용자만 해석 생성·결과 열람 허용(코드·자동·로그아웃 화면 확인, 실제 Google 로그인 후 생성 확인 전)
- [x] `032-follow-up-question-answer.md` — 실제 일간·월주·음양·계절 근거로 개인화해 질문 답변·작은 행동 받기(자동·빌드 확인, 로그인 사용자 화면 확인 전)
- [x] `033-palace-noble-helper.md` — 천을귀인 계산과 한국적인 관계 장면을 담은 궁궐 귀인전(자동·빌드·PC·375px 미리보기 확인, 로그인 사용자·참가자 확인 전)
- [ ] `031-five-element-colors.md` — 오행 그래프의 축·점·정확한 값에 고유색 적용(구현·자동 검사 완료, 로그인 후 참가자 화면 확인 전)
- [x] `034-yongshin-balance-cards.md` — 간이 억부용신 기준의 용신·희신·기신 카드(자동·빌드 확인, 로그인 후 참가자 화면 확인 전)
- [x] `035-saju-answer-review-skill.md` — 계산 근거·개인화·안전성을 반복 검사하는 Codex 스킬(자동 검증 완료)
- [x] `036-narrative-saju-reading.md` — 계산 단서를 상담처럼 자연스럽고 구체적인 이야기로 연결하는 전체 풀이 개선(자동·빌드 확인, 로그인 사용자 화면 확인 전)
- [x] `037-saju-evaluation-harness.md` — 대표 답변 데이터셋과 품질 판정·리포트·CI를 잇는 평가 하네스(자동·빌드·다이어그램 검사 완료)
- [x] `038-explicit-harness-system.md` — 프로젝트 계약·자체 검사·CI·피드백 루프를 명시적으로 연결하고 인포그래픽으로 시각화(자동·빌드·다이어그램 검사 완료)
- [x] `039-visualization-method-comparison.md` — Data·Figma·GitHub 스킬로 하네스 시각화 3종을 만들고 비교
- [x] `040-reference-harness-visual.md` — 첨부 레퍼런스와 같은 밀도·구도의 단일 하네스 그림으로 재작성
