import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSavedInterpretation, type SavedInterpretation } from "./interpretation-storage";

const table = "saju_results";

export class AccountStorageError extends Error {}

export async function loadAccountResult(client: SupabaseClient, userId: string): Promise<SavedInterpretation | null> {
  const { data, error } = await client.from(table)
    .select("created_at,chart,topic,reading")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new AccountStorageError("계정에 저장된 해석을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
  if (!data) return null;
  const saved = parseSavedInterpretation({
    version: 1,
    createdAt: data.created_at,
    chart: data.chart,
    topic: data.topic,
    reading: data.reading,
  });
  if (!saved) throw new AccountStorageError("계정의 저장된 해석을 확인할 수 없어요. 새 해석을 만들어주세요.");
  return saved;
}

export async function saveAccountResult(client: SupabaseClient, userId: string, result: SavedInterpretation): Promise<void> {
  const checked = parseSavedInterpretation(result);
  if (!checked) throw new AccountStorageError("해석 결과를 확인할 수 없어 계정에 저장하지 않았어요.");
  const { error } = await client.from(table).upsert({
    user_id: userId,
    created_at: checked.createdAt,
    chart: checked.chart,
    topic: checked.topic,
    reading: checked.reading,
  }, { onConflict: "user_id" });
  if (error) throw new AccountStorageError("해석은 만들었지만 계정에 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
}

export async function clearAccountResult(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.from(table).delete().eq("user_id", userId);
  if (error) throw new AccountStorageError("계정에 저장된 해석을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.");
}
