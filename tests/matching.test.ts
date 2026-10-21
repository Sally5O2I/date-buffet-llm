import { describe, expect, it } from 'vitest';
import {
  directionalScore,
  evaluatePair,
  hardFilter,
  itemScores,
  recommend,
  recommendAll,
} from '../src/domain/matching';
import { SAMPLE_PROFILES } from '../src/data/sampleProfiles';
import { makeProfile } from './helpers';

describe('하드 필터 탈락', () => {
  it('원하는 성별이 아니면 gender 사유로 탈락한다', () => {
    const me = makeProfile({ gender: 'male', preference: { genders: ['female'] } });
    const other = makeProfile({ gender: 'male' });
    const r = hardFilter(me, other);
    expect(r.map((x) => x.code)).toEqual(['gender']);
  });

  it('나이 범위 밖이면 age 사유로 탈락한다', () => {
    const me = makeProfile({ preference: { ageMin: 25, ageMax: 30 } });
    expect(hardFilter(me, makeProfile({ age: 31 })).map((x) => x.code)).toEqual(['age']);
    expect(hardFilter(me, makeProfile({ age: 24 })).map((x) => x.code)).toEqual(['age']);
    expect(hardFilter(me, makeProfile({ age: 30 }))).toEqual([]);
  });

  it('흡연 불가 조건이면 흡연자는 탈락한다', () => {
    const me = makeProfile({ preference: { smokingAllow: 'none' } });
    expect(hardFilter(me, makeProfile({ smoking: 'sometimes' }))[0].code).toBe('smoking');
    const me2 = makeProfile({ preference: { smokingAllow: 'sometimes' } });
    expect(hardFilter(me2, makeProfile({ smoking: 'sometimes' }))).toEqual([]);
    expect(hardFilter(me2, makeProfile({ smoking: 'smoker' }))[0].code).toBe('smoking');
  });

  it('지역 조건: same은 같은 시/도만, nearby는 인접까지 허용', () => {
    const same = makeProfile({ region: '서울', preference: { regionMode: 'same' } });
    const near = makeProfile({ region: '서울', preference: { regionMode: 'nearby' } });
    expect(hardFilter(same, makeProfile({ region: '경기' }))[0].code).toBe('region');
    expect(hardFilter(near, makeProfile({ region: '경기' }))).toEqual([]);
    expect(hardFilter(near, makeProfile({ region: '부산' }))[0].code).toBe('region');
  });

  it('키 범위 밖이면 height 사유로 탈락한다 (경계값은 통과)', () => {
    const me = makeProfile({ preference: { heightMin: 170, heightMax: 185 } });
    expect(hardFilter(me, makeProfile({ height: 169 })).map((x) => x.code)).toEqual(['height']);
    expect(hardFilter(me, makeProfile({ height: 186 })).map((x) => x.code)).toEqual(['height']);
    expect(hardFilter(me, makeProfile({ height: 170 }))).toEqual([]);
    expect(hardFilter(me, makeProfile({ height: 185 }))).toEqual([]);
  });

  it('원하지 않는 체형이면 body 사유로 탈락한다', () => {
    const me = makeProfile({ preference: { bodyTypes: ['slim', 'normal'] } });
    expect(hardFilter(me, makeProfile({ bodyType: 'chubby' })).map((x) => x.code)).toEqual(['body']);
    expect(hardFilter(me, makeProfile({ bodyType: 'slim' }))).toEqual([]);
  });

  it('키·체형을 입력하기 전의 예전 프로필(null)은 조건을 통과한다', () => {
    const me = makeProfile({ preference: { heightMin: 180, heightMax: 190, bodyTypes: ['slim'] } });
    expect(hardFilter(me, makeProfile({ height: null, bodyType: null }))).toEqual([]);
  });

  it('키 조건 때문에 0명이면 키 범위를 넓히라는 제안이 나온다', () => {
    const me = makeProfile({ preference: { heightMin: 180, heightMax: 182 } });
    const r = recommend(me, [makeProfile({ height: 176 })]);
    expect(r.candidates).toHaveLength(0);
    expect(r.rejectionCounts.height.mine).toBe(1);
    expect(r.suggestions.map((s) => s.id)).toContain('height');
  });

  it('탈락 사유는 여러 개가 함께 기록된다', () => {
    const me = makeProfile({ preference: { genders: ['male'], ageMin: 20, ageMax: 25, smokingAllow: 'none' } });
    const other = makeProfile({ gender: 'female', age: 40, smoking: 'smoker' });
    expect(hardFilter(me, other).map((x) => x.code).sort()).toEqual(['age', 'gender', 'smoking']);
  });

  it('상대 쪽 조건에 내가 탈락해도 후보에서 빠지고, side=theirs로 기록된다', () => {
    const me = makeProfile({ age: 40 });
    const other = makeProfile({ preference: { ageMin: 20, ageMax: 30 } });
    const r = evaluatePair(me, other);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejections).toEqual([expect.objectContaining({ code: 'age', side: 'theirs' })]);
    expect(recommend(me, [me, other]).candidates).toHaveLength(0);
  });
});

