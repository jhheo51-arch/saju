import type { SajuChart } from "../lib/saju/chart";

const elementOrder = ["목", "화", "토", "금", "수"] as const;

function countLabel(elements: readonly string[], count: number) {
  return `${elements.join("·")} · ${elements.length > 1 ? "각 " : ""}${count}개`;
}

export function ElementCountSummary({ values }: { values: SajuChart["elements"] }) {
  const counts = elementOrder.map((element) => values[element]);
  const highest = Math.max(...counts);
  const lowest = Math.min(...counts);
  const highestElements = elementOrder.filter((element) => values[element] === highest);
  const lowestElements = elementOrder.filter((element) => values[element] === lowest);
  const presentCount = counts.filter((count) => count > 0).length;
  const isEven = highest === lowest;

  return (
    <section className="element-count-summary" aria-labelledby="element-count-summary-title">
      <h3 id="element-count-summary-title">오행 한눈 요약</h3>
      <dl>
        <div>
          <dt>{isEven ? "고르게 보이는 기운" : "많이 보이는 기운"}</dt>
          <dd>{countLabel(highestElements, highest)}</dd>
        </div>
        {!isEven && <div>
          <dt>상대적으로 적게 보이는 기운</dt>
          <dd>{countLabel(lowestElements, lowest)}</dd>
        </div>}
        <div>
          <dt>전체 분포</dt>
          <dd>{presentCount === 5 ? "다섯 기운 모두 있음" : `${presentCount}가지 기운이 보임`} · 차이 {highest - lowest}개</dd>
        </div>
      </dl>
      <p>오행별 개수를 비교한 결과예요. 많고 적음이 좋고 나쁨을 뜻하지는 않아요.</p>
    </section>
  );
}
