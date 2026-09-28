import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkRateLimit, resetRateLimitsForTest } from "../lib/saju/server-rate-limit";

test("요청 제한기는 사용자·기능별 창을 분리하고 만료 뒤 다시 허용한다", () => {
  resetRateLimitsForTest();
  const startedAt = 1_000_000;
  for (let count = 0; count < 5; count++) {
    assert.deepEqual(checkRateLimit("interpret:user-a", 5, 60_000, startedAt + count), { allowed: true, retryAfter: 0 });
  }
  assert.deepEqual(checkRateLimit("interpret:user-a", 5, 60_000, startedAt + 30_000), { allowed: false, retryAfter: 30 });
  assert.equal(checkRateLimit("interpret:user-b", 5, 60_000, startedAt + 30_000).allowed, true);
  assert.equal(checkRateLimit("question:user-a", 10, 60_000, startedAt + 30_000).allowed, true);
  assert.deepEqual(checkRateLimit("interpret:user-a", 5, 60_000, startedAt + 60_000), { allowed: true, retryAfter: 0 });
});

test("해석과 질문 API는 인증 사용자별 한도·429·재시도 초를 명시한다", () => {
  const interpret = readFileSync(new URL("../app/api/interpret/route.ts", import.meta.url), "utf8");
  const question = readFileSync(new URL("../app/api/question/route.ts", import.meta.url), "utf8");

  assert.match(interpret, /checkApiRateLimit\(`interpret:\$\{auth\.userId\}`, 5, 60_000\)/);
  assert.match(question, /checkApiRateLimit\(`question:\$\{auth\.userId\}`, 10, 60_000\)/);
  for (const source of [interpret, question]) {
    assert.match(source, /status: 429/);
    assert.match(source, /"Retry-After": String\(rate\.retryAfter\)/);
    assert.match(source, /"Cache-Control": "no-store"/);
  }
});

test("두 API는 큰 요청 본문을 모델 호출 전에 거절한다", () => {
  const interpret = readFileSync(new URL("../app/api/interpret/route.ts", import.meta.url), "utf8");
  const question = readFileSync(new URL("../app/api/question/route.ts", import.meta.url), "utf8");
  assert.match(interpret, /content-length[\s\S]*?> 4096[\s\S]*?status: 413/);
  assert.match(question, /content-length[\s\S]*?> 65536[\s\S]*?status: 413/);
});
