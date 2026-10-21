/**
 * 가상 인물(샘플 50명)의 반응 흉내.
 * 실제 서비스(Supabase)로 넘어가면 이 파일은 필요 없다.
 */
import { directionalScore, mutualRejections } from '../domain/matching';
import type { GameSession, Profile, RpsMove } from '../domain/types';
import { repo } from '../repository';
import { submitMove } from './games';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** 10분 단위로 바뀌는 가상 접속 상태 (약 60%가 접속 중) */
export function isBotOnline(id: string, now = Date.now()): boolean {
  return hash(`${id}:${Math.floor(now / 600_000)}`) < 0.6;
}

/**
 * 가상 인물이 나를 좋아할지: 상대의 조건을 통과해야 하고,
 * 상대가 본 점수(B→A)가 높을수록 확률이 높다. 같은 쌍은 항상 같은 결과.
 */
export function botLikesMe(bot: Profile, me: Profile): boolean {
  if (mutualRejections(bot, me).some((r) => r.side === 'mine')) return false;
  const p = Math.min(0.95, 0.25 + directionalScore(bot, me).score / 100);
  return hash(`${bot.id}->${me.id}`) < p;
}

const delay = (min: number, max: number) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

export async function onLikeBot(me: Profile, bot: Profile): Promise<boolean> {
  if (!bot.isSample || !botLikesMe(bot, me)) return false;
  await repo.saveSwipe({ from: bot.id, to: me.id, liked: true, at: Date.now() });
  return true;
}

const REPLIES = [
  '안녕하세요! 메시지 반가워요 😊',
  '프로필 보고 저도 궁금했어요.',
  '오 저도 그거 좋아해요! 요즘은 어떤 거 하세요?',
  '주말엔 보통 뭐 하면서 보내세요?',
  '하하 재밌으시네요 ㅎㅎ',
  '좋아요, 천천히 이야기 나눠봐요.',
];
const QUESTION_REPLIES = ['음… 좋은 질문이네요! 저는 이것저것 다 좋아해요.', '저는 좋아요! 그쪽은요?', '생각해본 적 없는데 재밌는 질문이에요 ㅎㅎ'];

export async function botReply(bot: Profile, me: Profile, text: string, history: number): Promise<void> {
  await delay(1200, 2800);
  const pool = text.includes('?') ? QUESTION_REPLIES : REPLIES;
  const reply = history === 0 ? `${me.nickname}님 안녕하세요! ${bot.nickname}이에요.` : pool[Math.floor(Math.random() * pool.length)];
  await repo.sendMessage({ id: crypto.randomUUID(), from: bot.id, to: me.id, text: reply, at: Date.now() });
}

const MOVES: RpsMove[] = ['rock', 'paper', 'scissors'];

/** 가상 인물이 받은 게임에 자동으로 응답한다 */
export async function botHandleGame(game: GameSession, bot: Profile): Promise<void> {
  if (game.to !== bot.id) return;
  if (game.status === 'pending') {
    await delay(900, 1800);
    await repo.updateGame(game.id, isBotOnline(bot.id) ? { status: 'playing' } : { status: 'declined' });
    return;
  }
  if (game.status !== 'playing') return;
  if (game.kind === 'rps' && !game.toMove) {
    await delay(600, 1400);
    const fresh = (await repo.listGames(bot.id)).find((g) => g.id === game.id);
    if (!fresh || fresh.toMove || fresh.status !== 'playing') return;
    await submitMove(game.id, bot.id, MOVES[Math.floor(Math.random() * 3)]);
  }
  if (game.kind === 'coin' && game.fromMove && !game.coinResult) {
    await delay(800, 1500);
    const fresh = (await repo.listGames(bot.id)).find((g) => g.id === game.id);
    if (!fresh || fresh.coinResult || fresh.status !== 'playing') return;
    await submitMove(game.id, bot.id, 'flip');
  }
}
