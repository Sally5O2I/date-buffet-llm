/**
 * 매칭 로직 — 순수 함수만 둔다.
 * React, localStorage, Date.now(), Math.random() 어떤 것도 사용하지 않는다.
 * 같은 입력이면 항상 같은 출력이 나오므로 테스트·시뮬레이션·서버 이전이 쉽다.
 *
 * 단계 1. 하드 필터  → hardFilter()
 * 단계 2. 소프트 점수 → itemScores()
 * 단계 3. 가중치 합산 → directionalScore()
 * 단계 4. 양방향 결합 → evaluatePair()  최종 = sqrt(A→B × B→A)
 * 단계 5. 정렬·TOP N → recommend() / recommendAll()
 */
import {
  ADJACENCY,
  AGE_MAX,
  AGE_MIN,
  ALL_BODY_TYPES,
  ALL_GENDERS,
  BODY_TYPE_LABEL,
  HEIGHT_MAX,
  HEIGHT_MIN,
  COMPLEMENT_PAIRS,
  DRINKING_SHORT,
  GENDER_LABEL,
  SMOKING_LABEL,
  SMOKING_LEVEL,
  SOFT_ITEMS,
  SOFT_ITEM_LABEL,
} from './constants';
import type { Preference, Profile, RegionMode, SoftItem } from './types';

// ───────────────────────── 타입 ─────────────────────────

export type RejectCode = 'gender' | 'age' | 'height' | 'body' | 'region' | 'smoking';

export interface Rejection {
  code: RejectCode;
  /** mine: 내 조건이 상대를 거름 / theirs: 상대 조건이 나를 거름 */
  side: 'mine' | 'theirs';
  message: string;
}

export interface ItemScore {
  item: SoftItem;
  label: string;
  /** 항목 원점수 0~100 */
  score: number;
  /** 2(중요 항목) 또는 1 */
  weight: number;
  /** 최종 점수에 기여한 점수 = score × weight ÷ 가중치 합 */
  points: number;
  /** 근거 문장 */
  reason: string;
}

export interface DirectionalScore {
  /** 0~100 */
  score: number;
  items: ItemScore[];
}

export interface Explanation {
  /** 최종 점수 = sqrt(myScore × theirScore) */
  total: number;
  /** 내가 본 점수 (A→B, 내 가중치) */
  myScore: number;
  /** 상대가 본 점수 (B→A, 상대 가중치) */
  theirScore: number;
  /** 내 기준 항목별 점수와 근거 */
  items: ItemScore[];
  /** 상대 기준 항목별 점수와 근거 */
  theirItems: ItemScore[];
  /** "이 사람이 추천된 이유" 3줄 */
  highlights: string[];
}

export interface Candidate {
  rank: number;
  profile: Profile;
  explanation: Explanation;
}

export type PairResult =
  | { ok: true; explanation: Explanation }
  | { ok: false; rejections: Rejection[] };

export interface Suggestion {
  id: string;
  label: string;
  patch: Partial<Preference>;
  /** 이 조건으로 바꾸면 생기는 후보 수 */
  gain: number;
}

export interface RecommendOptions {
  /** 기본 10 */
  topN?: number;
  /** 후보에서 뺄 id (예: 내가 '별로예요' 한 사람) */
  excludeIds?: Iterable<string>;
  /**
   * 한 프로필이 전체 사용자들의 TOP N에 노출될 수 있는 최대 횟수.
   * 지정하면 전체 모집단 기준으로 배분(recommendAll)한 결과를 쓴다.
   */
  exposureCap?: number;
}

export interface RecommendResult {
  candidates: Candidate[];
  /** 나를 뺀 검토 인원 */
  considered: number;
  /** 양방향 하드 필터를 통과한 인원 */
  eligible: number;
  /** 탈락 사유별 인원 수 (한 사람이 여러 사유로 탈락할 수 있음) */
  rejectionCounts: Record<RejectCode, { mine: number; theirs: number }>;
  /** 후보가 0명일 때 조건 완화 제안 */
  suggestions: Suggestion[];
}

