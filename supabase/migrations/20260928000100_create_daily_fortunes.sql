-- 원본 생년월일·출생시간 대신 계산된 사주 차트만 오늘 운세 기준으로 보관합니다.
create table if not exists public.user_saju_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chart jsonb not null check (jsonb_typeof(chart) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_fortunes (
  user_id uuid not null references auth.users(id) on delete cascade,
  fortune_date date not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  source_profile_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, fortune_date)
);

alter table public.user_saju_profiles enable row level security;
alter table public.daily_fortunes enable row level security;

revoke all on table public.user_saju_profiles from anon, authenticated;
revoke all on table public.daily_fortunes from anon, authenticated;
grant select on table public.user_saju_profiles to authenticated;
grant select on table public.daily_fortunes to authenticated;

create policy "user_saju_profiles_select_own"
  on public.user_saju_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "daily_fortunes_select_own"
  on public.daily_fortunes for select to authenticated
  using ((select auth.uid()) = user_id);
