/**
 * 공정성 지표 — 순수 함수.
 * 시뮬레이션 스크립트(scripts/simulate.ts)와 테스트(tests/fairness.test.ts)가 함께 사용한다.
 */
import { GENDER_LABEL, REGION_GROUP } from './constants';
import { directionalScore, mutualRejections, recommendAll } from './matching';
import type { Profile } from './types';

export type GroupKey = 'ageBand' | 'gender' | 'region';

export const GROUP_LABEL: Record<GroupKey, string> = {
  ageBand: '나이대',
  gender: '성별',
  region: '지역(권역)',
};

export function ageBand(age: number): string {
  if (age <= 27) return '19~27세';
  if (age <= 33) return '28~33세';
  return '34세 이상';
}

export function groupOf(p: Profile, key: GroupKey): string {
  if (key === 'ageBand') return ageBand(p.age);
  if (key === 'gender') return GENDER_LABEL[p.gender];
  return REGION_GROUP[p.region] ?? p.region;
}

/** 지니계수: 0 = 모두 똑같이 노출, 1 = 한 명에게 몰림 */
export function gini(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const sum = values.reduce((s, v) => s + v, 0);
  if (sum === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let weighted = 0;
  sorted.forEach((v, i) => {
    weighted += (i + 1) * v;
  });
  return (2 * weighted) / (n * sum) - (n + 1) / n;
}

export interface GroupStat {
  group: string;
  members: number;
  /** 평균 노출 수: 다른 사람들의 TOP N에 들어간 횟수의 평균 */
  avgExposure: number;
  /** 평균 노출 기회: 양방향 조건을 통과해 '후보가 될 수 있었던' 횟수의 평균 */
  avgOpportunity: number;
  /** 추천률 = 실제 노출 ÷ 노출 기회 */
  rate: number;
}

export interface FairnessReport {
  n: number;
  topN: number;
  exposureCap?: number;
  gini: number;
  /** 추천이 0명인 사용자 비율 */
  zeroRate: number;
  exposures: Record<string, number>;
  opportunities: Record<string, number>;
  groups: Record<GroupKey, GroupStat[]>;
  /** 그룹 간 추천률 최소/최대 비율 (1에 가까울수록 공평) */
  minMaxRatio: Record<GroupKey, number>;
}

export function analyzeFairness(
  profiles: Profile[],
  opts: { topN?: number; exposureCap?: number } = {},
): FairnessReport {
  const topN = opts.topN ?? 10;
  const lists = recommendAll(profiles, { topN, exposureCap: opts.exposureCap });

  const exposures: Record<string, number> = {};
  const opportunities: Record<string, number> = {};
  for (const p of profiles) {
    exposures[p.id] = 0;
    opportunities[p.id] = 0;
  }
  for (const list of lists.values()) for (const c of list) exposures[c.profile.id]++;
  for (const a of profiles) {
    for (const b of profiles) {
      if (a.id !== b.id && mutualRejections(a, b).length === 0) opportunities[b.id]++;
    }
  }

  const zero = [...lists.values()].filter((l) => l.length === 0).length;

  const keys: GroupKey[] = ['ageBand', 'gender', 'region'];
  const groups = {} as Record<GroupKey, GroupStat[]>;
  const minMaxRatio = {} as Record<GroupKey, number>;
  for (const key of keys) {
    const buckets = new Map<string, Profile[]>();
    for (const p of profiles) {
      const g = groupOf(p, key);
      if (!buckets.has(g)) buckets.set(g, []);
      buckets.get(g)!.push(p);
    }
    const stats: GroupStat[] = [...buckets.entries()]
      .map(([group, members]) => {
        const exp = members.reduce((s, m) => s + exposures[m.id], 0);
        const opp = members.reduce((s, m) => s + opportunities[m.id], 0);
        return {
          group,
          members: members.length,
          avgExposure: exp / members.length,
          avgOpportunity: opp / members.length,
          rate: opp === 0 ? 0 : exp / opp,
        };
      })
      .sort((a, b) => a.group.localeCompare(b.group));
    groups[key] = stats;
    // 노출 기회가 아예 없는 그룹은 알고리즘이 아니라 '조건'의 문제이므로 비율 계산에서 뺀다(표에는 남김).
    const rates = stats.filter((s) => s.avgOpportunity > 0).map((s) => s.rate);
    const max = Math.max(...rates);
    minMaxRatio[key] = rates.length === 0 || max === 0 ? 1 : Math.min(...rates) / max;
  }

  return {
    n: profiles.length,
    topN,
    exposureCap: opts.exposureCap,
    gini: gini(Object.values(exposures)),
    zeroRate: profiles.length === 0 ? 0 : zero / profiles.length,
    exposures,
    opportunities,
    groups,
    minMaxRatio,
  };
}

export interface CounterfactualRow {
  baseId: string;
  otherId: string;
  /** 원래 나이일 때 양쪽 조건 통과 여부 */
  eligibleBefore: boolean;
  eligibleAfter: boolean;
  myBefore: number;
  myAfter: number;
  theirBefore: number;
  theirAfter: number;
}

/**
 * 반사실 테스트: base의 나이만 delta만큼 바꾼 쌍둥이 프로필을 만들어
 * 다른 모든 사람과의 점수를 비교한다.
 * 이 설계에서 나이는 하드 필터에만 쓰이므로, 양쪽 모두 통과한 경우 점수 차이는 0이어야 한다.
 */
export function ageCounterfactual(base: Profile, others: Profile[], delta: number): CounterfactualRow[] {
  const twin: Profile = { ...base, age: base.age + delta };
  return others
    .filter((o) => o.id !== base.id)
    .map((o) => ({
      baseId: base.id,
      otherId: o.id,
      eligibleBefore: mutualRejections(base, o).length === 0,
      eligibleAfter: mutualRejections(twin, o).length === 0,
      myBefore: directionalScore(base, o).score,
      myAfter: directionalScore(twin, o).score,
      theirBefore: directionalScore(o, base).score,
      theirAfter: directionalScore(o, twin).score,
    }));
}
