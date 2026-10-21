/**
 * 2단계 저장소: Supabase (아이디 + 비밀번호 로그인).
 * - 테이블·보안 규칙은 supabase/schema.sql
 * - Supabase 비밀번호 로그인은 이메일 형식이 필요해서, 아이디를 내부용 주소(아이디@blind-match.app)로 바꿔 쓴다.
 *   실제로 메일은 보내지 않으며 화면에는 아이디만 보인다. (대시보드에서 "Confirm email"을 꺼야 함)
 * - 사용자 id = auth.uid(). 로그인은 브라우저에 저장되므로 같은 브라우저의 탭들은 같은 계정이다.
 * - 가상 인물 50명은 DB가 아니라 코드(SAMPLE_PROFILES)에서 합쳐서 보여준다.
 * - 데이터 변경은 Realtime(postgres_changes), 접속 상태는 Realtime Presence로 알린다.
 */
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { SAMPLE_PROFILES } from '../data/sampleProfiles';
import { normalizeProfile } from '../domain/normalize';
import type { GameSession, Message, Profile, Swipe, Unlock } from '../domain/types';
import { AuthError, GameConflictError, type RepoTopic, type Repository } from './Repository';

const TABLES = ['profiles', 'swipes', 'messages', 'games', 'unlocks'] as const;

/** 아이디 → 내부용 이메일. 메일은 보내지 않는다 */
const LOGIN_DOMAIN = 'blind-match.app';
const toEmail = (username: string) => `${username}@${LOGIN_DOMAIN}`;
const usernameOf = (email: string | undefined | null) =>
  email?.endsWith(`@${LOGIN_DOMAIN}`) ? email.slice(0, -(LOGIN_DOMAIN.length + 1)) : email ?? null;

function authMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return '아이디 또는 비밀번호가 맞지 않아요.';
  if (/already registered|already exists/i.test(message)) return '이미 사용 중인 아이디예요.';
  if (/password should be at least/i.test(message)) return '비밀번호가 너무 짧아요. (Supabase 최소 길이 설정 확인)';
  if (/email not confirmed/i.test(message)) {
    return 'Supabase에서 이메일 확인이 켜져 있어요. 대시보드 → Authentication → Sign In / Providers → Email에서 "Confirm email"을 꺼 주세요.';
  }
  if (/signups not allowed|signup is disabled/i.test(message)) return 'Supabase에서 회원가입이 꺼져 있어요. Email 로그인과 "Allow new users to sign up"을 켜 주세요.';
  if (/rate limit/i.test(message)) return '잠시 후 다시 시도해 주세요. (요청이 너무 많아요)';
  return friendly(message);
}

function friendly(message: string): string {
  if (/function .*delete_my_account/i.test(message)) {
    return 'Supabase에 계정 삭제 함수가 없어요. 최신 supabase/schema.sql을 SQL Editor에서 다시 실행해 주세요.';
  }
  if (/relation .* does not exist|could not find the table/i.test(message)) {
    return 'Supabase에 테이블이 없어요. supabase/schema.sql을 SQL Editor에서 실행해 주세요.';
  }
  if (/row-level security/i.test(message)) return '권한이 없는 작업이에요.';
  if (/failed to fetch|network/i.test(message)) return '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.';
  return message;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(friendly(res.error.message));
  return res.data;
}

type ProfileRow = { id: string; data: Omit<Profile, 'id'> };
type SwipeRow = { from_id: string; to_id: string; liked: boolean; at: number };
type MessageRow = { id: string; from_id: string; to_id: string; text: string; at: number };
type UnlockRow = { from_id: string; to_id: string; reason: 'game-win'; at: number };
type GameRow = { id: string; data: GameSession };

