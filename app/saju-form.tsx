"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { calculate, InputError, parseQuestion, type Pillar, type SajuChart, type SajuInput } from "../lib/saju/chart";
import { clearAccountResult, loadAccountResult, saveAccountResult } from "../lib/saju/account-storage";
import { basicTerms, stemTerms, tenStars } from "../lib/saju/glossary";
import { isReadingTopic, koreaDate, koreaWeekRange, type Interpretation, type ReadingTopic } from "../lib/saju/interpretation";
import { getSajuSupabaseClient } from "../lib/saju/supabase-client";
import { readingTopics as topics } from "../lib/saju/topics";
import { avatarForChart, palaceStoryForChart } from "../lib/saju/avatar";
import { ElementRadar } from "./element-radar";
import { ElementCountSummary } from "./element-count-summary";
import { weekCalendar } from "../lib/saju/solar-terms";
import { desiredDirections, parsePersonalContext, personalContextLabels, personalSituations, PersonalContextError, type PersonalContext } from "../lib/saju/personal-context";
import { dailyFortuneCues } from "../lib/saju/daily-fortune-cues";
import { traditionalContextForChart } from "../lib/saju/traditional-context";
import { nobleHelperForChart } from "../lib/saju/noble-helper";
import { YongshinSummary } from "./yongshin-summary";
const glossary = [...basicTerms, ...tenStars, ...stemTerms];
const inlineGlossary = glossary.filter(({ term }) => !["년주", "일주", "시주"].includes(term));

type SajuTerm = (typeof glossary)[number]["term"];
type DisplayResult = { chart: SajuChart; topic: ReadingTopic; reading: Interpretation | null; createdAt?: string };
type ReadingRequest = SajuInput & { context: PersonalContext };
type SelectedAvatarStyle = "male" | "female";
const yangStemCharacters = "甲丙戊庚壬";
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

function topicParticle(word: string): "은" | "는" {
  const last = word.charCodeAt(word.length - 1);
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0 ? "은" : "는";
}

function PillarHelp({ pillar, id }: { pillar: Pillar; id: string }) {
  const stemTerm = `${pillar.korean[0]}${pillar.stemElement}`;
  const stemMeaning = stemTerms.find((entry) => entry.term === stemTerm)?.meaning;
  const meaning = `${pillar.korean}${topicParticle(pillar.korean)} 사주의 한 기둥을 이루는 두 글자예요. 위 글자 ${pillar.korean[0]}(${pillar.stem})은 ${pillar.stemElement} 기운${stemMeaning ? `으로, ${stemMeaning}` : "이에요."} 아래 글자 ${pillar.korean[1]}(${pillar.branch})은 땅의 기운을 나타내는 지지이며, 이 계산에서는 ${pillar.branchElement} 기운으로 분류해요. 두 글자를 함께 살피는 단서이며 이것만으로 성격이나 미래를 정하지는 않아요.`;

  return (
    <>
      <button type="button" className="term-trigger" popoverTarget={id} aria-label={`${pillar.korean} 뜻 보기`}>
        {pillar.korean}
      </button>
      <span id={id} popover="auto" className="term-popover" role="note" aria-label={`${pillar.korean}의 뜻`}>
        <strong>{pillar.korean}</strong>
        <span className="term-meaning">{meaning}</span>
        <button type="button" className="term-close" popoverTarget={id} popoverTargetAction="hide">닫기</button>
      </span>
    </>
  );
}

function EightCharacterMap({ pillars, focus }: { pillars: Pillar[]; focus: "day-master" | "month-pillar" }) {
  const focusedName = focus === "day-master" ? "일간" : "월주";
  const focusedCharacters = focus === "day-master" ? pillars[2].korean[0] : pillars[1].korean;
  const everydayLabels = ["태어난 해", "태어난 달", "태어난 날", "태어난 시각"];

  return (
    <figure className="eight-character-map">
      <div
        className="eight-character-map-grid"
        role="img"
        aria-label={`${pillars.map((pillar, index) => `${everydayLabels[index]} ${pillar.label} ${pillar.korean}`).join(", ")}. ${focusedName} ${focusedCharacters} 강조`}
      >
        {pillars.map((pillar, pillarIndex) => (
          <div className="eight-character-map-pillar" key={pillar.label}>
            <span className="eight-character-map-label">{everydayLabels[pillarIndex]}<small>{pillar.label}</small></span>
            {[...pillar.korean].map((character, characterIndex) => {
              const highlighted = focus === "day-master"
                ? pillarIndex === 2 && characterIndex === 0
                : pillarIndex === 1;
              return <span className={`eight-character-map-character${highlighted ? " is-highlighted" : ""}`} key={`${pillar.label}-${characterIndex}`}>{character}</span>;
            })}
          </div>
        ))}
      </div>
    </figure>
  );
}

