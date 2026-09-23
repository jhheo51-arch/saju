"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { calculate, InputError, type SajuChart, type SajuInput } from "../lib/saju/chart";
import { clearAccountResult, loadAccountResult, saveAccountResult } from "../lib/saju/account-storage";
import { basicTerms, stemTerms, tenStars } from "../lib/saju/glossary";
import { isReadingTopic, koreaDate, koreaWeekRange, type Interpretation, type ReadingTopic } from "../lib/saju/interpretation";
import { clearLatestResult, loadLatestResult, saveLatestResult } from "../lib/saju/interpretation-storage";
import { getSajuSupabaseClient } from "../lib/saju/supabase-client";
import { readingTopics as topics } from "../lib/saju/topics";
import { avatarForChart, palaceStoryForChart } from "../lib/saju/avatar";

const glossary = [...basicTerms, ...tenStars, ...stemTerms];

type SajuTerm = (typeof glossary)[number]["term"];
type DisplayResult = { chart: SajuChart; topic: ReadingTopic; reading: Interpretation | null; createdAt?: string };
const termPattern = new RegExp(`(${glossary.map((entry) => entry.term).join("|")})`, "g");
class ServerMessageError extends Error {}

function TermHelp({ term, id }: { term: SajuTerm; id: string }) {
  const meaning = glossary.find((entry) => entry.term === term)!.meaning;

  return (
    <>
      <button type="button" className="term-trigger" popoverTarget={id} aria-label={`${term} 뜻 보기`}>
        {term}
      </button>
      <span id={id} popover="auto" className="term-popover" role="note" aria-label={`${term}의 뜻`}>
        <strong>{term}</strong>
        <span className="term-meaning">{meaning}</span>
        <button type="button" className="term-close" popoverTarget={id} popoverTargetAction="hide">닫기</button>
      </span>
    </>
  );
}

function ExplainedText({ text, id }: { text: string; id: string }) {
  return <>{text.split(termPattern).map((part, index) => {
    const known = glossary.find((entry) => entry.term === part);
    return known ? <TermHelp key={`${id}-${index}`} term={known.term} id={`${id}-${index}`} /> : <span key={`${id}-${index}`}>{part}</span>;
  })}</>;
}

