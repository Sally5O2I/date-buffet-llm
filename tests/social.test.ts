import { describe, expect, it } from 'vitest';
import { applyMove, isMutualLike, messagePermission, rpsResult } from '../src/domain/social';
import type { GameSession } from '../src/domain/types';
import { containsContactInfo, validateCredentials, validateProfile } from '../src/domain/validation';
import { makeProfile } from './helpers';

const game = (over: Partial<GameSession> = {}): GameSession => ({
  id: 'g', kind: 'rps', from: 'A', to: 'B', status: 'playing', createdAt: 0, updatedAt: 0, round: 1, ...over,
});

describe('메시지 권한', () => {
  const empty = { swipes: [], unlocks: [], messages: [] };
  it('아무 관계도 없으면 보낼 수 없다', () => {
    expect(messagePermission('A', 'B', empty).allowed).toBe(false);
  });
  it('한쪽 좋아요만으로는 안 되고, 서로 좋아요면 된다', () => {
    const one = [{ from: 'A', to: 'B', liked: true, at: 0 }];
    expect(messagePermission('A', 'B', { ...empty, swipes: one }).allowed).toBe(false);
    const both = [...one, { from: 'B', to: 'A', liked: true, at: 0 }];
    expect(isMutualLike(both, 'A', 'B')).toBe(true);
    expect(messagePermission('A', 'B', { ...empty, swipes: both })).toEqual({ allowed: true, reason: 'mutual' });
  });
  it('게임에서 이긴 사람만 권한을 얻고, 진 사람은 상대가 먼저 보내면 답장할 수 있다', () => {
    const unlocks = [{ from: 'A', to: 'B', reason: 'game-win' as const, at: 0 }];
    expect(messagePermission('A', 'B', { ...empty, unlocks }).reason).toBe('game-win');
    expect(messagePermission('B', 'A', { ...empty, unlocks }).allowed).toBe(false);
    const messages = [{ id: '1', from: 'A', to: 'B', text: '안녕', at: 0 }];
    expect(messagePermission('B', 'A', { ...empty, unlocks, messages }).reason).toBe('reply');
  });
});

describe('가위바위보', () => {
  it('승패 규칙', () => {
    expect(rpsResult('rock', 'scissors')).toBe(1);
    expect(rpsResult('scissors', 'rock')).toBe(-1);
    expect(rpsResult('paper', 'paper')).toBe(0);
  });
  it('두 사람이 모두 내야 결과가 나오고, 비기면 다음 라운드', () => {
    const g1 = { ...game(), ...applyMove(game(), 'A', 'rock') };
    expect(g1.status).toBe('playing');
    const draw = { ...g1, ...applyMove(g1, 'B', 'rock') };
    expect(draw.status).toBe('playing');
    expect(draw.round).toBe(2);
    expect(draw.fromMove).toBeUndefined();
    const g2 = { ...draw, ...applyMove(draw, 'B', 'paper') };
    const done = { ...g2, ...applyMove(g2, 'A', 'rock') };
    expect(done.status).toBe('done');
    expect(done.winner).toBe('B');
  });
});

describe('동전 던지기', () => {
  it('건 사람이 고른 면이 나오면 건 사람이 이긴다', () => {
    const g0 = game({ kind: 'coin' });
    const g1 = { ...g0, ...applyMove(g0, 'A', 'heads') };
    expect(applyMove(g1, 'A', 'flip')).toEqual({}); // 건 사람은 던질 수 없다
    expect(applyMove(g1, 'B', 'flip', () => 0.1)).toMatchObject({ coinResult: 'heads', winner: 'A', status: 'done' });
    expect(applyMove(g1, 'B', 'flip', () => 0.9)).toMatchObject({ coinResult: 'tails', winner: 'B', status: 'done' });
  });
  it('면을 고르기 전에는 던질 수 없다', () => {
    expect(applyMove(game({ kind: 'coin' }), 'B', 'flip')).toEqual({});
  });
});

describe('직업 입력 검증', () => {
  const valid = () => {
    const p = makeProfile();
    const { id: _id, createdAt: _c, ...draft } = p;
    return draft;
  };
  it('2~20자면 통과, 비어 있거나 너무 길면 오류', () => {
    expect(validateProfile({ ...valid(), job: '간호사' }).job).toBeUndefined();
    expect(validateProfile({ ...valid(), job: '비공개' }).job).toBeUndefined();
    expect(validateProfile({ ...valid(), job: '' }).job).toBeDefined();
    expect(validateProfile({ ...valid(), job: null }).job).toBeDefined();
    expect(validateProfile({ ...valid(), job: '가'.repeat(21) }).job).toBeDefined();
  });
  it('직업 칸에 연락처를 쓰면 막는다', () => {
    expect(validateProfile({ ...valid(), job: '카톡 abc123' }).job).toBeDefined();
  });
});

describe('아이디·비밀번호 검사', () => {
  it('아이디는 영문 소문자·숫자·밑줄 4~16자', () => {
    expect(validateCredentials('blue_whale', 'abcdef').username).toBeUndefined();
    expect(validateCredentials('abc', 'abcdef').username).toBeDefined();
    expect(validateCredentials('Blue', 'abcdef').username).toBeDefined();
    expect(validateCredentials('한글아이디', 'abcdef').username).toBeDefined();
    expect(validateCredentials('a'.repeat(17), 'abcdef').username).toBeDefined();
  });
  it('비밀번호는 6자 이상, 확인이 다르면 오류', () => {
    expect(validateCredentials('blue_whale', '12345').password).toBeDefined();
    expect(validateCredentials('blue_whale', '123456', '123456')).toEqual({});
    expect(validateCredentials('blue_whale', '123456', '123457').confirm).toBeDefined();
  });
});

describe('민감 정보 차단', () => {
  it.each(['010-1234-5678', '공일공 말고 01012345678', 'me@test.com', '카톡 아이디 abc', '인스타 @abc', 'https://x.y'])('차단: %s', (t) => {
    expect(containsContactInfo(t)).toBe(true);
  });
  it.each(['주말엔 카페 가요', '2026년에 여행 3번 갔어요', '고양이 2마리 키워요'])('허용: %s', (t) => {
    expect(containsContactInfo(t)).toBe(false);
  });
});
