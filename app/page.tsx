import SajuForm from "./saju-form";

export default function Page() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">전통의 말, 오늘의 이야기</p>
        <h1>나만의 사주 이야기</h1>
        <p className="intro">
          태어난 날과 시간으로 사주를 읽고, 어려운 말은 쉽게 풀어드려요.
        </p>
      </header>
      <SajuForm />
    </main>
  );
}
