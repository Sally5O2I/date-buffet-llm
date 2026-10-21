/**
 * 1단계 저장소: localStorage + 가상 샘플 50명.
 * - 계정(아이디·비밀번호)은 이 브라우저에만 저장된다. 비밀번호는 PBKDF2 해시로만 보관한다.
 * - 로그인 상태는 sessionStorage에 둬서 탭마다 다른 계정으로 테스트할 수 있다.
 * - 탭 간 변경은 BroadcastChannel + storage 이벤트로 알린다.
 */
import { SAMPLE_PROFILES } from '../data/sampleProfiles';
import { normalizeProfile } from '../domain/normalize';
import type { GameSession, Message, Profile, Swipe, Unlock } from '../domain/types';
import { AuthError, GameConflictError, StorageFullError, type RepoTopic, type Repository } from './Repository';

const PREFIX = 'bm.';
const KEYS: Record<RepoTopic | 'accounts', string> = {
  profiles: `${PREFIX}profiles`,
  swipes: `${PREFIX}swipes`,
  messages: `${PREFIX}messages`,
  unlocks: `${PREFIX}unlocks`,
  games: `${PREFIX}games`,
  presence: `${PREFIX}presence`,
  accounts: `${PREFIX}auth`,
};
const CURRENT_KEY = `${PREFIX}currentUser`;
const ONLINE_WINDOW_MS = 15_000;

