import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculate } from "../lib/saju/chart";
import { ACCOUNT_RESULT_LIMIT, clearAccountResult, loadAccountResult, loadAccountResults, saveAccountResult, updateAccountResult, AccountStorageError } from "../lib/saju/account-storage";
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

type Operation = { action: string; table?: string; columns?: string; filter?: [string, unknown]; value?: unknown; options?: unknown };

function accountRow(value: SavedInterpretation, id = "11111111-1111-4111-8111-111111111111") {
  return { id, created_at: value.createdAt, chart: value.chart, topic: value.topic, reading: value.reading };
}

function mockClient(rows: unknown[] | null = [], error: unknown = null, overflow: unknown[] = []) {
  const operations: Operation[] = [];
  const client = { from(table: string) {
    operations.push({ action: "from", table });
    let mode: "select" | "insert" | "update" | "delete" | undefined;
    let ranged = false;
    const query = {
      select(columns: string) { operations.push({ action: "select", columns }); mode ||= "select"; return this; },
      eq(column: string, value: unknown) { operations.push({ action: "eq", filter: [column, value] }); return this; },
      order(column: string, options: unknown) { operations.push({ action: "order", columns: column, options }); return this; },
      limit(value: number) { operations.push({ action: "limit", value }); return this; },
      range(from: number, to: number) { operations.push({ action: "range", value: [from, to] }); ranged = true; return this; },
      insert(value: unknown) { operations.push({ action: "insert", value }); mode = "insert"; return this; },
      single() { operations.push({ action: "single" }); return Promise.resolve({ data: { id: "22222222-2222-4222-8222-222222222222" }, error }); },
      update(value: unknown) { operations.push({ action: "update", value }); mode = "update"; return this; },
      delete() { operations.push({ action: "delete" }); mode = "delete"; return this; },
      in(column: string, value: unknown) { operations.push({ action: "in", columns: column, value }); return this; },
      then(resolve: (value: { data: unknown; error: unknown }) => unknown, reject?: (reason: unknown) => unknown) {
        const data = mode === "select" ? (ranged ? overflow : rows) : null;
        return Promise.resolve({ data, error }).then(resolve, reject);
      },
    };
    return query;
  } } as unknown as SupabaseClient;
  return { client, operations };
}

test("검증된 최근 결과를 최신순 최대 10건 읽고 사용자 ID로 좁힌다", async () => {
  const first = accountRow(saved);
  const second = accountRow({ ...saved, createdAt: "2026-09-22T08:00:00.000Z" }, "33333333-3333-4333-8333-333333333333");
  const { client, operations } = mockClient([first, second]);
  assert.deepEqual(await loadAccountResults(client, userId), [
    { ...saved, id: first.id },
    { ...saved, createdAt: "2026-09-22T08:00:00.000Z", id: second.id },
  ]);
  assert.deepEqual(operations.map((item) => item.action), ["from", "select", "eq", "order", "limit"]);
  assert.equal(operations[0].table, "saju_results");
  assert.deepEqual(operations[2].filter, ["user_id", userId]);
  assert.deepEqual(operations[3].options, { ascending: false });
  assert.equal(operations[4].value, ACCOUNT_RESULT_LIMIT);
});

test("계정에 결과가 없으면 null을 반환하고, 손상된 결과는 표시하지 않는다", async () => {
  assert.equal(await loadAccountResult(mockClient([]).client, userId), null);
  for (const row of [
    { ...accountRow(saved), topic: "wrong" },
    { ...accountRow(saved), reading: { topic: {} } },
    { ...accountRow(saved), created_at: "invalid" },
    { ...accountRow(saved), id: "" },
  ]) {
    await assert.rejects(loadAccountResults(mockClient([row]).client, userId), AccountStorageError);
  }
  assert.equal(parseSavedInterpretation({ ...saved, reading: { topic: {} } }), null);
});

