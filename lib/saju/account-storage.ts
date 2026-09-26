import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSavedInterpretation, type SavedInterpretation } from "./interpretation-storage";

const table = "saju_results";
export const ACCOUNT_RESULT_LIMIT = 10;

export type AccountSavedInterpretation = SavedInterpretation & { id: string };

export class AccountStorageError extends Error {}

function parseAccountRow(value: unknown): AccountSavedInterpretation | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) return null;
  const saved = parseSavedInterpretation({
    version: 1,
    createdAt: row.created_at,
    chart: row.chart,
    topic: row.topic,
    reading: row.reading,
  });
  return saved ? { ...saved, id: row.id } : null;
}

export async function loadAccountResults(client: SupabaseClient, userId: string): Promise<AccountSavedInterpretation[]> {
  const { data, error } = await client.from(table)
    .select("id,created_at,chart,topic,reading")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(ACCOUNT_RESULT_LIMIT);
  if (error) throw new AccountStorageError("계정에 저장된 해석을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
  if (!Array.isArray(data)) return [];
  const parsed = data.map(parseAccountRow);
  if (parsed.some((item) => !item)) throw new AccountStorageError("계정의 저장된 해석을 확인할 수 없어요. 손상된 결과를 삭제한 뒤 다시 시도해주세요.");
  return parsed as AccountSavedInterpretation[];
}

export async function loadAccountResult(client: SupabaseClient, userId: string): Promise<SavedInterpretation | null> {
  const [latest] = await loadAccountResults(client, userId);
  if (!latest) return null;
  const { id: _id, ...saved } = latest;
  return saved;
}

export async function saveAccountResult(client: SupabaseClient, userId: string, result: SavedInterpretation): Promise<string> {
  const checked = parseSavedInterpretation(result);
  if (!checked) throw new AccountStorageError("해석 결과를 확인할 수 없어 계정에 저장하지 않았어요.");
  const { data, error } = await client.from(table).insert({
    user_id: userId,
    created_at: checked.createdAt,
    chart: checked.chart,
    topic: checked.topic,
    reading: checked.reading,
  }).select("id").single();
  if (error || !data?.id) throw new AccountStorageError("해석은 만들었지만 계정에 저장하지 못했어요. 잠시 후 다시 시도해주세요.");

  const { data: overflow } = await client.from(table)
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(ACCOUNT_RESULT_LIMIT, ACCOUNT_RESULT_LIMIT + 49);
  const oldIds = Array.isArray(overflow) ? overflow.map((row) => row.id).filter((id): id is string => typeof id === "string") : [];
  if (oldIds.length) await client.from(table).delete().eq("user_id", userId).in("id", oldIds);
  return data.id;
}

export async function updateAccountResult(client: SupabaseClient, userId: string, resultId: string, result: SavedInterpretation): Promise<void> {
  const checked = parseSavedInterpretation(result);
  if (!checked) throw new AccountStorageError("해석 결과를 확인할 수 없어 계정에 저장하지 않았어요.");
  const { error } = await client.from(table).update({ reading: checked.reading })
    .eq("user_id", userId)
    .eq("id", resultId);
  if (error) throw new AccountStorageError("답변을 계정 결과에 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
}

export async function clearAccountResult(client: SupabaseClient, userId: string, resultId?: string): Promise<void> {
  let query = client.from(table).delete().eq("user_id", userId);
  if (resultId) query = query.eq("id", resultId);
  const { error } = await query;
  if (error) throw new AccountStorageError("계정에 저장된 해석을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.");
}
