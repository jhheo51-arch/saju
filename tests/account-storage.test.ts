import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculate } from "../lib/saju/chart";
import { clearAccountResult, loadAccountResult, saveAccountResult, AccountStorageError } from "../lib/saju/account-storage";
import { parseSavedInterpretation, type SavedInterpretation } from "../lib/saju/interpretation-storage";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const saved: SavedInterpretation = {
  version: 1,
  createdAt: "2026-09-23T08:00:00.000Z",
  chart: calculate({ date: "2005-12-23", time: "08:37", calendar: "solar", topic: "career", question: "" }),
  topic: "career",
  reading: {
    personality: { headline: "차근차근 살펴봐요", body: "새로운 일을 하나씩 배워 보세요." },
    topic: { kind: "career", headline: "일 이야기", body: "관심 있는 일을 찾아보세요." },
    today: { date: "2026-09-23", headline: "오늘의 한 걸음", body: "작은 목표를 세워 보세요." },
  },
};

type Operation = { action: string; table?: string; columns?: string; filter?: [string, string]; value?: unknown; options?: unknown };

function mockClient(data: unknown = null, error: unknown = null) {
  const operations: Operation[] = [];
  const query = {
    select(columns: string) { operations.push({ action: "select", columns }); return this; },
    eq(column: string, value: string) { operations.push({ action: "eq", filter: [column, value] }); return this; },
    maybeSingle() { operations.push({ action: "maybeSingle" }); return Promise.resolve({ data, error }); },
    upsert(value: unknown, options: unknown) { operations.push({ action: "upsert", value, options }); return Promise.resolve({ error }); },
    delete() { operations.push({ action: "delete" }); return this; },
    then(resolve: (value: { error: unknown }) => unknown) { return Promise.resolve({ error }).then(resolve); },
  };
  const client = { from(table: string) { operations.push({ action: "from", table }); return query; } } as unknown as SupabaseClient;
  return { client, operations };
}

test("검증된 결과만 계정에서 읽고, 사용자 ID로 한 행을 좁힌다", async () => {
  const { client, operations } = mockClient({ created_at: saved.createdAt, chart: saved.chart, topic: saved.topic, reading: saved.reading });
  assert.deepEqual(await loadAccountResult(client, userId), saved);
  assert.deepEqual(operations.map((item) => item.action), ["from", "select", "eq", "maybeSingle"]);
  assert.equal(operations[0].table, "saju_results");
  assert.deepEqual(operations[2].filter, ["user_id", userId]);
});

test("계정에 결과가 없으면 null을 반환하고, 손상된 결과는 표시하지 않는다", async () => {
  assert.equal(await loadAccountResult(mockClient().client, userId), null);
  for (const row of [
    { created_at: saved.createdAt, chart: saved.chart, topic: "wrong", reading: saved.reading },
    { created_at: saved.createdAt, chart: saved.chart, topic: saved.topic, reading: { topic: {} } },
    { created_at: "invalid", chart: saved.chart, topic: saved.topic, reading: saved.reading },
  ]) {
    await assert.rejects(loadAccountResult(mockClient(row).client, userId), AccountStorageError);
  }
  assert.equal(parseSavedInterpretation({ ...saved, reading: { topic: {} } }), null);
});

test("저장은 사용자 ID로 덮어쓰고 원본 입력·질문·토큰을 보내지 않는다", async () => {
  const { client, operations } = mockClient();
  await saveAccountResult(client, userId, saved);
  const upsert = operations.find((item) => item.action === "upsert");
  assert.ok(upsert);
  assert.deepEqual(upsert.options, { onConflict: "user_id" });
  assert.deepEqual(upsert.value, {
    user_id: userId,
    created_at: saved.createdAt,
    chart: saved.chart,
    topic: saved.topic,
    reading: saved.reading,
  });
  assert.equal(operations[0].table, "saju_results");
  assert.doesNotMatch(JSON.stringify(upsert.value), /2005-12-23|08:37|access_token|refresh_token/);
});

test("형식이 잘못된 해석은 데이터베이스로 보내지 않는다", async () => {
  const invalid = { ...saved, reading: { ...saved.reading, topic: { kind: "money", headline: "돈", body: "설명" } } } as SavedInterpretation;
  const { client, operations } = mockClient();
  await assert.rejects(saveAccountResult(client, userId, invalid), AccountStorageError);
  assert.equal(operations.length, 0);
});

test("삭제는 사용자 ID로 좁히고, 실패 시 성공으로 표시하지 않는다", async () => {
  const success = mockClient();
  await clearAccountResult(success.client, userId);
  assert.deepEqual(success.operations.map((item) => item.action), ["from", "delete", "eq"]);
  assert.deepEqual(success.operations[2].filter, ["user_id", userId]);
  const failed = mockClient(null, { code: "42501" });
  await assert.rejects(clearAccountResult(failed.client, userId), AccountStorageError);
  await assert.rejects(saveAccountResult(failed.client, userId, saved), AccountStorageError);
  await assert.rejects(loadAccountResult(failed.client, userId), AccountStorageError);
});

test("마이그레이션은 비로그인 접근을 막고 본인 행에만 CRUD 정책을 건다", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260923000100_create_saju_results.sql", import.meta.url), "utf8").toLowerCase();
  assert.match(sql, /user_id\s+uuid\s+primary key\s+references\s+auth\.users\s*\(id\)/);
  assert.match(sql, /enable\s+row\s+level\s+security/);
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.saju_results\s+from\s+anon/);
  for (const [verb, condition] of [["select", "using"], ["insert", "with check"], ["update", "using"], ["delete", "using"]]) {
    const policy = sql.match(new RegExp(`create\\s+policy[\\s\\S]*?for\\s+${verb}\\s+to\\s+authenticated[\\s\\S]*?;`))?.[0];
    assert.ok(policy, `${verb} 정책이 있어야 합니다`);
    assert.match(policy, new RegExp(`${condition.replace(" ", "\\s+")}\\s*\\([^;]*auth\\.uid\\(\\)[^;]*=\\s*user_id`));
  }
  const update = sql.match(/create\s+policy[^;]*for\s+update[^;]*;/)?.[0] ?? "";
  assert.match(update, /with\s+check\s*\([^;]*auth\.uid\(\)[^;]*=\s*user_id/);
});
