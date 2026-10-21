import { applyMove } from '../domain/social';
import type { CoinSide, GameSession, RpsMove } from '../domain/types';
import { repo } from '../repository';
import { GameConflictError } from '../repository/Repository';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 게임에 한 수를 낸다. 최신 상태를 읽어 규칙(applyMove)을 적용하고,
 * 그 사이 상대가 먼저 수를 냈으면(충돌) 다시 읽어서 재시도한다.
 */
export async function submitMove(
  gameId: string,
  userId: string,
  move: RpsMove | CoinSide | 'flip',
): Promise<GameSession | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const fresh = (await repo.listGames(userId)).find((g) => g.id === gameId);
    if (!fresh) return null;
    const patch = applyMove(fresh, userId, move);
    if (Object.keys(patch).length === 0) return fresh;
    try {
      return await repo.updateGame(gameId, patch, fresh.updatedAt);
    } catch (err) {
      if (!(err instanceof GameConflictError)) throw err;
      await sleep(80 + Math.random() * 220);
    }
  }
  throw new Error('게임 상태를 저장하지 못했어요. 다시 시도해 주세요.');
}
