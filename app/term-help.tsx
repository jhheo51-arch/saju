import { balanceTerms, basicTerms, stemTerms, tenStars } from "../lib/saju/glossary";

export const glossary = [...basicTerms, ...tenStars, ...stemTerms, ...balanceTerms];
export type SajuTerm = (typeof glossary)[number]["term"];

export function TermHelp({ term, id }: { term: SajuTerm; id: string }) {
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