export const WEIGHT_IMPORTANT = 2;
export const WEIGHT_NORMAL = 1;
export const DEFAULT_TOP_N = 10;

// ──────────────────── 단계 1. 하드 필터 ────────────────────

export function isRegionAllowed(mode: RegionMode, mine: string, theirs: string): boolean {
  if (mode === 'any') return true;
  if (mine === theirs) return true;
  if (mode === 'nearby') return ADJACENCY[mine]?.has(theirs) ?? false;
  return false;
}

/**
 * viewer의 조건으로 target을 거른다. 빈 배열이면 통과.
 * 점수는 매기지 않고 탈락 사유만 남긴다.
 */
export function hardFilter(viewer: Profile, target: Profile): Omit<Rejection, 'side'>[] {
  const p = viewer.preference;
  const out: Omit<Rejection, 'side'>[] = [];

  if (!p.genders.includes(target.gender)) {
    const wanted = p.genders.map((g) => GENDER_LABEL[g]).join('·') || '없음';
    out.push({ code: 'gender', message: `원하는 성별(${wanted})이 아니에요 (${GENDER_LABEL[target.gender]})` });
  }
  if (target.age < p.ageMin || target.age > p.ageMax) {
    out.push({ code: 'age', message: `나이 ${target.age}세가 원하는 범위 ${p.ageMin}~${p.ageMax}세 밖이에요` });
  }
  // 키·체형을 아직 입력하지 않은 예전 프로필(null)은 조건을 통과한 것으로 본다
  if (target.height != null && (target.height < p.heightMin || target.height > p.heightMax)) {
    out.push({ code: 'height', message: `키 ${target.height}cm가 원하는 범위 ${p.heightMin}~${p.heightMax}cm 밖이에요` });
  }
  if (target.bodyType != null && !p.bodyTypes.includes(target.bodyType)) {
    const wanted = p.bodyTypes.map((b) => BODY_TYPE_LABEL[b]).join('·') || '없음';
    out.push({ code: 'body', message: `원하는 체형(${wanted})이 아니에요 (${BODY_TYPE_LABEL[target.bodyType]})` });
  }
  if (!isRegionAllowed(p.regionMode, viewer.region, target.region)) {
    const rule = p.regionMode === 'same' ? '같은 시/도만' : '같은 시/도 또는 인접 지역만';
    out.push({ code: 'region', message: `${target.region}은(는) '${rule}' 조건에 맞지 않아요` });
  }
  if (
    (p.smokingAllow === 'none' && target.smoking !== 'non') ||
    (p.smokingAllow === 'sometimes' && target.smoking === 'smoker')
  ) {
    out.push({ code: 'smoking', message: `흡연 조건에 맞지 않아요 (${SMOKING_LABEL[target.smoking]})` });
  }
  return out;
}

/** 양방향 하드 필터: 내 조건 + 상대 조건을 모두 검사 */
export function mutualRejections(me: Profile, other: Profile): Rejection[] {
  return [
    ...hardFilter(me, other).map((r) => ({ ...r, side: 'mine' as const })),
    ...hardFilter(other, me).map((r) => ({ ...r, side: 'theirs' as const })),
  ];
}

// ──────────────────── 단계 2. 소프트 점수 ────────────────────

function jaccard(a: string[], b: string[]): { inter: number; union: number; value: number } {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = new Set([...A, ...B]).size;
  return { inter, union, value: union === 0 ? 0 : inter / union };
}

function interestsScore(a: Profile, b: Profile): { score: number; reason: string } {
  const j = jaccard(a.interests, b.interests);
  const score = Math.round(j.value * 100);
  const reason =
    j.inter === 0
      ? `관심사가 아직 겹치지 않아요 (서로 합쳐 ${j.union}개)`
      : `관심사 ${j.union}개 중 ${j.inter}개가 겹쳐요`;
  return { score, reason };
}

