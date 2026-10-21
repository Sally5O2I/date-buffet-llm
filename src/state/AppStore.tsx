import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isMutualLike } from '../domain/social';
import type { CoinSide, GameKind, GameSession, Message, Profile, RpsMove, Swipe, Unlock } from '../domain/types';
import { containsContactInfo, CONTACT_ERROR } from '../domain/validation';
import { repo } from '../repository';
import { botHandleGame, botReply, isBotOnline, onLikeBot } from '../services/bots';
import { submitMove } from '../services/games';

interface Settings {
  /** 한 프로필의 TOP 10 노출 상한 사용 여부 */
  exposureCapOn: boolean;
  exposureCap: number;
}

const SETTINGS_KEY = 'bm.settings';
const DEFAULT_SETTINGS: Settings = { exposureCapOn: false, exposureCap: 4 };

function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface AppState {
  /** local: 브라우저에만 저장 / supabase: 서버 저장, 실제 사용자끼리 매칭 */
  mode: 'local' | 'supabase';
  ready: boolean;
  /** 로그인한 사용자 id (프로필이 아직 없을 수 있음) */
  userId: string | null;
  /** 로그인한 아이디 */
  username: string | null;
  /** 내 프로필 (로그인 + 프로필 작성까지 마친 경우) */
  me: Profile | null;
  profiles: Profile[];
  byId: Map<string, Profile>;
  swipes: Swipe[];
  messages: Message[];
  unlocks: Unlock[];
  games: GameSession[];
  isOnline: (id: string) => boolean;
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  toast: string | null;
  showToast: (msg: string) => void;
  signUp: (username: string, password: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<{ hasProfile: boolean }>;
  signOut: () => Promise<void>;
  /** 내 프로필 저장 (id는 로그인한 사용자 id로 정해진다) */
  saveMyProfile: (p: Omit<Profile, 'id' | 'createdAt'>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  swipe: (target: Profile, liked: boolean) => Promise<{ matched: boolean }>;
  sendMessage: (to: Profile, text: string) => Promise<void>;
  inviteGame: (to: Profile, kind: GameKind) => Promise<GameSession>;
  respondGame: (id: string, accept: boolean) => Promise<void>;
  playMove: (id: string, move: RpsMove | CoinSide | 'flip') => Promise<void>;
  resetAll: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider가 필요해요');
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unlocks, setUnlocks] = useState<Unlock[]>([]);
  const [games, setGames] = useState<GameSession[]>([]);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>();
  const botJobs = useRef(new Set<string>());

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadAll = useCallback(async () => {
    const [ps, cur, name, sw, ul, on] = await Promise.all([
      repo.listProfiles(),
      repo.getCurrentUserId(),
      repo.getCurrentUsername(),
      repo.listSwipes(),
      repo.listUnlocks(),
      repo.listOnlineIds(),
    ]);
    const [ms, gs] = cur ? await Promise.all([repo.listMessages(cur), repo.listGames(cur)]) : [[], []];
    setProfiles(ps);
    setUserId(cur);
    setUsername(name);
    setSwipes(sw);
    setUnlocks(ul);
    setOnlineIds(on);
    setMessages(ms);
    setGames(gs);
    setReady(true);
  }, []);

  useEffect(() => {
    const safeLoad = () =>
      loadAll().catch((err: Error) => {
        setReady(true);
        showToast(`데이터를 불러오지 못했어요: ${err.message}`);
      });
    safeLoad();
    // 변경 알림이 몰려올 때(예: 실시간 이벤트 여러 개) 한 번만 다시 읽는다
    let timer: number | undefined;
    const unsubscribe = repo.subscribe((topic) => {
      if (topic === 'presence') {
        repo.listOnlineIds().then(setOnlineIds);
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(safeLoad, 150);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [loadAll, showToast]);

  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const mine = userId ? byId.get(userId) : undefined;
  const me = mine && !mine.isSample ? mine : null;
  const meId = me?.id ?? null;

  // 접속 상태: 5초마다 하트비트, 접속자 목록 갱신 (프로필이 있는 사용자만 '접속 중'으로 보인다)
  useEffect(() => {
    const tick = async () => {
      if (meId) await repo.heartbeat(meId);
      setOnlineIds(await repo.listOnlineIds());
      setNow(Date.now());
    };
    tick();
    const t = window.setInterval(tick, 5000);
    return () => window.clearInterval(t);
  }, [meId]);

  const isOnline = useCallback(
    (id: string) => {
      const p = byId.get(id);
      if (p?.isSample) return isBotOnline(id, now);
      return onlineIds.includes(id);
    },
    [byId, onlineIds, now],
  );

  // 내가 가상 인물에게 건 게임은 이 탭이 대신 진행시킨다
  useEffect(() => {
    if (!me) return;
    for (const g of games) {
      const bot = byId.get(g.to);
      if (g.from !== me.id || !bot?.isSample || (g.status !== 'pending' && g.status !== 'playing')) continue;
      const key = `${g.id}:${g.status}:${g.round}:${g.fromMove ?? ''}`;
      if (botJobs.current.has(key)) continue;
      botJobs.current.add(key);
      botHandleGame(g, bot);
    }
  }, [games, me, byId]);

  const setSettings = useCallback((s: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...s };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* 설정 저장 실패는 무시 */
      }
      return next;
    });
  }, []);

  const value: AppState = {
    mode: repo.mode,
    ready,
    userId,
    username,
    me,
    profiles,
    byId,
    swipes,
    messages,
    unlocks,
    games,
    isOnline,
    settings,
    setSettings,
    toast,
    showToast,

    async signUp(name, password) {
      await repo.signUp(name, password);
      await loadAll();
    },
    async signIn(name, password) {
      const id = await repo.signIn(name, password);
      await loadAll();
      const ps = await repo.listProfiles();
      return { hasProfile: ps.some((p) => p.id === id && !p.isSample) };
    },
    async signOut() {
      await repo.signOut();
      await loadAll();
    },
    async saveMyProfile(p) {
      const id = await repo.getCurrentUserId();
      if (!id) throw new Error('로그인이 풀렸어요. 다시 로그인해 주세요.');
      await repo.saveProfile({ ...p, id, createdAt: me?.createdAt ?? Date.now() });
      await loadAll();
    },
    async deleteAccount() {
      await repo.deleteAccount();
      await loadAll();
    },
    async swipe(target, liked) {
      if (!me) return { matched: false };
      await repo.saveSwipe({ from: me.id, to: target.id, liked, at: Date.now() });
      if (!liked) return { matched: false };
      if (target.isSample) {
        return { matched: await onLikeBot(me, target) };
      }
      const all = await repo.listSwipes();
      return { matched: isMutualLike(all, me.id, target.id) };
    },
    async sendMessage(to, text) {
      if (!me) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      if (containsContactInfo(trimmed)) throw new Error(CONTACT_ERROR);
      const history = messages.filter((m) => (m.from === to.id && m.to === me.id) || (m.from === me.id && m.to === to.id)).length;
      await repo.sendMessage({ id: crypto.randomUUID(), from: me.id, to: to.id, text: trimmed.slice(0, 300), at: Date.now() });
      if (to.isSample) botReply(to, me, trimmed, history);
    },
    async inviteGame(to, kind) {
      if (!me) throw new Error('로그인이 필요해요');
      const t = Date.now();
      return repo.createGame({ id: crypto.randomUUID(), kind, from: me.id, to: to.id, status: 'pending', createdAt: t, updatedAt: t, round: 1 });
    },
    async respondGame(id, accept) {
      await repo.updateGame(id, { status: accept ? 'playing' : 'declined' });
    },
    async playMove(id, move) {
      if (!me) return;
      const updated = await submitMove(id, me.id, move);
      if (updated?.status === 'done' && updated.winner) {
        const loser = updated.winner === updated.from ? updated.to : updated.from;
        await repo.addUnlock({ from: updated.winner, to: loser, reason: 'game-win', at: Date.now() }).catch(() => {
          /* 상대 쪽 화면에서 이미 기록했을 수 있다 */
        });
      }
    },
    async resetAll() {
      await repo.reset();
      await loadAll();
    },
  };

  // 가상 인물이 마지막 수를 둔 경우에도 승리 권한을 남긴다
  useEffect(() => {
    for (const g of games) {
      if (g.status === 'done' && g.winner && me && (g.from === me.id || g.to === me.id)) {
        const loser = g.winner === g.from ? g.to : g.from;
        if (!unlocks.some((u) => u.from === g.winner && u.to === loser)) {
          repo.addUnlock({ from: g.winner, to: loser, reason: 'game-win', at: Date.now() }).catch(() => {});
        }
      }
    }
  }, [games, unlocks, me]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