export function createSupabaseRepository(url: string, key: string): Repository {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });

  const listeners = new Set<(t: RepoTopic) => void>();
  const emit = (t: RepoTopic) => listeners.forEach((l) => l(t));

  let dbChannel: RealtimeChannel | null = null;
  let presence: RealtimeChannel | null = null;
  let presenceUser: string | null = null;
  let online: string[] = [];

  function startDbChannel() {
    if (dbChannel) return;
    const ch = sb.channel('db-changes');
    for (const table of TABLES) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => emit(table));
    }
    ch.subscribe();
    dbChannel = ch;
  }

  function restartDbChannel() {
    if (dbChannel) sb.removeChannel(dbChannel);
    dbChannel = null;
    if (listeners.size > 0) startDbChannel();
  }

  async function stopPresence() {
    if (presence) await sb.removeChannel(presence);
    presence = null;
    presenceUser = null;
    online = [];
  }

  sb.auth.onAuthStateChange((event) => {
    if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
    // 콜백 안에서 바로 supabase 호출을 기다리면 교착될 수 있어 다음 틱으로 미룬다
    setTimeout(() => {
      restartDbChannel();
      emit('profiles');
    }, 0);
  });

  async function uid(): Promise<string | null> {
    const { data } = await sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async function deleteMyData(id: string) {
    const or = `from_id.eq.${id},to_id.eq.${id}`;
    await sb.from('swipes').delete().or(or);
    await sb.from('messages').delete().or(or);
    await sb.from('unlocks').delete().or(or);
    await sb.from('games').delete().or(or);
    check(await sb.from('profiles').delete().eq('id', id));
  }

  return {
    mode: 'supabase',

    async signUp(username, password) {
      await stopPresence();
      const res = await sb.auth.signUp({ email: toEmail(username), password, options: { data: { username } } });
      if (res.error) throw new AuthError(authMessage(res.error.message));
      if (!res.data.session || !res.data.user) {
        // 이메일 확인이 켜져 있으면 가입 직후 세션이 없다
        throw new AuthError(
          'Supabase에서 이메일 확인이 켜져 있어요. 대시보드 → Authentication → Sign In / Providers → Email에서 "Confirm email"을 꺼 주세요.',
        );
      }
      return res.data.user.id;
    },
    async signIn(username, password) {
      await stopPresence();
      const res = await sb.auth.signInWithPassword({ email: toEmail(username), password });
      if (res.error || !res.data.user) throw new AuthError(authMessage(res.error?.message ?? ''));
      return res.data.user.id;
    },
    async signOut() {
      await stopPresence();
      await sb.auth.signOut();
    },
    async getCurrentUserId() {
      return uid();
    },
    async getCurrentUsername() {
      const { data } = await sb.auth.getSession();
      return usernameOf(data.session?.user.email);
    },
    async deleteAccount() {
      const id = await uid();
      if (!id) return;
      await deleteMyData(id);
      // 로그인 계정 자체도 지운다 (schema.sql의 delete_my_account 함수)
      check(await sb.rpc('delete_my_account'));
      await stopPresence();
      await sb.auth.signOut();
    },

    async listProfiles() {
      if (!(await uid())) return [...SAMPLE_PROFILES];
      const rows = check(await sb.from('profiles').select('id, data')) as ProfileRow[];
      return [...SAMPLE_PROFILES, ...rows.map((r) => normalizeProfile({ ...r.data, id: r.id } as Profile))];
    },
    async saveProfile(profile) {
      const { id, ...data } = profile;
      check(await sb.from('profiles').upsert({ id, data, updated_at: new Date().toISOString() }));
      return profile;
    },

    async listSwipes() {
      if (!(await uid())) return [];
      const rows = check(await sb.from('swipes').select('from_id, to_id, liked, at')) as SwipeRow[];
      return rows.map((r): Swipe => ({ from: r.from_id, to: r.to_id, liked: r.liked, at: Number(r.at) }));
    },
    async saveSwipe(s) {
      check(
        await sb
          .from('swipes')
          .upsert({ from_id: s.from, to_id: s.to, liked: s.liked, at: s.at }, { onConflict: 'from_id,to_id' }),
      );
    },

    async listMessages(userId) {
      const rows = check(
        await sb.from('messages').select('*').or(`from_id.eq.${userId},to_id.eq.${userId}`).order('at').limit(1000),
      ) as MessageRow[];
      return rows.map((r): Message => ({ id: r.id, from: r.from_id, to: r.to_id, text: r.text, at: Number(r.at) }));
    },
    async sendMessage(m) {
      check(await sb.from('messages').insert({ id: m.id, from_id: m.from, to_id: m.to, text: m.text, at: m.at }));
      return m;
    },

    async listUnlocks() {
      if (!(await uid())) return [];
      const rows = check(await sb.from('unlocks').select('*')) as UnlockRow[];
      return rows.map((r): Unlock => ({ from: r.from_id, to: r.to_id, reason: r.reason, at: Number(r.at) }));
    },
    async addUnlock(u) {
      check(
        await sb
          .from('unlocks')
          .upsert(
            { from_id: u.from, to_id: u.to, reason: u.reason, at: u.at },
            { onConflict: 'from_id,to_id', ignoreDuplicates: true },
          ),
      );
    },

    async listGames(userId) {
      const rows = check(
        await sb
          .from('games')
          .select('id, data')
          .or(`from_id.eq.${userId},to_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(50),
      ) as GameRow[];
      return rows.map((r) => ({ ...r.data, id: r.id }));
    },
    async createGame(g) {
      check(await sb.from('games').insert({ id: g.id, from_id: g.from, to_id: g.to, data: g, created_at: g.createdAt }));
      return g;
    },
    async updateGame(id, patch, expectedUpdatedAt) {
      const row = check(await sb.from('games').select('data').eq('id', id).maybeSingle()) as { data: GameSession } | null;
      if (!row) return null;
      const base = row.data;
      if (expectedUpdatedAt !== undefined && base.updatedAt !== expectedUpdatedAt) throw new GameConflictError();
      // undefined 값은 JSON으로 저장될 때 빠지므로 '수 초기화(비김)'도 그대로 반영된다
      const merged: GameSession = JSON.parse(
        JSON.stringify({ ...base, ...patch, updatedAt: Math.max(Date.now(), base.updatedAt + 1) }),
      );
      // 읽은 뒤 다른 사람이 먼저 고쳤으면 0행이 바뀐다 → 충돌
      const updated = check(
        await sb
          .from('games')
          .update({ data: merged })
          .eq('id', id)
          .eq('data->>updatedAt', String(base.updatedAt))
          .select('id'),
      ) as { id: string }[];
      if (updated.length === 0) throw new GameConflictError();
      return merged;
    },

    async heartbeat(userId) {
      if (presence && presenceUser === userId) return;
      await stopPresence();
      presenceUser = userId;
      const ch = sb.channel('online', { config: { presence: { key: userId } } });
      ch.on('presence', { event: 'sync' }, () => {
        online = Object.keys(ch.presenceState());
        emit('presence');
      });
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await ch.track({ at: Date.now() });
      });
      presence = ch;
    },
    async listOnlineIds() {
      return online;
    },

    subscribe(listener) {
      listeners.add(listener);
      startDbChannel();
      return () => listeners.delete(listener);
    },

    async reset() {
      await this.deleteAccount();
    },
  };
}
