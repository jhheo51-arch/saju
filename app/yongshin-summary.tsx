import type { SajuChart } from "../lib/saju/chart";
import { yongshinForChart } from "../lib/saju/yongshin";
import { TermHelp } from "./term-help";

export function YongshinSummary({ chart }: { chart: SajuChart }) {
  const balance = yongshinForChart(chart);

  return (
    <section className="yongshin-summary" aria-labelledby="yongshin-summary-title">
      <div className="yongshin-summary-header">
        <div>
          <p className="yongshin-kicker">간이 <TermHelp term="억부용신" id="yongshin-method-help" /> 참고 결과</p>
          <h3 id="yongshin-summary-title">균형을 돕는 기운과 주의해서 볼 기운</h3>
        </div>
        <span className="yongshin-tendency">
          <TermHelp term={balance.tendency === "신강 쪽" ? "신강" : "신약"} id="yongshin-tendency-help" /> 쪽 · 도움 비중 {balance.supportPercent}%
        </span>
      </div>

      <p className="yongshin-basis">{balance.basis}</p>

      <div className="yongshin-role-grid">
        {balance.roles.map((item) => (
          <article className="yongshin-role" data-element={item.element} data-role={item.label} key={item.label}>
            <span className="yongshin-role-label"><TermHelp term={item.label} id={`yongshin-${item.label}-help`} /></span>
            <span className="yongshin-element-mark" aria-hidden="true">{item.hanja}</span>
            <strong>{item.element}({item.hanja})</strong>
            <p>{item.summary}</p>
          </article>
        ))}
      </div>

      <p className="yongshin-disclaimer">
        월지 2배와 지장간 가중치를 적용한 간이 기준이에요. 합·충·특수격국·조후는 제외했으니 참고로만 봐주세요.
      </p>
    </section>
  );
}
