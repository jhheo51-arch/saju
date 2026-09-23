-- 로그인한 사용자마다 최근 해석 한 건만 저장합니다.
create table if not exists public.saju_results (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null,
  chart jsonb not null check (jsonb_typeof(chart) = 'object'),
  topic text not null check (topic in ('relationship', 'career', 'money')),
  reading jsonb not null check (jsonb_typeof(reading) = 'object')
);

alter table public.saju_results enable row level security;
revoke all on table public.saju_results from anon, authenticated;
grant select, insert, update, delete on table public.saju_results to authenticated;

create policy "saju_results_select_own"
  on public.saju_results for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "saju_results_insert_own"
  on public.saju_results for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "saju_results_update_own"
  on public.saju_results for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "saju_results_delete_own"
  on public.saju_results for delete to authenticated
  using ((select auth.uid()) = user_id);