export default function SajuForm() {
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasStoredResult, setHasStoredResult] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accountConfigured, setAccountConfigured] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [retryInput, setRetryInput] = useState<SajuInput | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarSaveError, setAvatarSaveError] = useState("");
  const pending = useRef(false);
  const avatarCardRef = useRef<HTMLElement | null>(null);
  const accountClient = useRef<SupabaseClient | null>(null);

  async function downloadAvatar() {
    if (!avatarCardRef.current || !avatar || avatarSaving) return;
    setAvatarSaving(true);
    setAvatarSaveError("");
    try {
      await document.fonts.ready;
      const { toPng } = await import("html-to-image");
      const image = await toPng(avatarCardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#fffdf8",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `나의-사주-아바타-${avatar.element}.png`;
      link.href = image;
      link.click();
    } catch {
      setAvatarSaveError("이미지를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setAvatarSaving(false);
    }
  }

  useEffect(() => {
    let active = true;
    let revision = 0;
    const client = getSajuSupabaseClient();
    accountClient.current = client;
    setAccountConfigured(Boolean(client));

    function restoreBrowserResult() {
      try {
        const saved = loadLatestResult(window.localStorage);
        if (saved) {
          setResult({ chart: saved.chart, topic: saved.topic, reading: saved.reading, createdAt: saved.createdAt });
          setHasStoredResult(true);
          setNotice("이 브라우저에 저장된 최근 해석을 불러왔어요.");
        }
      } catch {
        // 브라우저 저장소를 사용할 수 없어도 새 해석은 시도할 수 있습니다.
      }
    }

    if (!client) {
      restoreBrowserResult();
      setReady(true);
      return;
    }

    async function refreshAccount(restoreGuest: boolean) {
      const current = ++revision;
      let nextUser: User | null = null;
      let sessionFailed = false;
      try {
        const { data: sessionData, error: sessionError } = await client!.auth.getSession();
        if (sessionError) sessionFailed = true;
        else if (sessionData.session) {
          const { data, error: userError } = await client!.auth.getUser();
          nextUser = userError ? null : data.user;
          sessionFailed = Boolean(userError);
        }
      } catch {
        sessionFailed = true;
      }
      if (!active || current !== revision) return;
      setUser(nextUser);
      setResult(null);
      setHasStoredResult(false);
      setRetryInput(null);
      if (sessionFailed) setAuthError("로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.");
      else setAuthError("");

      if (nextUser) {
        try {
          const saved = await loadAccountResult(client!, nextUser.id);
          if (!active || current !== revision) return;
          if (saved) {
            setResult({ chart: saved.chart, topic: saved.topic, reading: saved.reading, createdAt: saved.createdAt });
            setHasStoredResult(true);
            setNotice("계정에 저장된 최근 해석을 불러왔어요.");
          } else {
            setNotice("계정에 저장된 해석이 아직 없어요. 새 해석을 만들어보세요.");
          }
        } catch (caught) {
          if (!active || current !== revision) return;
          setError(caught instanceof Error ? caught.message : "계정 결과를 불러오지 못했어요.");
        }
      } else if (restoreGuest) {
        restoreBrowserResult();
      }
      if (active && current === revision) setReady(true);
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => { if (active) void refreshAccount(false); }, 0);
      }
    });
    void refreshAccount(true);
    return () => {
      active = false;
      revision++;
      subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    const client = accountClient.current;
    if (!client) {
      setAuthError("Google 로그인 설정이 필요해요.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const { error: signInError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (signInError) setAuthError("Google 로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
    } catch {
      setAuthError("Google 로그인에 연결하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    const client = accountClient.current;
    if (!client) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) setAuthError("로그아웃하지 못했어요. 다시 시도해주세요.");
      else {
        setUser(null);
        setResult(null);
        setHasStoredResult(false);
        setNotice("로그아웃했어요. 계정의 해석은 이 화면에서 숨겼어요.");
      }
    } catch {
      setAuthError("로그아웃에 연결하지 못했어요. 다시 시도해주세요.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function requestReading(input: SajuInput) {
    if (pending.current || !isReadingTopic(input.topic)) return;
    pending.current = true;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new ServerMessageError(typeof data.error === "string" ? data.error : "해석을 만들지 못했습니다. 다시 시도해주세요.");
      const createdAt = new Date().toISOString();
      const next: DisplayResult = { chart: data.chart, topic: input.topic, reading: data.reading, createdAt };
      setResult(next);
      setHasStoredResult(false);
      setRetryInput(null);
      try {
        const saved = { version: 1 as const, createdAt, chart: data.chart, topic: input.topic, reading: data.reading };
        if (user && accountClient.current) await saveAccountResult(accountClient.current, user.id, saved);
        else saveLatestResult(window.localStorage, saved);
        setHasStoredResult(true);
        setNotice(user ? "최근 해석 1건을 계정에 저장했어요." : "최근 해석 1건을 이 브라우저에 저장했어요.");
      } catch {
        setNotice(user ? "해석은 만들었지만 계정에 저장하지 못했어요. 이전 저장본은 그대로 남아 있을 수 있어요." : "이번 해석은 이 브라우저에 저장하지 못했어요. 이전 저장본은 그대로 남아 있을 수 있어요.");
      }
    } catch (caught) {
      setError(caught instanceof ServerMessageError
        ? caught.message
        : "연결이 끊겼거나 해석을 확인하지 못했어요. 다시 시도해주세요.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    const selectedTopic = topics.find((topic) => topic.value === data.get("topic"));

    if (!selectedTopic) {
      setResult(null);
      setRetryInput(null);
      setError("관심 있는 주제를 하나 골라주세요.");
      return;
    }

    const input: SajuInput = {
      date: String(data.get("date") || ""),
      time: String(data.get("time") || ""),
      calendar: "solar",
      topic: selectedTopic.value,
    };

    try {
      const chart = calculate(input);
      setResult({ chart, topic: selectedTopic.value, reading: null });
      setRetryInput(input);
      setError("");
      void requestReading(input);
    } catch (caught) {
      setResult(null);
      setRetryInput(null);
      setError(
        caught instanceof InputError
          ? caught.message
          : "계산하지 못했습니다. 입력을 확인해주세요.",
      );
    }
  }

  async function deleteSaved() {
    try {
      if (user && accountClient.current) await clearAccountResult(accountClient.current, user.id);
      else clearLatestResult(window.localStorage);
      setResult(null);
      setHasStoredResult(false);
      setNotice(user ? "계정에 저장된 해석을 삭제했어요." : "이 브라우저에 저장된 해석을 삭제했어요.");
    } catch {
      setError("저장된 해석을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  const selectedTopic = topics.find((topic) => topic.value === result?.topic);
  const avatar = result ? avatarForChart(result.chart) : null;
  const palaceStory = result ? palaceStoryForChart(result.chart) : null;
  const today = result?.reading?.today.date || koreaDate();
  const currentWeek = koreaWeekRange(koreaDate());
  const olderReading = Boolean(result?.reading && (
    !result.reading.personality.body.includes(`${result.chart.dayMaster.korean}${result.chart.dayMaster.element}`) ||
    !result.reading.topic.body.includes(result.chart.pillars[1].korean)
  ));

  return (
    <>
      <section className="account-card" aria-label="계정 저장">
        <div>
          <strong>{user ? "계정에 해석을 저장할 수 있어요" : "결과를 계정에 보관하고 싶나요?"}</strong>
          <p>{user ? `${user.email || "Google 계정"} · 최근 해석 1건을 계정에 저장합니다.` : "Google로 로그인하면 다른 기기에서도 최근 해석 1건을 볼 수 있어요. 로그인 없이도 해석할 수 있습니다."}</p>
        </div>
        {user
          ? <button type="button" className="account-button secondary" onClick={() => void signOut()} disabled={!ready || authBusy}>로그아웃</button>
          : <button type="button" className="account-button" onClick={() => void signInWithGoogle()} disabled={!ready || authBusy || !accountConfigured}>{authBusy ? "로그인 준비 중…" : "Google로 로그인"}</button>}
        {!accountConfigured && ready && <p className="account-error">Google 로그인 연결 설정이 필요해요.</p>}
        {authError && <p className="account-error" role="alert">{authError}</p>}
      </section>
      <section className="input-card" aria-labelledby="input-title">
        <div className="section-heading">
          <span className="section-step">01</span>
          <div>
            <h2 id="input-title">먼저, 나의 기본 정보</h2>
            <p className="form-intro">양력 생년월일과 정확한 출생시간을 입력하면, 계산 결과를 쉬운 말로 풀어드려요.</p>
          </div>
        </div>

        <form method="post" onSubmit={handleSubmit}>
          <div className="birth-fields">
            <div className="field">
              <label htmlFor="date">생년월일</label>
              <input id="date" name="date" type="date" required />
            </div>
            <div className="field">
              <label htmlFor="time">출생시간</label>
              <input id="time" name="time" type="time" required />
            </div>
          </div>

          <fieldset className="topic-field">
            <legend>지금 궁금한 주제</legend>
            <div className="topic-options">
              {topics.map((topic) => (
                <label className="topic-option" key={topic.value}>
                  <input type="radio" name="topic" value={topic.value} required />
                  <span>
                    <strong>{topic.label}</strong>
                    <small>{topic.detail}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit" disabled={loading || !ready}>{!ready ? "화면을 준비하고 있어요…" : loading ? "해석을 만들고 있어요…" : "나의 사주 해석 보기"}</button>
        </form>
      </section>

      <div className="feedback" aria-live="polite">
        {error && <p className="error" role="alert">{error}</p>}
        {error && retryInput && !loading && <button type="button" className="retry-button" onClick={() => void requestReading(retryInput)}>다시 시도</button>}
        {notice && <p className="notice">{notice}</p>}
        {result && (<>
          <section className="preview" aria-labelledby="preview-title" aria-busy={loading}>
            <div className="preview-header">
              <span className="section-step">02</span>
              <div>
                <p className="eyebrow">{result.reading ? "나의 사주 이야기" : "사주 계산 완료"}</p>
                <h2 id="preview-title">{result.reading ? "쉽게 읽는 나의 사주" : "해석을 준비하고 있어요"}</h2>
                <p>전통적인 사주 상징을 재미와 자기 성찰을 위한 이야기로 풀었습니다. 성격이나 미래를 확정하는 결과는 아니에요.</p>
                {result.reading && hasStoredResult && <button type="button" className="delete-button" onClick={() => void deleteSaved()}>저장된 결과 삭제</button>}
              </div>
            </div>

            <section className="chart-basis" aria-label="이번 풀이에 사용한 사주 정보">
              <p className="chart-basis-title">이번 풀이의 근거</p>
              <div className="chart-basis-items">
                <p><span>나를 대표하는 글자 · <TermHelp term="일간" id="basis-day-master-help" /></span><strong><ExplainedText text={`${result.chart.dayMaster.korean}${result.chart.dayMaster.element}`} id="basis-day-master-name" /></strong></p>
                <p><span>태어난 달의 두 글자 · <TermHelp term="월주" id="basis-month-pillar-help" /></span><strong>{result.chart.pillars[1].korean} <small>({result.chart.pillars[1].stemElement}·{result.chart.pillars[1].branchElement})</small></strong></p>
                <p><span>여덟 글자의 <TermHelp term="오행" id="basis-elements-help" /></span><strong>{Object.entries(result.chart.elements).map(([element, count]) => `${element} ${count}`).join(" · ")}</strong></p>
              </div>
              <p className="chart-basis-note">오행 숫자는 글자 수예요. 이것만으로 성격의 강약이나 미래를 정할 수는 없어요.</p>
            </section>

            {olderReading && <p className="date-note">이 결과는 이전 방식으로 만든 해석이에요. 위에서 생년월일과 시간을 다시 입력하면 계산 근거를 반영한 새 풀이를 볼 수 있어요.</p>}

            <div className="preview-cards">
              <section className="preview-card" aria-labelledby="personality-title">
                <p className="card-index">01 · 나를 알아보기</p>
                <h3 id="personality-title">{result.reading ? <ExplainedText text={result.reading.personality.headline} id="personality-head" /> : "나의 성향 카드"}</h3>
                <p>{result.reading ? <ExplainedText text={result.reading.personality.body} id="personality-body" /> : "계산 결과를 쉬운 말로 풀고 있어요."}</p>
                {!result.reading && <span className="pending-label">{loading ? "해석 중" : "해석을 다시 시도할 수 있어요"}</span>}
              </section>
              <section className="preview-card" aria-labelledby="topic-title">
                <p className="card-index">02 · 관심 주제</p>
                <h3 id="topic-title">{result.reading ? <ExplainedText text={result.reading.topic.headline} id="topic-head" /> : `${selectedTopic?.label} 이야기`}</h3>
                <p>{result.reading ? <ExplainedText text={result.reading.topic.body} id="topic-body" /> : `${selectedTopic?.detail}에 관한 풀이를 준비하고 있어요.`}</p>
                {!result.reading && <span className="pending-label">{loading ? "해석 중" : "해석을 다시 시도할 수 있어요"}</span>}
              </section>
            </div>

            <details className="raw-chart">
              <summary>계산된 사주 원자료 보기</summary>
              <p className="raw-intro">아래 네 쌍은 기존 코드가 계산한 값입니다. 밑줄 친 단어를 누르면 뜻이 나와요.</p>
              <dl className="pillars">
                {result.chart.pillars.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>
                      <div className="pillar-part">
                        <span className="pillar-label"><TermHelp term="천간" id={`${item.label}-stem-help`} /> · 윗글자</span>
                        <strong>{item.korean[0]} ({item.stem})</strong>
                      </div>
                      <div className="pillar-part">
                        <span className="pillar-label"><TermHelp term="지지" id={`${item.label}-branch-help`} /> · 아랫글자</span>
                        <strong>{item.korean[1]} ({item.branch})</strong>
                      </div>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="note">계산 기준: {result.chart.method}</p>
            </details>
          </section>

          <section className="preview visual-preview" aria-labelledby="visual-title">
            <div className="preview-header">
              <span className="section-step">03</span>
              <div>
                <p className="eyebrow">사주에서 만난 캐릭터</p>
                <h2 id="visual-title">나의 아바타</h2>
                <p>태어난 날의 오행에서 영감을 받은 캐릭터를 만나보세요.</p>
              </div>
            </div>

            {avatar && palaceStory && <section ref={avatarCardRef} className="avatar-card" aria-labelledby="avatar-title">
              <div className="avatar-scene">
                <Image
                  src={avatar.image}
                  alt={`${avatar.element}에서 영감을 받은 ${avatar.name} 캐릭터`}
                  fill
                  sizes="(max-width: 680px) 100vw, 420px"
                  className="avatar-figure"
                />
              </div>
              <div className="avatar-details">
                <p className="card-index">나의 아바타</p>
                <h3 id="avatar-title">{avatar.name}</h3>
                <p className="avatar-basis">계산된 일간의 오행 <strong>{avatar.element}</strong>에서 영감을 받은 귀여운 궁궐 이야기예요.</p>
                <dl className="avatar-facts">
                  <div><dt>궁궐 역할</dt><dd>{palaceStory.role}</dd></div>
                  <div><dt>맡은 일</dt><dd>{palaceStory.duty}</dd></div>
                  <div><dt>함께할 기운</dt><dd>{palaceStory.teamwork}</dd></div>
                </dl>
                <p className="avatar-disclaimer">궁궐 역할은 실제 직업·신분·성별을 알아낸 결과가 아닌 창작 설정입니다. 오행 관계도 전통 상징을 쉽게 풀어본 참고이며 실제 궁합이나 인간관계를 확정하지 않아요.</p>
              </div>
            </section>}
            {avatar && palaceStory && <div className="avatar-download-actions">
              <button type="button" onClick={downloadAvatar} disabled={avatarSaving}>
                {avatarSaving ? "이미지 만드는 중…" : "아바타 카드 이미지로 저장"}
              </button>
              {avatarSaveError && <p role="alert">{avatarSaveError}</p>}
            </div>}

          </section>

          <section className="preview today-preview" aria-labelledby="today-section-title" aria-busy={loading}>
            <div className="preview-header">
              <span className="section-step">04</span>
              <div>
                <p className="eyebrow">하루와 한 주를 가볍게 읽기</p>
                <h2 id="today-section-title">오늘과 이번 주 운세</h2>
              </div>
            </div>
            <div className="preview-cards today-cards">
              <section className="preview-card" aria-labelledby="today-title">
                <p className="card-index">오늘의 운세 · {today}</p>
                <h3 id="today-title">{result.reading ? <ExplainedText text={result.reading.today.headline} id="today-head" /> : "오늘의 운세"}</h3>
                <p>{result.reading ? <ExplainedText text={result.reading.today.body} id="today-body" /> : "오늘 생각해 볼 점을 준비하고 있어요."}</p>
                {!result.reading && <span className="pending-label">{loading ? "해석 중" : "해석을 다시 시도할 수 있어요"}</span>}
              </section>
              <section className="preview-card" aria-labelledby="weekly-title">
                <p className="card-index">이번 주 운세 · {result.reading?.weekly ? `${result.reading.weekly.startDate} ~ ${result.reading.weekly.endDate}` : `${currentWeek.startDate} ~ ${currentWeek.endDate}`}</p>
                <h3 id="weekly-title">{result.reading?.weekly ? <ExplainedText text={result.reading.weekly.headline} id="weekly-head" /> : "이번 주 운세"}</h3>
                <p>{result.reading?.weekly
                  ? <ExplainedText text={result.reading.weekly.body} id="weekly-body" />
                  : result.reading
                    ? "저장된 이전 결과에는 이번 주 풀이가 없어요. 새로 해석하면 볼 수 있어요."
                    : "이번 주에 생각해 볼 점을 준비하고 있어요."}</p>
                {!result.reading && <span className="pending-label">{loading ? "해석 중" : "해석을 다시 시도할 수 있어요"}</span>}
              </section>
            </div>

            {result.reading && result.reading.today.date !== koreaDate() && <p className="date-note">이 운세는 {result.reading.today.date}에 만든 결과입니다. 오늘의 운세를 보려면 새로 해석해 주세요.</p>}
            {result.reading?.weekly && result.reading.weekly.startDate !== currentWeek.startDate && <p className="date-note">이번 주 풀이 기간이 지났어요. 새로 해석하면 현재 주의 풀이를 볼 수 있어요.</p>}
          </section>
        </>)}
      </div>
    </>
  );
}