describe('성별 선호 양방향 규칙 (A·B·C 동성 가능 / D·E·F 이성만)', () => {
  // 모두 여성. A·B·C는 여성도 보고 싶고, D·E·F는 남성만 보고 싶다.
  const A = makeProfile({ id: 'A', gender: 'female', preference: { genders: ['female', 'male'] } });
  const B = makeProfile({ id: 'B', gender: 'female', preference: { genders: ['female'] } });
  const C = makeProfile({ id: 'C', gender: 'female', preference: { genders: ['female', 'male', 'other'] } });
  const D = makeProfile({ id: 'D', gender: 'female', preference: { genders: ['male'] } });
  const E = makeProfile({ id: 'E', gender: 'female', preference: { genders: ['male'] } });
  const F = makeProfile({ id: 'F', gender: 'female', preference: { genders: ['male'] } });
  // 취미·지역이 완전히 같아도 결과는 같아야 한다
  const all = [A, B, C, D, E, F];

  it('A·B·C는 서로만 뜨고 D·E·F는 절대 뜨지 않는다', () => {
    for (const me of [A, B, C]) {
      const ids = recommend(me, all).candidates.map((c) => c.profile.id);
      expect(ids.sort()).toEqual(['A', 'B', 'C'].filter((x) => x !== me.id).sort());
    }
  });

  it('D·E·F의 리스트에도 A·B·C는 뜨지 않는다', () => {
    for (const me of [D, E, F]) {
      expect(recommend(me, all).candidates).toHaveLength(0);
    }
  });
});

describe('소프트 점수', () => {
  it('관심사는 자카드 유사도 (겹친 수 ÷ 합친 수)', () => {
    const a = makeProfile({ interests: ['영화', '여행', '카페', '요리'] });
    const b = makeProfile({ interests: ['영화', '여행', '카페'] });
    expect(itemScores(a, b).interests.score).toBe(75);
    expect(itemScores(a, b).interests.reason).toBe('관심사 4개 중 3개가 겹쳐요');
  });

  it('지역: 같으면 100, 인접 50, 그 외 0', () => {
    const seoul = makeProfile({ region: '서울' });
    expect(itemScores(seoul, makeProfile({ region: '서울' })).region.score).toBe(100);
    expect(itemScores(seoul, makeProfile({ region: '경기' })).region.score).toBe(50);
    expect(itemScores(seoul, makeProfile({ region: '제주' })).region.score).toBe(0);
  });

  it('음주 빈도 차이가 작을수록 높다', () => {
    const a = makeProfile({ drinking: 2 });
    const s = (d: number) => itemScores(a, makeProfile({ drinking: d })).drinking.score;
    expect(s(2)).toBe(100);
    expect(s(3)).toBe(75);
    expect(s(0)).toBe(50);
  });

  it('성격: 보완 쌍이 있으면 겹치지 않아도 점수가 있다', () => {
    const a = makeProfile({ personality: ['리더형'] });
    const b = makeProfile({ personality: ['배려형'] });
    expect(itemScores(a, b).personality.score).toBe(15);
  });

  it('중요 항목은 가중치 2배로 반영된다', () => {
    const a = makeProfile({ region: '서울', interests: ['영화'], preference: { important: ['region', 'drinking', 'smoking'] } });
    const b = makeProfile({ region: '서울', interests: ['독서'] });
    const region = directionalScore(a, b).items.find((i) => i.item === 'region')!;
    expect(region.weight).toBe(2);
    expect(region.points).toBeCloseTo((100 * 2) / 8);
  });
});