function ExplainedText({ text, id, pillars = [] }: { text: string; id: string; pillars?: Pillar[] }) {
  const pillarByName = new Map(pillars.map((pillar) => [pillar.korean, pillar]));
  const pillarPattern = pillars.length > 0 ? `|${[...pillarByName.keys()].join("|")}` : "";
  const explainedPattern = new RegExp(`(${inlineGlossary.map((entry) => entry.term).join("|")}${pillarPattern})`, "g");

  return <>{text.split(explainedPattern).map((part, index) => {
    const pillar = pillarByName.get(part);
    if (pillar) return <PillarHelp key={`${id}-${index}`} pillar={pillar} id={`${id}-pillar-${index}`} />;
    const known = glossary.find((entry) => entry.term === part);
    return known ? <TermHelp key={`${id}-${index}`} term={known.term} id={`${id}-${index}`} /> : <span key={`${id}-${index}`}>{part}</span>;
  })}</>;
}

const readingDetailLabels = {
  basis: "계산 근거",
  meaning: "쉬운 뜻",
  scene: "생활에서는",
  balance: "균형 있게 보기",
  action: "작은 행동",
} as const;

function ReadingCardContent({ section, id, pillars }: { section: Interpretation["personality"]; id: string; pillars: Pillar[] }) {
  return (
    <>
      <p className="reading-summary"><ExplainedText text={section.body} id={`${id}-summary`} pillars={pillars} /></p>
      {section.details && <dl className="reading-breakdown">
        {(Object.keys(readingDetailLabels) as Array<keyof typeof readingDetailLabels>).map((key) => (
          <div key={key} className={key === "action" ? "reading-action" : undefined}>
            <dt>{readingDetailLabels[key]}</dt>
            <dd><ExplainedText text={section.details![key]} id={`${id}-${key}`} pillars={pillars} /></dd>
          </div>
        ))}
      </dl>}
    </>
  );
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
  const [retryInput, setRetryInput] = useState<ReadingRequest | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarSaveError, setAvatarSaveError] = useState("");
  const [avatarStyle, setAvatarStyle] = useState<SelectedAvatarStyle | null>(null);
  const [selectedWeeklyDate, setSelectedWeeklyDate] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const pending = useRef(false);
  const questionPending = useRef(false);
  const avatarShareRef = useRef<HTMLDivElement | null>(null);
  const accountClient = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("saju.avatar-style.v1");
      if (saved === "male" || saved === "female") setAvatarStyle(saved);
    } catch {
      // 저장소를 사용할 수 없어도 아바타는 선택할 수 있습니다.
    }
  }, []);

  function chooseAvatarStyle(style: SelectedAvatarStyle) {
    setAvatarStyle(style);
    setAvatarSaveError("");
    try {
      window.localStorage.setItem("saju.avatar-style.v1", style);
    } catch {
      // 선택은 현재 화면에서 계속 유지됩니다.
    }
  }

  async function downloadAvatar() {
    if (!avatarShareRef.current || !avatar || avatarSaving) return;
    setAvatarSaving(true);
    setAvatarSaveError("");
    try {
      await document.fonts.ready;
      const artwork = avatarShareRef.current.querySelector<HTMLImageElement>(".avatar-share-art img");
      if (!artwork || !artwork.src.endsWith(avatar.image)) throw new Error("아바타 그림을 준비하지 못했어요.");
      await artwork.decode();
      const { toPng } = await import("html-to-image");
      const image = await toPng(avatarShareRef.current, {
        pixelRatio: 1,
        canvasWidth: 1080,
        canvasHeight: 1350,
        backgroundColor: "#fffdf8",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `나의-사주-아바타-${avatar.element}-${avatarStyle === "male" ? "남자" : "여자"}.png`;
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

    if (!client) {
      setResult(null);
      setHasStoredResult(false);
      setReady(true);
      return;
    }

    async function refreshAccount() {
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
      }
      if (active && current === revision) setReady(true);
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setResult(null);
        setHasStoredResult(false);
        setRetryInput(null);
        setQuestion("");
        setQuestionError("");
        setNotice("로그아웃했어요. 계정의 해석은 이 화면에서 숨겼어요.");
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => { if (active) void refreshAccount(); }, 0);
      }
    });
    void refreshAccount();
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
        setQuestion("");
        setQuestionError("");
        setNotice("로그아웃했어요. 계정의 해석은 이 화면에서 숨겼어요.");
      }
    } catch {
      setAuthError("로그아웃에 연결하지 못했어요. 다시 시도해주세요.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function requestReading(input: ReadingRequest) {
    if (pending.current || !isReadingTopic(input.topic)) return;
    const client = accountClient.current;
    if (!user || !client) {
      setResult(null);
      setRetryInput(null);
      setError("Google 로그인 후 사주 해석을 이용해 주세요.");
      return;
    }
    pending.current = true;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) {
        setUser(null);
        setResult(null);
        setRetryInput(null);
        throw new ServerMessageError("로그인이 만료됐어요. Google로 다시 로그인해 주세요.");
      }
      const response = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
        await saveAccountResult(client, user.id, saved);
        setHasStoredResult(true);
        setNotice("최근 해석 1건을 계정에 저장했어요.");
      } catch {
        setNotice("해석은 만들었지만 계정에 저장하지 못했어요. 이전 저장본은 그대로 남아 있을 수 있어요.");
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

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (questionPending.current || !user || !accountClient.current || !result?.reading) return;

    let checkedQuestion: string;
    try {
      checkedQuestion = parseQuestion(question, true);
    } catch (caught) {
      setQuestionError(caught instanceof InputError ? caught.message : "궁금한 점을 확인해 주세요.");
      return;
    }

    questionPending.current = true;
    setQuestionLoading(true);
    setQuestionError("");
    try {
      const client = accountClient.current;
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new ServerMessageError("로그인이 만료됐어요. Google로 다시 로그인해 주세요.");
      const createdAt = result.createdAt || new Date().toISOString();
      const response = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          question: checkedQuestion,
          result: { version: 1, createdAt, chart: result.chart, topic: result.topic, reading: result.reading },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new ServerMessageError(typeof data.error === "string" ? data.error : "질문에 답하지 못했어요. 다시 시도해 주세요.");

      const nextReading = { ...result.reading, questionAnswer: data.questionAnswer };
      const nextResult = { ...result, reading: nextReading, createdAt };
      setResult(nextResult);
      try {
        await saveAccountResult(client, user.id, { version: 1, createdAt, chart: result.chart, topic: result.topic, reading: nextReading });
        setHasStoredResult(true);
        setNotice("질문 답변을 최근 사주 결과에 함께 저장했어요.");
      } catch {
        setNotice("답변은 만들었지만 계정에 저장하지 못했어요. 화면을 닫으면 답변이 사라질 수 있어요.");
      }
    } catch (caught) {
      setQuestionError(caught instanceof ServerMessageError ? caught.message : "질문 답변에 연결하지 못했어요. 다시 시도해 주세요.");
    } finally {
      questionPending.current = false;
      setQuestionLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    if (!user) {
      setResult(null);
      setRetryInput(null);
      setError("Google 로그인 후 사주 해석을 이용해 주세요.");
      return;
    }
    const data = new FormData(event.currentTarget);
    const selectedTopic = topics.find((topic) => topic.value === data.get("topic"));

    if (!selectedTopic) {
      setResult(null);
      setRetryInput(null);
      setError("관심 있는 주제를 하나 골라주세요.");
      return;
    }

    let context: PersonalContext;
    try {
      context = parsePersonalContext({
        situation: data.get("situation"),
        direction: data.get("direction"),
      }, true)!;
    } catch (caught) {
      setResult(null);
      setRetryInput(null);
      setError(caught instanceof PersonalContextError ? caught.message : "현재 상황과 원하는 방향을 다시 골라주세요.");
      return;
    }

    const input: ReadingRequest = {
      date: String(data.get("date") || ""),
      time: String(data.get("time") || ""),
      calendar: "solar",
      topic: selectedTopic.value,
      context,
    };

    try {
      const chart = calculate(input);
      setQuestion("");
      setQuestionError("");
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
    if (!user || !accountClient.current) return;
    try {
      await clearAccountResult(accountClient.current, user.id);
      setResult(null);
      setHasStoredResult(false);
      setQuestion("");
      setQuestionError("");
      setNotice("계정에 저장된 해석을 삭제했어요.");
    } catch {
      setError("저장된 해석을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  const selectedTopic = topics.find((topic) => topic.value === result?.topic);
  const avatar = result && avatarStyle ? avatarForChart(result.chart, avatarStyle) : null;
  const palaceStory = result ? palaceStoryForChart(result.chart) : null;
  const nobleHelper = result ? nobleHelperForChart(result.chart) : null;
  const today = result?.reading?.today.date || koreaDate();
  const todayCues = result ? dailyFortuneCues(result.chart, today) : null;
  const currentWeek = koreaWeekRange(koreaDate());
  const calendar = weekCalendar(result?.reading?.weekly?.startDate || currentWeek.startDate);
  const thisWeekTerm = calendar.days.find((day) => day.term);
  const hasDailyFortunes = result?.reading?.weekly?.days?.length === 7;
  const selectedDailyFortune = hasDailyFortunes ? result?.reading?.weekly?.days?.find((day) => day.date === selectedWeeklyDate) : undefined;
  const selectedWeekday = calendar.days.find((day) => day.date === selectedDailyFortune?.date)?.weekday;
  const olderReading = Boolean(result?.reading && (
    !(result.reading.personality.details?.basis || result.reading.personality.body).includes(`${result.chart.dayMaster.korean}${result.chart.dayMaster.element}`) ||
    !(result.reading.topic.details?.basis || result.reading.topic.body).includes(result.chart.pillars[1].korean)
  ));
  const contextLabels = result?.reading?.context ? personalContextLabels(result.reading.context) : undefined;
  const chartContext = result ? traditionalContextForChart(result.chart) : undefined;

  return (
    <>
      <section className="account-card" aria-label="로그인과 계정 저장">
        <div>
          <strong>{user ? "로그인되어 있어요" : "사주 해석을 시작하려면 로그인해 주세요"}</strong>
          <p>{user ? `${user.email || "Google 계정"} · 최근 해석 1건을 계정에 저장합니다.` : "Google 로그인 후 해석을 만들고, 다른 기기에서도 최근 결과를 볼 수 있어요."}</p>
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

          <div className="context-fields" aria-label="풀이에 반영할 현재 상황과 원하는 방향">
            <div className="field">
              <label htmlFor="situation">현재 상황</label>
              <select id="situation" name="situation" required defaultValue="">
                <option value="" disabled>가장 가까운 상황을 골라주세요</option>
                {personalSituations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="direction">원하는 방향</label>
              <select id="direction" name="direction" required defaultValue="">
                <option value="" disabled>이번 풀이에서 얻고 싶은 것을 골라주세요</option>
                {desiredDirections.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>
          <p className="field-hint">두 선택은 사주 계산값을 바꾸지 않고, 생활 장면과 작은 행동의 초점만 맞춰줘요.</p>

          {!user && ready && <p className="login-required-hint" id="login-required-hint">위의 `Google로 로그인`을 먼저 눌러주세요. 로그인 전에는 해석을 만들거나 저장된 결과를 볼 수 없어요.</p>}

          <button type="submit" aria-describedby={!user ? "login-required-hint" : undefined} disabled={loading || !ready || !user}>{!ready ? "화면을 준비하고 있어요…" : !user ? "Google 로그인 후 해석할 수 있어요" : loading ? "해석을 만들고 있어요…" : "나의 사주 해석 보기"}</button>
        </form>
      </section>

      <div className="feedback" aria-live="polite">
        {error && <p className="error" role="alert">{error}</p>}
        {error && retryInput && user && !loading && <button type="button" className="retry-button" onClick={() => void requestReading(retryInput)}>다시 시도</button>}
        {notice && <p className="notice">{notice}</p>}
        {user && result && (<>
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
              <div className="chart-basis-layout">
                <div className="element-radar-basis"><span>여덟 글자의 <TermHelp term="오행" id="basis-elements-help" /></span><ElementRadar values={result.chart.elements} /><ElementCountSummary values={result.chart.elements} /></div>
                <div className="chart-basis-facts">
                  <div className="chart-basis-fact day-master-fact">
                    <span>나를 대표하는 글자 · <TermHelp term="일간" id="basis-day-master-help" /></span>
                    <strong><ExplainedText text={`${result.chart.dayMaster.korean}${result.chart.dayMaster.element}`} id="basis-day-master-name" pillars={result.chart.pillars} /></strong>
                    <dl className="chart-basis-detail-list" aria-label="일간을 풀어본 값">
                      <div><dt>한자</dt><dd>{result.chart.dayMaster.character}</dd></div>
                      <div><dt><TermHelp term="음양" id="basis-day-master-yinyang-help" /></dt><dd>{yangStemCharacters.includes(result.chart.dayMaster.character) ? "양" : "음"}</dd></div>
                      <div><dt><TermHelp term="오행" id="basis-day-master-element-help" /></dt><dd>{result.chart.dayMaster.element}</dd></div>
                    </dl>
                    <EightCharacterMap pillars={result.chart.pillars} focus="day-master" />
                  </div>
                  <div className="chart-basis-fact month-pillar-fact">
                    <span>태어난 달의 두 글자 · <TermHelp term="월주" id="basis-month-pillar-help" /></span>
                    <strong><PillarHelp pillar={result.chart.pillars[1]} id="basis-month-pillar-name" /> <small>({result.chart.pillars[1].stemElement}·{result.chart.pillars[1].branchElement})</small></strong>
                    <dl className="chart-basis-detail-list month-pillar-details" aria-label="월주의 두 글자를 풀어본 값">
                      <div><dt>윗글자</dt><dd>{result.chart.pillars[1].stem} · {result.chart.pillars[1].korean[0]} · {result.chart.pillars[1].stemElement}</dd></div>
                      <div><dt>아랫글자</dt><dd>{result.chart.pillars[1].branch} · {result.chart.pillars[1].korean[1]} · {result.chart.pillars[1].branchElement}</dd></div>
                    </dl>
                    <EightCharacterMap pillars={result.chart.pillars} focus="month-pillar" />
                  </div>
                </div>
              </div>
              <p className="chart-basis-note">오행 숫자는 글자 수예요. 이것만으로 성격의 강약이나 미래를 정할 수는 없어요.</p>
              {chartContext && <div className="traditional-context-facts" aria-label="추가로 계산한 음양과 계절 정보">
                <article>
                  <span>여덟 글자의 <TermHelp term="음양" id="basis-yinyang-help" /></span>
                  <strong>음 {chartContext.yinYang.yin} · 양 {chartContext.yinYang.yang}</strong>
                  <small>두 흐름의 글자 수예요. 어느 쪽이 더 좋다는 뜻은 아니에요.</small>
                </article>
                <article>
                  <span>월지의 전통 계절 구간</span>
                  <strong>{chartContext.season.name} · {chartContext.season.monthLabel}</strong>
                  <small>실제 출생지의 날씨가 아니라 월지로 나눈 전통 달력 구간이에요.</small>
                </article>
              </div>}
              <YongshinSummary chart={result.chart} />
            </section>

            {contextLabels && <section className="context-summary" aria-label="이번 풀이에 반영한 선택">
              <p>이번 풀이에 반영한 선택</p>
              <div>
                <span><strong>현재</strong>{contextLabels.situation}</span>
                <span><strong>원하는 방향</strong>{contextLabels.direction}</span>
              </div>
            </section>}

            {olderReading && <p className="date-note">이 결과는 이전 방식으로 만든 해석이에요. 위에서 생년월일과 시간을 다시 입력하면 계산 근거를 반영한 새 풀이를 볼 수 있어요.</p>}

            <div className="preview-cards reading-cards">
              <section className="preview-card" aria-labelledby="personality-title">
                <p className="card-index">01 · 나를 알아보기</p>
                <h3 id="personality-title">{result.reading ? <ExplainedText text={result.reading.personality.headline} id="personality-head" pillars={result.chart.pillars} /> : "나의 성향 카드"}</h3>
                {result.reading ? <ReadingCardContent section={result.reading.personality} id="personality" pillars={result.chart.pillars} /> : <p>계산 결과를 쉬운 말로 풀고 있어요.</p>}
                {!result.reading && <span className="pending-label">{loading ? "해석 중" : "해석을 다시 시도할 수 있어요"}</span>}
              </section>
              <section className="preview-card" aria-labelledby="topic-title">
                <p className="card-index">02 · 관심 주제</p>
                <h3 id="topic-title">{result.reading ? <ExplainedText text={result.reading.topic.headline} id="topic-head" pillars={result.chart.pillars} /> : `${selectedTopic?.label} 이야기`}</h3>
                {result.reading ? <ReadingCardContent section={result.reading.topic} id="topic" pillars={result.chart.pillars} /> : <p>{selectedTopic?.detail}에 관한 풀이를 준비하고 있어요.</p>}
                {!result.reading && <span className="pending-label">{loading ? "해석 중" : "해석을 다시 시도할 수 있어요"}</span>}
              </section>
            </div>

            <details className="raw-chart">
              <summary>계산된 사주 원자료 보기</summary>
              <p className="raw-intro">아래 네 쌍은 기존 코드가 계산한 값입니다. 밑줄 친 단어를 누르면 뜻이 나와요.</p>
              <dl className="pillars">
                {result.chart.pillars.map((item) => (
                  <div key={item.label}>
                    <dt><TermHelp term={item.label} id={`${item.label}-meaning-help`} /></dt>
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
            <div className="preview-header avatar-section-header">
              <span className="section-step">03</span>
              <div>
                <p className="eyebrow">사주에서 만난 캐릭터</p>
                <div className="avatar-title-line">
                  <h2 id="visual-title">나의 아바타</h2>
                  <p>태어난 날의 오행에서 영감을 받은 캐릭터를 만나보세요.</p>
                </div>
              </div>
              {result && <div className="avatar-download-actions">
                <button type="button" onClick={downloadAvatar} disabled={!avatarStyle || avatarSaving} aria-describedby="avatar-style-hint">
                  {avatarSaving ? "이미지 만드는 중…" : "아바타 이미지 저장"}
                </button>
                {avatarSaveError && <p role="alert">{avatarSaveError}</p>}
              </div>}
            </div>

            {result && <fieldset className="avatar-style-picker">
              <legend>아바타 모습 선택</legend>
              <div className="avatar-style-row">
                <div className="avatar-style-options">
                  {([ ["male", "남자"], ["female", "여자"] ] as const).map(([style, label]) => (
                    <label key={style} className={avatarStyle === style ? "selected" : undefined}>
                      <input type="radio" name="avatar-style" value={style} checked={avatarStyle === style} onChange={() => chooseAvatarStyle(style)} aria-describedby="avatar-style-hint" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <p id="avatar-style-hint">모습을 고르면 내 오행에 가까운 아바타가 나타나요. 선택은 그림에만 적용되고, 궁궐 이야기는 사주 분석을 바탕으로 정해져요.</p>
              </div>
            </fieldset>}

            {avatar && palaceStory && <section className="avatar-card" aria-labelledby="avatar-title">
              <div className="avatar-scene">
                <Image
                  src={avatar.image}
                  alt={`${avatar.element}에서 영감을 받은 ${avatar.name} ${avatarStyle === "male" ? "남자" : "여자"} 캐릭터`}
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
                  <div><dt>맡은 일</dt><dd><ExplainedText text={palaceStory.duty} id="avatar-duty" pillars={result.chart.pillars} /></dd></div>
                  <div><dt>함께할 기운</dt><dd><ExplainedText text={palaceStory.teamwork} id="avatar-teamwork" pillars={result.chart.pillars} /></dd></div>
                </dl>
                <p className="avatar-disclaimer">궁궐 이야기는 사주의 일간·월주·오행 분포를 바탕으로 만든 창작 설정이며 실제 직업·신분·성별을 알아낸 결과가 아닙니다. 함께할 기운도 전통 상징을 쉽게 풀어본 참고이며 실제 궁합이나 인간관계를 확정하지 않아요.</p>
              </div>
            </section>}
            {nobleHelper && <section className="noble-court" aria-labelledby="noble-court-title">
              <header className="noble-court-header">
                <p className="card-index">궁궐 인연 기록</p>
                <h3 id="noble-court-title">궁궐 귀인전</h3>
                <p>내 사주에서 도움의 인연을 읽는 전통 표시와 궁궐 이야기를 함께 살펴봐요.</p>
              </header>
              <div className="noble-seal-card">
                <span className="noble-seal" aria-hidden="true">貴人</span>
                <div>
                  <span className="noble-label">나의 귀인패</span>
                  <strong>{nobleHelper.targetLabel}</strong>
                  <p><ExplainedText text={nobleHelper.calculation} id="noble-calculation" pillars={result.chart.pillars} /></p>
                </div>
              </div>
              <div className="noble-court-grid">
                <article>
                  <span className="noble-label">궁궐에서 만나는 모습</span>
                  <h4>{nobleHelper.courtTitle}</h4>
                  <p>{nobleHelper.courtStory}</p>
                </article>
                <article>
                  <span className="noble-label">귀인을 알아보는 장면</span>
                  <ul>
                    {nobleHelper.meetingSigns.map((sign) => <li key={sign}>{sign}</li>)}
                  </ul>
                </article>
                <article className="noble-open-door">
                  <span className="noble-label">내가 여는 궁문</span>
                  <p>{nobleHelper.openDoor}</p>
                </article>
              </div>
              <p className="noble-disclaimer"><TermHelp term="천을귀인" id="noble-helper-term" />은 전통 명리의 보조 표시예요. 특정 띠·성별·직업을 귀인으로 단정하지 않으며, 궁궐 이야기는 이해를 위한 창작이에요.</p>
            </section>}
            {avatar && palaceStory && <div className="avatar-export-stage" aria-hidden="true">
              <div ref={avatarShareRef} className="avatar-share-card" data-element={avatar.element}>
                <div className="avatar-share-top">
                  <p>나의 사주 이야기</p>
                  <span>일간 오행 · {avatar.element}</span>
                </div>
                <div className="avatar-share-title">
                  <h4>{avatar.name}</h4>
                  <p>{avatarStyle === "male" ? "남자" : "여자"} 아바타</p>
                </div>
                <div className="avatar-share-art">
                  <img key={avatar.image} src={avatar.image} alt="" loading="eager" decoding="sync" />
                </div>
                <div className="avatar-share-role">
                  <span>궁궐에서 맡은 역할</span>
                  <strong>{palaceStory.role}</strong>
                </div>
                <p className="avatar-share-footnote">오행에서 영감을 받은 창작 캐릭터예요. 실제 성격이나 미래를 단정하지 않아요.</p>
              </div>
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
            <div className="fortune-basis" aria-label="운세 풀이에 참고한 내 사주 단서">
              <span className="fortune-basis-label">풀이의 사주 단서</span>
              <span className="fortune-badge" data-element={result.chart.dayMaster.element}>
                <span className="fortune-badge-dot" aria-hidden="true" />
                <TermHelp term="일간" id="fortune-day-master-help" /> {result.chart.dayMaster.korean}{result.chart.dayMaster.element}
              </span>
              <span className="fortune-badge" data-element={result.chart.pillars[1].stemElement}>
                <span className="fortune-badge-dot" aria-hidden="true" />
                <TermHelp term="월주" id="fortune-month-pillar-help" /> <PillarHelp pillar={result.chart.pillars[1]} id="fortune-month-pillar-name" /> · {result.chart.pillars[1].stemElement}·{result.chart.pillars[1].branchElement}
              </span>
            </div>
            <div className="preview-cards today-cards">
              <section className="preview-card" aria-labelledby="today-title">
                <p className="card-index">오늘의 운세 · {today}</p>
                <h3 id="today-title">{result.reading ? <ExplainedText text={result.reading.today.headline} id="today-head" pillars={result.chart.pillars} /> : "오늘의 운세"}</h3>
                <p>{result.reading ? <ExplainedText text={result.reading.today.body} id="today-body" pillars={result.chart.pillars} /> : "오늘 생각해 볼 점을 준비하고 있어요."}</p>
                {result.reading?.today.action && <div className="fortune-action"><strong>오늘의 한 걸음</strong><p><ExplainedText text={result.reading.today.action} id="today-action" pillars={result.chart.pillars} /></p></div>}
                {todayCues && <aside className="fortune-cues" aria-label="오늘의 재미 포인트">
                  <strong>오늘의 재미 포인트</strong>
                  <div>
                    <span className="fortune-cue"><i style={{ backgroundColor: todayCues.color.hex }} aria-hidden="true" /><span>색상 <b>{todayCues.color.name}</b></span></span>
                    <span className="fortune-cue"><span className="fortune-number" aria-hidden="true">{todayCues.number}</span><span>숫자 <b>{todayCues.number}</b></span></span>
                  </div>
                  <small>사주 단서와 날짜를 조합한 가벼운 재미용 제안이에요.</small>
                </aside>}
                {!result.reading && <span className="pending-label">{loading ? "해석 중" : "해석을 다시 시도할 수 있어요"}</span>}
              </section>
              <section className="preview-card" aria-labelledby="weekly-title">
                <p className="card-index">이번 주 운세 · <span className="fortune-period">{result.reading?.weekly ? `${result.reading.weekly.startDate} ~ ${result.reading.weekly.endDate}` : `${currentWeek.startDate} ~ ${currentWeek.endDate}`}</span></p>
                {calendar.days.length === 7 && <div className="week-calendar" aria-label="이번 주 날짜와 절기">
                  {hasDailyFortunes && <button type="button" className="week-overview-button" aria-pressed={!selectedDailyFortune} aria-controls="weekly-reading-content" onClick={() => setSelectedWeeklyDate(null)}>한 주 전체</button>}
                  <ol className="week-calendar-days">
                    {calendar.days.map((day) => <li key={day.date}>
                      {hasDailyFortunes
                        ? <button type="button" className={`week-day-button${day.date === koreaDate() ? " is-today" : ""}`} aria-label={`${Number(day.date.slice(5, 7))}월 ${day.day}일 ${day.weekday}요일 운세 보기`} aria-pressed={selectedDailyFortune?.date === day.date} aria-controls="weekly-reading-content" onClick={() => setSelectedWeeklyDate(day.date)}>
                          <span className="week-day-name">{day.weekday}</span><span className="week-day-date">{day.day}</span>{day.term && <span className="week-day-term">{day.term}</span>}
                        </button>
                        : <span className={`week-day-static${day.date === koreaDate() ? " is-today" : ""}`}>
                          <span className="week-day-name">{day.weekday}</span><span className="week-day-date">{day.day}</span>{day.term && <span className="week-day-term">{day.term}</span>}
                        </span>}
                    </li>)}
                  </ol>
                  <p className="week-calendar-note">{thisWeekTerm
                    ? `이번 주 절기: ${thisWeekTerm.term} · ${Number(thisWeekTerm.date.slice(5, 7))}월 ${thisWeekTerm.day}일`
                    : calendar.nextTerm
                      ? `다음 절기: ${calendar.nextTerm.name} · ${Number(calendar.nextTerm.date.slice(5, 7))}월 ${Number(calendar.nextTerm.date.slice(-2))}일`
                      : "절기 날짜를 확인할 수 없어요."}</p>
                </div>}
                <div id="weekly-reading-content" className="weekly-reading-content" aria-live="polite">
                  <h3 id="weekly-title">{selectedDailyFortune
                    ? `${selectedWeekday}요일 운세`
                    : result.reading?.weekly ? <ExplainedText text={result.reading.weekly.headline} id="weekly-head" pillars={result.chart.pillars} /> : "이번 주 운세"}</h3>
                  <p>{selectedDailyFortune
                    ? <ExplainedText text={selectedDailyFortune.body} id="selected-day-body" pillars={result.chart.pillars} />
                    : result.reading?.weekly
                      ? <ExplainedText text={result.reading.weekly.body} id="weekly-body" pillars={result.chart.pillars} />
                      : result.reading
                        ? "저장된 이전 결과에는 이번 주 풀이가 없어요. 새로 해석하면 볼 수 있어요."
                        : "이번 주에 생각해 볼 점을 준비하고 있어요."}</p>
                  {!selectedDailyFortune && result.reading?.weekly?.action && <div className="fortune-action"><strong>이번 주의 한 걸음</strong><p><ExplainedText text={result.reading.weekly.action} id="weekly-action" pillars={result.chart.pillars} /></p></div>}
                  {result.reading?.weekly && !hasDailyFortunes && <p className="daily-fortune-upgrade">이전 결과에는 날짜별 풀이가 없어요. 새로 해석하면 월~일을 눌러 볼 수 있어요.</p>}
                </div>
                {!result.reading && <span className="pending-label">{loading ? "해석 중" : "해석을 다시 시도할 수 있어요"}</span>}
              </section>
            </div>

            <p className="fortune-context-note">위 사주 단서는 태어날 때의 계산 결과예요. 절기는 계절을 나누는 달력 날짜이며, 요일별 운세 점수는 아니에요.</p>

            {result.reading && result.reading.today.date !== koreaDate() && <p className="date-note">이 운세는 {result.reading.today.date}에 만든 결과입니다. 오늘의 운세를 보려면 새로 해석해 주세요.</p>}
            {result.reading?.weekly && result.reading.weekly.startDate !== currentWeek.startDate && <p className="date-note">이번 주 풀이 기간이 지났어요. 새로 해석하면 현재 주의 풀이를 볼 수 있어요.</p>}
          </section>

          {result.reading && <section className="preview question-preview" aria-labelledby="question-section-title" aria-busy={questionLoading}>
            <div className="preview-header">
              <span className="section-step">05</span>
              <div>
                <p className="eyebrow">내 사주 결과에 이어서 묻기</p>
                <h2 id="question-section-title">궁금한 점 답변</h2>
                <p>현재 사주 계산과 선택한 주제를 바탕으로 질문에 답해드려요.</p>
              </div>
            </div>

            <form className="question-form" onSubmit={askQuestion}>
              <div className="field">
                <label htmlFor="saju-question">무엇이 궁금한가요?</label>
                <textarea
                  id="saju-question"
                  name="question"
                  value={question}
                  onChange={(event) => { setQuestion(event.target.value); if (questionError) setQuestionError(""); }}
                  maxLength={200}
                  required
                  placeholder="예: 새로운 일을 시작할 때 무엇을 먼저 살펴보면 좋을까요?"
                  aria-describedby="saju-question-count"
                  aria-invalid={Boolean(questionError)}
                />
                <div className="question-field-note">
                  <small id="saju-question-count">{question.length}/200</small>
                </div>
              </div>
              {questionError && <p className="question-error" role="alert">{questionError}</p>}
              <button type="submit" disabled={questionLoading}>{questionLoading ? "답변을 만들고 있어요…" : result.reading.questionAnswer ? "새 질문으로 답변 바꾸기" : "질문 답변 받기"}</button>
            </form>

            {result.reading.questionAnswer && <article className="question-answer" aria-live="polite">
              <span>질문에 대한 답</span>
              {result.reading.questionAnswer.basis && <p className="question-answer-basis"><strong>이번 답변의 근거</strong><ExplainedText text={result.reading.questionAnswer.basis} id="question-basis" pillars={result.chart.pillars} /></p>}
              <p><ExplainedText text={result.reading.questionAnswer.answer} id="question-answer" pillars={result.chart.pillars} /></p>
              <div className="fortune-action">
                <strong>지금 해볼 작은 행동</strong>
                <p><ExplainedText text={result.reading.questionAnswer.action} id="question-action" pillars={result.chart.pillars} /></p>
              </div>
            </article>}
          </section>}
        </>)}
      </div>
    </>
  );
}
