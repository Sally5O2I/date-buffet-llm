-- ─────────────────────────────────────────────────────────────
-- Date Buffet Supabase 스키마
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전하다 (if not exists / drop policy if exists).
--
-- 설계 메모
--  - 로그인은 아이디+비밀번호 (Supabase Email 로그인, 아이디@blind-match.app 형식). 사용자 id = auth.uid()
--    대시보드에서 Email 로그인을 켜고 "Confirm email"은 꺼야 한다.
--  - 가상 인물 50명은 DB에 넣지 않고 앱 코드(src/data/generator.ts)에 있다. id는 'sample-01' 같은 문자열.
--    그래서 모든 id 컬럼은 text 이고, 가상 인물이 '나에게' 보내는 좋아요·메시지는 내가 대신 기록할 수 있게 허용한다.
--  - 매칭 계산은 브라우저에서 하므로 프로필은 jsonb 한 칸(data)에 통째로 저장한다.
-- ─────────────────────────────────────────────────────────────

-- 프로필
create table if not exists public.profiles (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint profiles_size check (octet_length(data::text) < 300000)
);

-- 좋아요 / 별로예요
create table if not exists public.swipes (
  from_id text not null,
  to_id text not null,
  liked boolean not null,
  at bigint not null,
  primary key (from_id, to_id)
);

-- 메시지
create table if not exists public.messages (
  id uuid primary key,
  from_id text not null,
  to_id text not null,
  text text not null check (char_length(text) between 1 and 300),
  at bigint not null
);
create index if not exists messages_from_idx on public.messages (from_id);
create index if not exists messages_to_idx on public.messages (to_id);

-- 게임 (진행 상태는 data jsonb)
create table if not exists public.games (
  id uuid primary key,
  from_id text not null,
  to_id text not null,
  data jsonb not null,
  created_at bigint not null
);
create index if not exists games_from_idx on public.games (from_id);
create index if not exists games_to_idx on public.games (to_id);

-- 게임 승리로 얻은 메시지 권한
create table if not exists public.unlocks (
  from_id text not null,
  to_id text not null,
  reason text not null default 'game-win',
  at bigint not null,
  primary key (from_id, to_id)
);

-- ───────────── 보안 규칙 (RLS) ─────────────
alter table public.profiles enable row level security;
alter table public.swipes   enable row level security;
alter table public.messages enable row level security;
alter table public.games    enable row level security;
alter table public.unlocks  enable row level security;

-- profiles: 로그인한 사람은 모두 읽기(매칭 계산용), 쓰기는 본인 것만
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated
  with check (id = (select auth.uid())::text);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())::text) with check (id = (select auth.uid())::text);
drop policy if exists "profiles delete own" on public.profiles;
create policy "profiles delete own" on public.profiles for delete to authenticated
  using (id = (select auth.uid())::text);

-- swipes: 나와 관련된 것만 읽기. 내가 누른 것 + 가상 인물이 나에게 누른 것만 쓰기
drop policy if exists "swipes read" on public.swipes;
create policy "swipes read" on public.swipes for select to authenticated
  using (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text);
drop policy if exists "swipes insert" on public.swipes;
create policy "swipes insert" on public.swipes for insert to authenticated
  with check (from_id = (select auth.uid())::text or (from_id like 'sample-%' and to_id = (select auth.uid())::text));
drop policy if exists "swipes update" on public.swipes;
create policy "swipes update" on public.swipes for update to authenticated
  using (from_id = (select auth.uid())::text or (from_id like 'sample-%' and to_id = (select auth.uid())::text))
  with check (from_id = (select auth.uid())::text or (from_id like 'sample-%' and to_id = (select auth.uid())::text));
drop policy if exists "swipes delete" on public.swipes;
create policy "swipes delete" on public.swipes for delete to authenticated
  using (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text);

-- messages: 당사자만 읽기. 내가 보낸 것 + 가상 인물의 자동 답장만 쓰기
drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select to authenticated
  using (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text);
drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert to authenticated
  with check (from_id = (select auth.uid())::text or (from_id like 'sample-%' and to_id = (select auth.uid())::text));
drop policy if exists "messages delete" on public.messages;
create policy "messages delete" on public.messages for delete to authenticated
  using (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text);

-- games: 참가자만 읽기·수정, 게임은 내가 건 것만 만들기
drop policy if exists "games read" on public.games;
create policy "games read" on public.games for select to authenticated
  using (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text);
drop policy if exists "games insert" on public.games;
create policy "games insert" on public.games for insert to authenticated
  with check (from_id = (select auth.uid())::text);
drop policy if exists "games update" on public.games;
create policy "games update" on public.games for update to authenticated
  using (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text)
  with check (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text);
drop policy if exists "games delete" on public.games;
create policy "games delete" on public.games for delete to authenticated
  using (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text);

-- unlocks: 참가자만 읽기. 실제로 끝난 게임의 승자 → 패자 방향일 때만 기록 가능
drop policy if exists "unlocks read" on public.unlocks;
create policy "unlocks read" on public.unlocks for select to authenticated
  using (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text);
drop policy if exists "unlocks insert" on public.unlocks;
create policy "unlocks insert" on public.unlocks for insert to authenticated
  with check (
    (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text)
    and exists (
      select 1 from public.games g
      where g.data->>'status' = 'done'
        and g.data->>'winner' = unlocks.from_id
        and ((g.from_id = unlocks.from_id and g.to_id = unlocks.to_id)
          or (g.from_id = unlocks.to_id and g.to_id = unlocks.from_id))
    )
  );
drop policy if exists "unlocks delete" on public.unlocks;
create policy "unlocks delete" on public.unlocks for delete to authenticated
  using (from_id = (select auth.uid())::text or to_id = (select auth.uid())::text);

-- ───────────── 계정 삭제 ─────────────
-- 브라우저에는 관리자 키가 없어서 로그인 계정(auth.users)을 직접 지울 수 없다.
-- 본인 계정만 지우는 함수를 security definer로 열어 둔다.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ───────────── 실시간 알림 ─────────────
do $$
declare t text;
begin
  foreach t in array array['profiles', 'swipes', 'messages', 'games', 'unlocks'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