/** 성격: 같은 키워드 자카드 70% + 보완 쌍 보너스 30% */
function personalityScore(a: Profile, b: Profile): { score: number; reason: string } {
  const j = jaccard(a.personality, b.personality);
  const pairs: string[] = [];
  for (const [x, y] of COMPLEMENT_PAIRS) {
    if (
      (a.personality.includes(x) && b.personality.includes(y)) ||
      (a.personality.includes(y) && b.personality.includes(x))
    ) {
      pairs.push(`${x}↔${y}`);
    }
  }
  const bonus = Math.min(pairs.length, 2) / 2;
  const score = Math.round(100 * (0.7 * j.value + 0.3 * bonus));
  const parts: string[] = [];
  if (j.inter > 0) parts.push(`성격 키워드 ${j.inter}개가 같고`);
  if (pairs.length > 0) parts.push(`서로 보완되는 성향(${pairs.join(', ')})이 있어요`);
  const reason =
    parts.length === 0
      ? '성격 키워드가 겹치지 않아요'
      : parts.length === 1 && j.inter > 0
        ? `성격 키워드 ${j.inter}개가 같아요`
        : parts.join(' ');
  return { score, reason };
}

function regionScore(a: Profile, b: Profile): { score: number; reason: string } {
  if (a.region === b.region) return { score: 100, reason: `서로 ${a.region}이에요` };
  if (ADJACENCY[a.region]?.has(b.region)) {
    return { score: 50, reason: `${a.region}과(와) ${b.region}은(는) 이웃 지역이에요` };
  }
  return { score: 0, reason: `${a.region}과(와) ${b.region}은(는) 거리가 있어요` };
}

function drinkingScore(a: Profile, b: Profile): { score: number; reason: string } {
  const d = Math.abs(a.drinking - b.drinking);
  const score = Math.max(0, 100 - 25 * d);
  const reason =
    d === 0
      ? `음주 빈도가 같아요 (${DRINKING_SHORT[a.drinking]})`
      : `음주 빈도가 ${d}단계 차이나요`;
  return { score, reason };
}

function smokingScore(a: Profile, b: Profile): { score: number; reason: string } {
  const d = Math.abs(SMOKING_LEVEL[a.smoking] - SMOKING_LEVEL[b.smoking]);
  const score = [100, 50, 0][d];
  const reason =
    d === 0 ? `흡연 습관이 같아요 (${SMOKING_LABEL[a.smoking]})` : '흡연 습관이 조금 달라요';
  return { score, reason };
}

/** 항목별 원점수(0~100)와 근거. 다섯 항목 모두 대칭이라 A→B와 B→A의 원점수는 같다. */
export function itemScores(a: Profile, b: Profile): Record<SoftItem, { score: number; reason: string }> {
  return {
    interests: interestsScore(a, b),
    personality: personalityScore(a, b),
    region: regionScore(a, b),
    drinking: drinkingScore(a, b),
    smoking: smokingScore(a, b),
  };
}

// ──────────────────── 단계 3. 가중치 합산 ────────────────────

export function weightOf(viewer: Profile, item: SoftItem): number {
  return viewer.preference.important.includes(item) ? WEIGHT_IMPORTANT : WEIGHT_NORMAL;
}

/** viewer가 target을 볼 때의 점수 (viewer의 가중치 사용) */
export function directionalScore(viewer: Profile, target: Profile): DirectionalScore {
  const raw = itemScores(viewer, target);
  const totalWeight = SOFT_ITEMS.reduce((s, it) => s + weightOf(viewer, it), 0);
  const items: ItemScore[] = SOFT_ITEMS.map((item) => {
    const weight = weightOf(viewer, item);
    return {
      item,
      label: SOFT_ITEM_LABEL[item],
      score: raw[item].score,
      weight,
      points: (raw[item].score * weight) / totalWeight,
      reason: raw[item].reason,
    };
  });
  const score = items.reduce((s, it) => s + it.points, 0);
  return { score, items };
}

// ──────────────────── 단계 4. 양방향 결합 ────────────────────

export function combineScores(myScore: number, theirScore: number): number {
  return Math.sqrt(Math.max(0, myScore) * Math.max(0, theirScore));
}

export function buildHighlights(items: ItemScore[], count = 3): string[] {
  return [...items]
    .sort((x, y) => y.points - x.points || y.weight - x.weight)
    .slice(0, count)
    .map((it) => `${it.reason} +${Math.round(it.points)}점`);
}

