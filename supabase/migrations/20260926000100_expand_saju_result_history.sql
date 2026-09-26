-- 사용자별 최근 결과 목록을 지원합니다. 원본 생년월일·출생시간은 저장하지 않습니다.
alter table public.saju_results drop constraint if exists saju_results_pkey;
alter table public.saju_results add column if not exists id uuid default gen_random_uuid();
update public.saju_results set id = gen_random_uuid() where id is null;
alter table public.saju_results alter column id set not null;
alter table public.saju_results add constraint saju_results_pkey primary key (id);

alter table public.saju_results drop constraint if exists saju_results_topic_check;
alter table public.saju_results add constraint saju_results_topic_check check (
  topic in ('self', 'relationship', 'career', 'money', 'friends', 'family', 'study', 'path', 'hobby', 'health')
);

create index if not exists saju_results_user_created_idx
  on public.saju_results (user_id, created_at desc);

-- 기존 정책은 auth.uid() = user_id를 계속 사용하므로 여러 행도 본인 것만 접근할 수 있습니다.

create or replace function public.trim_saju_result_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.saju_results
  where id in (
    select id from public.saju_results
    where user_id = new.user_id
    order by created_at desc, id desc
    offset 10
  );
  return new;
end;
$$;

revoke all on function public.trim_saju_result_history() from public, anon;
grant execute on function public.trim_saju_result_history() to authenticated;

drop trigger if exists trim_saju_result_history_after_insert on public.saju_results;
create trigger trim_saju_result_history_after_insert
after insert on public.saju_results
for each row execute function public.trim_saju_result_history();
