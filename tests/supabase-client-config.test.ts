import test from "node:test";
import assert from "node:assert/strict";
import { getSajuSupabaseClient } from "../lib/saju/supabase-client";

test("설정이 있으면 공개 키만 사용해 인증 클라이언트를 준비한다", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const previousSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-admin-secret-must-not-be-used";
    const client = getSajuSupabaseClient();
    assert.ok(client);
    const details = client as unknown as { supabaseUrl: string; supabaseKey: string };
    assert.equal(details.supabaseUrl, "https://example.supabase.co");
    assert.equal(details.supabaseKey, "test-publishable-key");
    assert.notEqual(details.supabaseKey, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousSecret;
  }
});
