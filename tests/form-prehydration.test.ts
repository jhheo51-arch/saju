import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SajuForm from "../app/saju-form";

test("화면 자바스크립트가 준비되기 전에는 폼이 GET으로 개인정보를 주소에 붙이지 않는다", () => {
  const html = renderToStaticMarkup(createElement(SajuForm));
  const form = html.match(/<form\b[^>]*>/)?.[0];
  const submit = html.match(/<button\b(?=[^>]*type="submit")[^>]*>/)?.[0];

  assert.ok(form, "입력 폼이 있어야 합니다");
  assert.match(form, /\bmethod="post"/);
  assert.doesNotMatch(form, /\bmethod="get"/i);
  assert.ok(submit, "해석 제출 버튼이 있어야 합니다");
  assert.match(submit, /\bdisabled(?:=""|\s|>)/);
  assert.match(html, /화면을 준비하고 있어요/);

  // 생년월일·출생시간이 GET으로 전송되면 URL에 남습니다.
  for (const name of ["date", "time"]) {
    assert.match(html, new RegExp(`\\bname="${name}"`));
  }
  assert.doesNotMatch(html, /name="question"|요즘 궁금한 점/);
});

test("계정 연결이 준비되지 않아도 비로그인 해석 입력 화면은 남아 있다", () => {
  const html = renderToStaticMarkup(createElement(SajuForm));
  const googleButton = html.match(/<button\b[^>]*class="account-button"[^>]*>Google로 로그인<\/button>/)?.[0];
  assert.match(html, /Google로 로그인/);
  assert.match(html, /Google 로그인 후 해석을 만들고/);
  assert.match(html, /Google 로그인 후 해석할 수 있어요|화면을 준비하고 있어요/);
  assert.doesNotMatch(html, /로그인 없이도 해석할 수 있습니다/);
  assert.match(html, /<form\b[^>]*method="post"/);
  // 서버가 HTML을 보낸 직후에는 인증 정보가 아직 확정되지 않아 버튼을 누를 수 없어야 합니다.
  assert.ok(googleButton);
  assert.match(googleButton, /\bdisabled(?:=""|\s|>)/);
});
