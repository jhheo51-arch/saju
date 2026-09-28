import test from "node:test";
import assert from "node:assert/strict";
import { getSajuSupabaseClient } from "../lib/saju/supabase-client";

test("Supabase 공개 설정이 없으면 로그인 클라이언트를 만들지 않는다", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.equal(getSajuSupabaseClient(), null);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});

test("[SENSITIVE]로 가려진 URL은 클라이언트 생성 오류 없이 비설정으로 처리한다", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "[SENSITIVE]";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

    // 모듈별 캐시와 무관하게, 실제 환경값으로 처음 초기화하는 경로를 검증한다.
    const moduleUrl = new URL("../lib/saju/supabase-client.ts", import.meta.url);
    moduleUrl.searchParams.set("masked-url-test", String(Date.now()));
    const { getSajuSupabaseClient: getFreshClient } = await import(moduleUrl.href);
    assert.equal(getFreshClient(), null);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});