/** 한 쌍을 평가한다. 어느 쪽이든 하드 필터에서 탈락하면 ok:false */
export function evaluatePair(me: Profile, other: Profile): PairResult {
  const rejections = mutualRejections(me, other);
  if (rejections.length > 0) return { ok: false, rejections };
  const mine = directionalScore(me, other);
  const theirs = directionalScore(other, me);
  return {
    ok: true,
    explanation: {
      total: combineScores(mine.score, theirs.score),
      myScore: mine.score,
      theirScore: theirs.score,
      items: mine.items,
      theirItems: theirs.items,
      highlights: buildHighlights(mine.items),
    },
  };
}

// ──────────────────── 단계 5. 정렬·TOP N ────────────────────

function byScoreThenId(a: { profile: Profile; explanation: Explanation }, b: typeof a): number {
  return b.explanation.total - a.explanation.total || a.profile.id.localeCompare(b.profile.id);
}

function emptyCounts(): RecommendResult['rejectionCounts'] {
  return {
    gender: { mine: 0, theirs: 0 },
    age: { mine: 0, theirs: 0 },
    height: { mine: 0, theirs: 0 },
    body: { mine: 0, theirs: 0 },
    region: { mine: 0, theirs: 0 },
    smoking: { mine: 0, theirs: 0 },
  };
}

function withPreference(me: Profile, patch: Partial<Preference>): Profile {
  return { ...me, preference: { ...me.preference, ...patch } };
}

function countEligible(me: Profile, others: Profile[]): number {
  return others.filter((o) => mutualRejections(me, o).length === 0).length;
}

/** 후보가 0명일 때 "조건을 이렇게 바꿔보세요" 제안을 만든다 */
export function suggestRelaxations(me: Profile, others: Profile[]): Suggestion[] {
  const p = me.preference;
  const tries: Omit<Suggestion, 'gain'>[] = [];

  const min5 = Math.max(AGE_MIN, p.ageMin - 5);
  const max5 = Math.min(AGE_MAX, p.ageMax + 5);
  if (min5 !== p.ageMin || max5 !== p.ageMax) {
    tries.push({ id: 'age', label: `나이 범위를 ${min5}~${max5}세로 넓혀보세요`, patch: { ageMin: min5, ageMax: max5 } });
  }
  const hMin = Math.max(HEIGHT_MIN, p.heightMin - 5);
  const hMax = Math.min(HEIGHT_MAX, p.heightMax + 5);
  if (hMin !== p.heightMin || hMax !== p.heightMax) {
    tries.push({ id: 'height', label: `키 범위를 ${hMin}~${hMax}cm로 넓혀보세요`, patch: { heightMin: hMin, heightMax: hMax } });
  }
  if (p.bodyTypes.length < ALL_BODY_TYPES.length) {
    tries.push({ id: 'body', label: '원하는 체형을 "모두"로 넓혀보세요', patch: { bodyTypes: [...ALL_BODY_TYPES] } });
  }
  if (p.regionMode !== 'any') {
    tries.push({ id: 'region', label: '지역 조건을 "상관없음"으로 바꿔보세요 (가까우면 점수는 여전히 높아요)', patch: { regionMode: 'any' } });
  }
  if (p.smokingAllow !== 'any') {
    tries.push({ id: 'smoking', label: '흡연 조건을 한 단계 완화해보세요', patch: { smokingAllow: p.smokingAllow === 'none' ? 'sometimes' : 'any' } });
  }
  if (p.genders.length < ALL_GENDERS.length) {
    tries.push({ id: 'gender', label: '보고 싶은 성별 범위를 넓혀보세요', patch: { genders: [...ALL_GENDERS] } });
  }
  if (tries.length > 1) {
    const all = Object.assign({}, ...tries.filter((t) => t.id !== 'gender').map((t) => t.patch)) as Partial<Preference>;
    tries.push({ id: 'all', label: '성별을 제외한 조건(나이·지역·흡연)을 한 번에 넓혀보세요', patch: all });
  }

  return tries
    .map((t) => ({ ...t, gain: countEligible(withPreference(me, t.patch), others) }))
    .filter((t) => t.gain > 0)
    .sort((a, b) => b.gain - a.gain);
}