interface LocalAccount {
  id: string;
  salt: string;
  hash: string;
  createdAt: number;
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 },
    key,
    256,
  );
  return toHex(bits);
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function createLocalRepository(): Repository {
  const listeners = new Set<(t: RepoTopic) => void>();
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('blind-match') : null;

  const emit = (topic: RepoTopic) => listeners.forEach((l) => l(topic));

  channel?.addEventListener('message', (e: MessageEvent<RepoTopic>) => emit(e.data));
  window.addEventListener('storage', (e) => {
    const topic = (Object.keys(KEYS) as (RepoTopic | 'accounts')[]).find((k) => KEYS[k] === e.key);
    if (topic && topic !== 'accounts') emit(topic);
  });

  function write(topic: RepoTopic | 'accounts', value: unknown) {
    try {
      localStorage.setItem(KEYS[topic], JSON.stringify(value));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') throw new StorageFullError();
      throw err;
    }
    if (topic !== 'accounts') {
      emit(topic);
      channel?.postMessage(topic);
    }
  }

  const userProfiles = () => read<Profile[]>(KEYS.profiles, []);
  const accounts = () => read<Record<string, LocalAccount>>(KEYS.accounts, {});

  function setCurrent(id: string | null) {
    if (id) {
      sessionStorage.setItem(CURRENT_KEY, id);
      localStorage.setItem(CURRENT_KEY, id); // 새 탭의 기본값
    } else {
      sessionStorage.removeItem(CURRENT_KEY);
      localStorage.removeItem(CURRENT_KEY);
    }
  }

  /** 로그인 중인 계정 (계정 목록에 없는 예전 세션은 무시) */
  function current(): { username: string; account: LocalAccount } | null {
    const id = sessionStorage.getItem(CURRENT_KEY) ?? localStorage.getItem(CURRENT_KEY);
    if (!id) return null;
    const entry = Object.entries(accounts()).find(([, a]) => a.id === id);
    return entry ? { username: entry[0], account: entry[1] } : null;
  }

  function removeUserData(id: string) {
    write('profiles', userProfiles().filter((p) => p.id !== id));
    write('swipes', read<Swipe[]>(KEYS.swipes, []).filter((s) => s.from !== id && s.to !== id));
    write('messages', read<Message[]>(KEYS.messages, []).filter((m) => m.from !== id && m.to !== id));
    write('unlocks', read<Unlock[]>(KEYS.unlocks, []).filter((u) => u.from !== id && u.to !== id));
    write('games', read<GameSession[]>(KEYS.games, []).filter((g) => g.from !== id && g.to !== id));
  }

  return {
    mode: 'local',

    async signUp(username, password) {
      const all = accounts();
      if (all[username]) throw new AuthError('이미 사용 중인 아이디예요.');
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
      const account: LocalAccount = {
        id: `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        salt,
        hash: await hashPassword(password, salt),
        createdAt: Date.now(),
      };
      write('accounts', { ...all, [username]: account });
      setCurrent(account.id);
      return account.id;
    },
    async signIn(username, password) {
      const account = accounts()[username];
      if (!account || (await hashPassword(password, account.salt)) !== account.hash) {
        throw new AuthError('아이디 또는 비밀번호가 맞지 않아요.');
      }
      setCurrent(account.id);
      return account.id;
    },
    async signOut() {
      setCurrent(null);
    },
    async getCurrentUserId() {
      return current()?.account.id ?? null;
    },
    async getCurrentUsername() {
      return current()?.username ?? null;
    },
    async deleteAccount() {
      const cur = current();
      if (!cur) return;
      removeUserData(cur.account.id);
      const all = accounts();
      delete all[cur.username];
      write('accounts', all);
      setCurrent(null);
    },

    async listProfiles() {
      return [...SAMPLE_PROFILES, ...userProfiles().map(normalizeProfile)];
    },
    async saveProfile(profile) {
      const list = userProfiles().filter((p) => p.id !== profile.id);
      write('profiles', [...list, profile]);
      return profile;
    },

    async listSwipes() {
      return read<Swipe[]>(KEYS.swipes, []);
    },
    async saveSwipe(swipe) {
      const list = read<Swipe[]>(KEYS.swipes, []).filter((s) => !(s.from === swipe.from && s.to === swipe.to));
      write('swipes', [...list, swipe]);
    },

    async listMessages(userId) {
      return read<Message[]>(KEYS.messages, []).filter((m) => m.from === userId || m.to === userId);
    },
    async sendMessage(message) {
      write('messages', [...read<Message[]>(KEYS.messages, []), message]);
      return message;
    },

    async listUnlocks() {
      return read<Unlock[]>(KEYS.unlocks, []);
    },
    async addUnlock(unlock) {
      const list = read<Unlock[]>(KEYS.unlocks, []);
      if (list.some((u) => u.from === unlock.from && u.to === unlock.to)) return;
      write('unlocks', [...list, unlock]);
    },

    async listGames(userId) {
      return read<GameSession[]>(KEYS.games, []).filter((g) => g.from === userId || g.to === userId);
    },
    async createGame(game) {
      // 오래된 게임 기록은 50개까지만 보관
      write('games', [...read<GameSession[]>(KEYS.games, []).slice(-50), game]);
      return game;
    },
    async updateGame(id, patch, expectedUpdatedAt) {
      const list = read<GameSession[]>(KEYS.games, []);
      const idx = list.findIndex((g) => g.id === id);
      if (idx < 0) return null;
      if (expectedUpdatedAt !== undefined && list[idx].updatedAt !== expectedUpdatedAt) throw new GameConflictError();
      list[idx] = { ...list[idx], ...patch, updatedAt: Math.max(Date.now(), list[idx].updatedAt + 1) };
      write('games', list);
      return list[idx];
    },

    async heartbeat(userId) {
      const map = read<Record<string, number>>(KEYS.presence, {});
      const now = Date.now();
      const wasOnline = (map[userId] ?? 0) > now - ONLINE_WINDOW_MS;
      map[userId] = now;
      for (const [k, v] of Object.entries(map)) if (v < now - ONLINE_WINDOW_MS * 4) delete map[k];
      // 상태가 바뀔 때만 알림을 보내 불필요한 리렌더를 줄인다
      if (wasOnline) localStorage.setItem(KEYS.presence, JSON.stringify(map));
      else write('presence', map);
    },
    async listOnlineIds() {
      const now = Date.now();
      return Object.entries(read<Record<string, number>>(KEYS.presence, {}))
        .filter(([, t]) => t > now - ONLINE_WINDOW_MS)
        .map(([id]) => id);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async reset() {
      for (const key of Object.values(KEYS)) localStorage.removeItem(key);
      localStorage.removeItem(`${PREFIX}accounts`); // 아이디·비밀번호 도입 전 형식
      localStorage.removeItem(CURRENT_KEY);
      sessionStorage.removeItem(CURRENT_KEY);
      (['profiles', 'swipes', 'messages', 'unlocks', 'games', 'presence'] as RepoTopic[]).forEach((t) => {
        emit(t);
        channel?.postMessage(t);
      });
    },
  };
}
