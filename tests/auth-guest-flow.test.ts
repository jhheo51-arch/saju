import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 브라우저 상호작용은 별도 화면 검사 대상입니다. 이 검사는 초기 인증 분기의 회귀를 막습니다.
const source = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");

test("세션이 없는 방문은 getUser 실패로 취급하지 않고 비로그인 결과를 복원한다", () => {
  const refresh = source.match(/async function refreshAccount\(restoreGuest: boolean\) \{([\s\S]*?)\n    \}\n\n    const \{ data: \{ subscription \} \}/)?.[1];
  assert.ok(refresh, "초기 계정 확인 흐름이 있어야 합니다");
  assert.match(refresh, /const \{ data: sessionData, error: sessionError \} = await client!\.auth\.getSession\(\)/);
  assert.match(refresh, /if \(sessionError\) sessionFailed = true;\s*else if \(sessionData\.session\) \{\s*const \{ data, error: userError \} = await client!\.auth\.getUser\(\)/);
  assert.match(refresh, /else if \(restoreGuest\) \{\s*restoreBrowserResult\(\)/);
  assert.match(refresh, /if \(active && current === revision\) setReady\(true\)/);
});