test("저장은 새 행을 만들고 최근 10건을 넘은 본인 결과만 정리하며 원본 개인정보를 보내지 않는다", async () => {
  const oldIds = ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"];
  const { client, operations } = mockClient();
  const withOverflow = mockClient([], null, oldIds.map((id) => ({ id })));
  assert.equal(await saveAccountResult(withOverflow.client, userId, saved), "22222222-2222-4222-8222-222222222222");
  const insert = withOverflow.operations.find((item) => item.action === "insert");
  assert.ok(insert);
  assert.deepEqual(insert.value, {
    user_id: userId,
    created_at: saved.createdAt,
    chart: saved.chart,
    topic: saved.topic,
    reading: saved.reading,
  });
  assert.doesNotMatch(JSON.stringify(insert.value), /2005-12-23|08:37|access_token|refresh_token/);
  assert.ok(withOverflow.operations.some((item) => item.action === "range" && JSON.stringify(item.value) === "[10,59]"));
  assert.ok(withOverflow.operations.some((item) => item.action === "in" && item.columns === "id" && JSON.stringify(item.value) === JSON.stringify(oldIds)));
  assert.ok(withOverflow.operations.filter((item) => item.action === "eq").every((item) => item.filter?.[0] === "user_id"));
  assert.equal(operations.length, 0);
});

test("형식이 잘못된 해석은 데이터베이스로 보내지 않는다", async () => {
  const invalid = { ...saved, reading: { ...saved.reading, topic: { kind: "money", headline: "돈", body: "설명" } } } as SavedInterpretation;
  const { client, operations } = mockClient();
  await assert.rejects(saveAccountResult(client, userId, invalid), AccountStorageError);
  assert.equal(operations.length, 0);
});

test("개별 삭제·전체 삭제·질문 답변 갱신은 사용자와 결과 ID로 좁힌다", async () => {
  const success = mockClient();
  await clearAccountResult(success.client, userId, "result-1");
  assert.deepEqual(success.operations.map((item) => item.action), ["from", "delete", "eq", "eq"]);
  assert.deepEqual(success.operations[2].filter, ["user_id", userId]);
  assert.deepEqual(success.operations[3].filter, ["id", "result-1"]);

  const clearAll = mockClient();
  await clearAccountResult(clearAll.client, userId);
  assert.deepEqual(clearAll.operations.map((item) => item.action), ["from", "delete", "eq"]);

  const update = mockClient();
  await updateAccountResult(update.client, userId, "result-1", saved);
  assert.deepEqual(update.operations.map((item) => item.action), ["from", "update", "eq", "eq"]);
  assert.deepEqual(update.operations.find((item) => item.action === "update")?.value, { reading: saved.reading });
});

test("저장소 오류는 읽기·저장·갱신·삭제 성공으로 표시하지 않는다", async () => {
  const failed = mockClient(null, { code: "42501" });
  await assert.rejects(clearAccountResult(failed.client, userId), AccountStorageError);
  await assert.rejects(saveAccountResult(failed.client, userId, saved), AccountStorageError);
  await assert.rejects(loadAccountResults(failed.client, userId), AccountStorageError);
  await assert.rejects(updateAccountResult(failed.client, userId, "result-1", saved), AccountStorageError);
});

test("마이그레이션은 비로그인 접근을 막고 본인 행에만 CRUD 정책을 건다", () => {
  const initial = readFileSync(new URL("../supabase/migrations/20260923000100_create_saju_results.sql", import.meta.url), "utf8").toLowerCase();
  const expansion = readFileSync(new URL("../supabase/migrations/20260926000100_expand_saju_result_history.sql", import.meta.url), "utf8").toLowerCase();
  const sql = `${initial}\n${expansion}`;
  assert.match(sql, /enable\s+row\s+level\s+security/);
  assert.match(sql, /revoke\s+all\s+on\s+table\s+public\.saju_results\s+from\s+anon/);
  for (const [verb, condition] of [["select", "using"], ["insert", "with check"], ["update", "using"], ["delete", "using"]]) {
    const policy = sql.match(new RegExp(`create\\s+policy[\\s\\S]*?for\\s+${verb}\\s+to\\s+authenticated[\\s\\S]*?;`))?.[0];
    assert.ok(policy, `${verb} 정책이 있어야 합니다`);
    assert.match(policy, new RegExp(`${condition.replace(" ", "\\s+")}\\s*\\([^;]*auth\\.uid\\(\\)[^;]*=\\s*user_id`));
  }
  const update = sql.match(/create\s+policy[^;]*for\s+update[^;]*;/)?.[0] ?? "";
  assert.match(update, /with\s+check\s*\([^;]*auth\.uid\(\)[^;]*=\s*user_id/);
  assert.match(expansion, /add\s+column\s+if\s+not\s+exists\s+id\s+uuid/);
  assert.match(expansion, /primary\s+key\s*\(id\)/);
  assert.match(expansion, /create\s+index[^;]*user_id[^;]*created_at\s+desc/);
  assert.doesNotMatch(expansion, /birth|date_of_birth|raw_question|access_token|refresh_token/);
});
