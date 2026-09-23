"use client";

import { useState, type FormEvent } from "react";
import {
  calculate,
  InputError,
  type SajuChart,
  type SajuInput,
} from "../lib/saju/chart";

export default function SajuForm() {
  const [chart, setChart] = useState<SajuChart | null>(null);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: SajuInput = {
      date: String(data.get("date") || ""),
      time: String(data.get("time") || ""),
      calendar: "solar",
      topic: "general",
      question: "",
    };

    try {
      setChart(calculate(input));
      setError("");
    } catch (caught) {
      setChart(null);
      setError(
        caught instanceof InputError
          ? caught.message
          : "계산하지 못했습니다. 입력을 확인해주세요.",
      );
    }
  }

  return (
    <section className="input-card" aria-labelledby="input-title">
      <h2 id="input-title">언제 태어나셨나요?</h2>
      <p className="form-intro">양력 생년월일과 태어난 시간을 입력해주세요.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="date">생년월일</label>
        <input id="date" name="date" type="date" required />

        <label htmlFor="time">출생시간</label>
        <input id="time" name="time" type="time" required />

        <button type="submit">내 사주 알아보기</button>
      </form>

      <div className="feedback" aria-live="polite">
        {error && <p className="error">{error}</p>}
        {chart && (
          <section className="result" aria-labelledby="result-title">
            <p className="result-label">계산 결과</p>
            <h2 id="result-title" className="day-pillar">
              {chart.pillars[2].korean}일주
            </h2>
            <p className="day-master">
              일간은 {chart.dayMaster.korean}
              {chart.dayMaster.element}({chart.dayMaster.character})입니다.
            </p>
            <dl className="pillars">
              {chart.pillars.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.text}</dd>
                </div>
              ))}
            </dl>
            <p className="note">{chart.method}</p>
          </section>
        )}
      </div>
    </section>
  );
}