describe('양방향 비대칭', () => {
  it('중요 항목이 다르면 A→B와 B→A가 달라지고 최종 점수는 기하평균', () => {
    const a = makeProfile({
      region: '서울',
      interests: ['영화', '여행'],
      preference: { important: ['region', 'drinking', 'smoking'] },
    });
    const b = makeProfile({
      region: '서울',
      interests: ['독서', '요리'],
      preference: { important: ['interests', 'personality', 'drinking'] },
    });
    const r = evaluatePair(a, b);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = r.explanation;
    expect(e.myScore).not.toBeCloseTo(e.theirScore);
    expect(e.myScore).toBeGreaterThan(e.theirScore);
    expect(e.total).toBeCloseTo(Math.sqrt(e.myScore * e.theirScore));
    expect(e.total).toBeLessThanOrEqual(Math.max(e.myScore, e.theirScore));
    expect(e.highlights).toHaveLength(3);
    expect(e.items).toHaveLength(5);
    expect(e.theirItems).toHaveLength(5);
  });

  it('내가 상대를 원해도 상대가 나를 원하지 않으면 제외된다', () => {
    const me = makeProfile({ gender: 'male', preference: { genders: ['female'] } });
    const her = makeProfile({ gender: 'female', preference: { genders: ['female'] } });
    expect(recommend(me, [her]).candidates).toHaveLength(0);
    expect(recommend(her, [me]).candidates).toHaveLength(0);
  });
});

describe('후보 0명', () => {
  it('후보가 없으면 빈 리스트 + 탈락 사유 집계 + 조건 완화 제안', () => {
    const me = makeProfile({ region: '서울', preference: { regionMode: 'same', ageMin: 25, ageMax: 27 } });
    const others = [
      makeProfile({ region: '부산', age: 26 }),
      makeProfile({ region: '서울', age: 31 }),
      makeProfile({ region: '경기', age: 29 }),
    ];
    const r = recommend(me, others);
    expect(r.candidates).toHaveLength(0);
    expect(r.eligible).toBe(0);
    expect(r.rejectionCounts.region.mine).toBe(2);
    expect(r.rejectionCounts.age.mine).toBe(2);
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions[0].gain).toBeGreaterThan(0);
    // 제안대로 바꾸면 실제로 후보가 생긴다
    const patched = { ...me, preference: { ...me.preference, ...r.suggestions[0].patch } };
    expect(recommend(patched, others).candidates.length).toBe(r.suggestions[0].gain);
  });

  it('아무도 없으면 제안도 없다', () => {
    const r = recommend(makeProfile(), []);
    expect(r.candidates).toEqual([]);
    expect(r.suggestions).toEqual([]);
  });
});

describe('자기 자신 제외', () => {
  it('목록에 나 자신(같은 id)이 있어도 절대 후보에 들어가지 않는다', () => {
    const me = makeProfile({ id: 'me' });
    const clone = { ...me }; // 같은 id의 다른 객체 (저장소에서 다시 읽어온 경우)
    const other = makeProfile();
    const ids = recommend(me, [me, clone, other]).candidates.map((c) => c.profile.id);
    expect(ids).toEqual([other.id]);
  });

  it('샘플 50명 전체에서도 자기 자신은 나오지 않는다', () => {
    for (const me of SAMPLE_PROFILES) {
      const ids = recommend(me, SAMPLE_PROFILES).candidates.map((c) => c.profile.id);
      expect(ids).not.toContain(me.id);
    }
  });
});

describe('정렬·TOP N·노출 상한', () => {
  it('점수 내림차순, 최대 10명, 순위는 1부터', () => {
    const me = makeProfile({ id: 'me' });
    const others = Array.from({ length: 15 }, (_, i) =>
      makeProfile({ interests: i % 2 ? ['영화', '여행', '카페'] : ['게임'], drinking: i % 5 }),
    );
    const c = recommend(me, others).candidates;
    expect(c).toHaveLength(10);
    expect(c.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let i = 1; i < c.length; i++) {
      expect(c[i - 1].explanation.total).toBeGreaterThanOrEqual(c[i].explanation.total);
    }
  });

  it('exposureCap을 주면 어떤 프로필도 cap번보다 많이 노출되지 않는다', () => {
    const cap = 3;
    const lists = recommendAll(SAMPLE_PROFILES, { topN: 10, exposureCap: cap });
    const count = new Map<string, number>();
    for (const list of lists.values()) for (const c of list) count.set(c.profile.id, (count.get(c.profile.id) ?? 0) + 1);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(cap);
  });

  it('점수는 0~100 사이', () => {
    for (const me of SAMPLE_PROFILES) {
      for (const c of recommend(me, SAMPLE_PROFILES).candidates) {
        expect(c.explanation.total).toBeGreaterThanOrEqual(0);
        expect(c.explanation.total).toBeLessThanOrEqual(100);
      }
    }
  });
});
