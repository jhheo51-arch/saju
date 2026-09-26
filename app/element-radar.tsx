import type { SajuChart } from "../lib/saju/chart";

const elementOrder = ["목", "화", "토", "금", "수"] as const;
const elementHanja = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" } as const;
const center = 150;
const radius = 84;

function point(index: number, distance: number) {
  const angle = (-90 + index * 72) * Math.PI / 180;
  return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
}

function polygon(distance: number) {
  return elementOrder.map((_, index) => point(index, distance)).join(" ");
}

export function ElementRadar({ values }: { values: SajuChart["elements"] }) {
  const scaleMax = Math.max(4, ...elementOrder.map((element) => values[element]));
  const valueText = elementOrder.map((element) => `${element} ${values[element]}개`).join(", ");
  const dataPoints = elementOrder
    .map((element, index) => point(index, radius * values[element] / scaleMax))
    .join(" ");

  return (
    <figure className="element-radar">
      <svg viewBox="0 0 300 300" role="img" aria-labelledby="element-radar-title element-radar-description">
        <title id="element-radar-title">오행 글자 수 방사형 그래프</title>
        <desc id="element-radar-description">{valueText}. 바깥선은 {scaleMax}개 기준입니다.</desc>
        <g className="element-radar-grid" aria-hidden="true">
          {[0.25, 0.5, 0.75, 1].map((level) => <polygon key={level} points={polygon(radius * level)} />)}
          {elementOrder.map((_, index) => <line key={index} x1={center} y1={center} x2={point(index, radius).split(",")[0]} y2={point(index, radius).split(",")[1]} />)}
        </g>
        <polygon className="element-radar-shape" points={dataPoints} />
        {elementOrder.map((element, index) => {
          const [cx, cy] = point(index, radius * values[element] / scaleMax).split(",");
          const [x, y] = point(index, 116).split(",");
          return (
            <g className="element-radar-element" data-element={element} key={element}>
              <circle className="element-radar-label-halo" cx={x} cy={y} r="24" />
              <circle className="element-radar-point" cx={cx} cy={cy} r="4" />
              <text className="element-radar-label" x={x} y={y} textAnchor="middle" dominantBaseline="middle">{element}({elementHanja[element]})</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="element-radar-values" aria-label={`정확한 오행 글자 수: ${valueText}`}>
        {elementOrder.map((element) => <span data-element={element} key={element}><strong>{element}</strong> {values[element]}</span>)}
      </figcaption>
    </figure>
  );
}