/**
 * 모든 사용자의 TOP N을 한 번에 만든다.
 * exposureCap을 주면 점수가 높은 쌍부터 차례로 배정하되,
 * 한 사람이 다른 사람들의 리스트에 들어가는 횟수를 cap으로 제한한다(탐욕 배분).
 */
export function recommendAll(
  profiles: Profile[],
  opts: { topN?: number; exposureCap?: number } = {},
): Map<string, Candidate[]> {
  const topN = opts.topN ?? DEFAULT_TOP_N;
  const entries: { viewer: string; profile: Profile; explanation: Explanation }[] = [];
  for (const a of profiles) {
    for (const b of profiles) {
      if (a.id === b.id) continue;
      const r = evaluatePair(a, b);
      if (r.ok) entries.push({ viewer: a.id, profile: b, explanation: r.explanation });
    }
  }

  const lists = new Map<string, { profile: Profile; explanation: Explanation }[]>();
  for (const p of profiles) lists.set(p.id, []);

  if (opts.exposureCap === undefined) {
    for (const e of entries) lists.get(e.viewer)!.push(e);
    for (const [id, list] of lists) lists.set(id, list.sort(byScoreThenId).slice(0, topN));
  } else {
    const cap = opts.exposureCap;
    const exposure = new Map<string, number>();
    entries.sort((x, y) => byScoreThenId(x, y) || x.viewer.localeCompare(y.viewer));
    for (const e of entries) {
      const list = lists.get(e.viewer)!;
      const used = exposure.get(e.profile.id) ?? 0;
      if (list.length >= topN || used >= cap) continue;
      list.push(e);
      exposure.set(e.profile.id, used + 1);
    }
    for (const [id, list] of lists) lists.set(id, list.sort(byScoreThenId));
  }

  const out = new Map<string, Candidate[]>();
  for (const [id, list] of lists) {
    out.set(id, list.map((e, i) => ({ rank: i + 1, profile: e.profile, explanation: e.explanation })));
  }
  return out;
}

/** 나에게 맞는 TOP N 추천. 나 자신(id 동일)은 절대 포함하지 않는다. */
export function recommend(me: Profile, all: Profile[], opts: RecommendOptions = {}): RecommendResult {
  const topN = opts.topN ?? DEFAULT_TOP_N;
  const exclude = new Set(opts.excludeIds ?? []);
  const others = all.filter((p) => p.id !== me.id && !exclude.has(p.id));

  const rejectionCounts = emptyCounts();
  const passed: { profile: Profile; explanation: Explanation }[] = [];
  for (const other of others) {
    const r = evaluatePair(me, other);
    if (r.ok) {
      passed.push({ profile: other, explanation: r.explanation });
    } else {
      const seen = new Set<string>();
      for (const rej of r.rejections) {
        const key = `${rej.code}:${rej.side}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rejectionCounts[rej.code][rej.side]++;
      }
    }
  }

  let candidates: Candidate[];
  if (opts.exposureCap !== undefined) {
    // 노출 상한은 다른 사람들의 리스트와 함께 배분해야 하므로 전체 모집단으로 계산한다.
    const population = [me, ...all.filter((p) => p.id !== me.id)];
    const mine = recommendAll(population, { topN: topN, exposureCap: opts.exposureCap }).get(me.id) ?? [];
    candidates = mine.filter((c) => !exclude.has(c.profile.id)).map((c, i) => ({ ...c, rank: i + 1 }));
  } else {
    candidates = passed
      .sort(byScoreThenId)
      .slice(0, topN)
      .map((e, i) => ({ rank: i + 1, profile: e.profile, explanation: e.explanation }));
  }

  return {
    candidates,
    considered: others.length,
    eligible: passed.length,
    rejectionCounts,
    suggestions: candidates.length === 0 ? suggestRelaxations(me, others) : [],
  };
}
