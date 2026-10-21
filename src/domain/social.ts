/**
 * 좋아요·메시지 권한·게임 판정 — 순수 함수.
 */
import type { CoinSide, GameSession, Message, RpsMove, Swipe, Unlock } from './types';

export function swipeOf(swipes: Swipe[], from: string, to: string): Swipe | undefined {
  return swipes.find((s) => s.from === from && s.to === to);
}

export function isMutualLike(swipes: Swipe[], a: string, b: string): boolean {
  return !!swipeOf(swipes, a, b)?.liked && !!swipeOf(swipes, b, a)?.liked;
}

export type MessagePermission =
  | { allowed: true; reason: 'mutual' | 'game-win' | 'reply' }
  | { allowed: false; reason: 'none' };

/**
 * 메시지를 보낼 수 있는 경우
 *  1) 서로 좋아요
 *  2) 내가 게임에서 이겨 권한을 얻음
 *  3) 상대가 먼저 나에게 메시지를 보냄(답장)
 */
export function messagePermission(
  me: string,
  other: string,
  data: { swipes: Swipe[]; unlocks: Unlock[]; messages: Message[] },
): MessagePermission {
  if (isMutualLike(data.swipes, me, other)) return { allowed: true, reason: 'mutual' };
  if (data.unlocks.some((u) => u.from === me && u.to === other)) return { allowed: true, reason: 'game-win' };
  if (data.messages.some((m) => m.from === other && m.to === me)) return { allowed: true, reason: 'reply' };
  return { allowed: false, reason: 'none' };
}

export const RPS_LABEL: Record<RpsMove, string> = { rock: '✊ 바위', paper: '✋ 보', scissors: '✌️ 가위' };
export const COIN_LABEL: Record<CoinSide, string> = { heads: '앞면', tails: '뒷면' };

/** 1: a 승, -1: b 승, 0: 무승부 */
export function rpsResult(a: RpsMove, b: RpsMove): 1 | -1 | 0 {
  if (a === b) return 0;
  const beats: Record<RpsMove, RpsMove> = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
  return beats[a] === b ? 1 : -1;
}

/**
 * 게임에 한 수를 반영한다. 결과가 정해지면 status=done, winner 설정.
 * 가위바위보가 비기면 다음 라운드로 넘어간다.
 * random은 동전 던지기에만 쓰인다(테스트에서 주입 가능).
 */
export function applyMove(
  game: GameSession,
  userId: string,
  move: RpsMove | CoinSide | 'flip',
  random: () => number = Math.random,
): Partial<GameSession> {
  if (game.status !== 'playing') return {};

  if (game.kind === 'rps') {
    const next: Partial<GameSession> = {};
    if (userId === game.from) next.fromMove = move as RpsMove;
    if (userId === game.to) next.toMove = move as RpsMove;
    const fromMove = (next.fromMove ?? game.fromMove) as RpsMove | undefined;
    const toMove = next.toMove ?? game.toMove;
    if (!fromMove || !toMove) return next;
    const r = rpsResult(fromMove, toMove);
    if (r === 0) {
      return { fromMove: undefined, toMove: undefined, round: game.round + 1, lastDraw: { fromMove, toMove } };
    }
    return { fromMove, toMove, status: 'done', winner: r === 1 ? game.from : game.to };
  }

  // 동전 던지기: 건 사람이 면을 고르고, 받은 사람이 던진다
  if (userId === game.from && !game.fromMove && move !== 'flip') return { fromMove: move as CoinSide };
  if (userId === game.to && game.fromMove && move === 'flip') {
    const coinResult: CoinSide = random() < 0.5 ? 'heads' : 'tails';
    return { coinResult, status: 'done', winner: coinResult === game.fromMove ? game.from : game.to };
  }
  return {};
}
