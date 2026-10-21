import { describe, expect, it } from 'vitest';
import { ageCounterfactual, analyzeFairness, gini, type GroupKey } from '../src/domain/fairness';
import { SAMPLE_PROFILES } from '../src/data/sampleProfiles';
import { generateProfiles } from '../src/data/generator';

const MIN_RATIO = 0.8;
const KEYS: GroupKey[] = ['ageBand', 'gender', 'region'];

describe('지니계수', () => {
  it('모두 같으면 0, 한 명에게 몰리면 1에 가깝다', () => {
    expect(gini([3, 3, 3, 3])).toBeCloseTo(0);
    expect(gini([0, 0, 0, 0, 0, 0, 0, 0, 0, 10])).toBeCloseTo(0.9);
    expect(gini([])).toBe(0);
  });
});

describe('그룹 간 추천률 (최소/최대 ≥ 0.8)', () => {
  // 배포 기준은 추천 리스트 전체인 TOP 10.
  // TOP 5는 현재 지역 0.79로 기준 미달이며 `npm run simulate`에 참고용으로 출력된다 (README '공정성 결과' 참고).
  it.each(KEYS)('샘플 50명, TOP 10: %s', (key) => {
    const report = analyzeFairness(SAMPLE_PROFILES, { topN: 10 });
    expect(report.minMaxRatio[key], JSON.stringify(report.groups[key])).toBeGreaterThanOrEqual(MIN_RATIO);
  });
});

describe('생성기', () => {
  it('seed가 같으면 같은 결과, 다르면 다른 결과', () => {
    expect(generateProfiles(30, 1)).toEqual(generateProfiles(30, 1));
    expect(generateProfiles(30, 1)).not.toEqual(generateProfiles(30, 2));
    expect(new Set(generateProfiles(50).map((p) => p.nickname)).size).toBe(50);
  });

  it('50명이 17개 시·도, 3개 성별, 흡연·음주 단계에 고르게 퍼진다', () => {
    const ps = generateProfiles(50);
    expect(new Set(ps.map((p) => p.region)).size).toBe(17);
    expect(ps.filter((p) => p.gender === 'male')).toHaveLength(22);
    expect(ps.filter((p) => p.gender === 'female')).toHaveLength(22);
    expect(ps.filter((p) => p.gender === 'other')).toHaveLength(6);
    expect(new Set(ps.map((p) => p.smoking)).size).toBe(3);
    for (let d = 0; d <= 4; d++) expect(ps.filter((p) => p.drinking === d)).toHaveLength(10);
    expect(ps.filter((p) => p.bodyType === 'slim')).toHaveLength(14);
    expect(ps.filter((p) => p.bodyType === 'normal')).toHaveLength(26);
    expect(ps.filter((p) => p.bodyType === 'chubby')).toHaveLength(10);
    for (const p of ps) {
      expect(p.height).toBeGreaterThanOrEqual(152);
      expect(p.height).toBeLessThanOrEqual(186);
      expect(p.mbti).toBeTruthy();
    }
  });

  it('키·체형을 추가해도 기존 50명의 이름·지역·나이는 그대로다', () => {
    const ps = generateProfiles(50);
    expect(ps[0]).toMatchObject({ nickname: '황정숙', age: 38, region: '강원' });
    expect(ps[1]).toMatchObject({ nickname: '이영자', age: 25, region: '대구' });
  });
});

describe('반사실 테스트: 나이만 바꾼 쌍', () => {
  it('양쪽 조건을 모두 통과하는 상대에게는 나이가 달라도 점수 차이가 0이다', () => {
    let compared = 0;
    for (const base of SAMPLE_PROFILES) {
      for (const delta of [-2, -1, 1, 2]) {
        for (const row of ageCounterfactual(base, SAMPLE_PROFILES, delta)) {
          if (!row.eligibleBefore || !row.eligibleAfter) continue;
          compared++;
          expect(Math.abs(row.myAfter - row.myBefore)).toBeLessThan(1e-9);
          expect(Math.abs(row.theirAfter - row.theirBefore)).toBeLessThan(1e-9);
        }
      }
    }
    expect(compared).toBeGreaterThan(100);
  });

  it('나이는 하드 필터(범위)로만 결과를 바꾼다', () => {
    const base = SAMPLE_PROFILES[0];
    const rows = ageCounterfactual(base, SAMPLE_PROFILES, 20);
    // 크게 바꾸면 일부 상대의 나이 범위를 벗어나 제외될 수 있지만, 점수 자체는 그대로다
    for (const r of rows) {
      expect(r.myAfter).toBeCloseTo(r.myBefore);
      expect(r.theirAfter).toBeCloseTo(r.theirBefore);
    }
  });
});

describe('노출 상한', () => {
  it('상한을 걸면 최대 노출이 줄고 지니계수가 커지지 않는다', () => {
    const base = analyzeFairness(SAMPLE_PROFILES, { topN: 10 });
    const capped = analyzeFairness(SAMPLE_PROFILES, { topN: 10, exposureCap: 4 });
    expect(Math.max(...Object.values(capped.exposures))).toBeLessThanOrEqual(4);
    expect(capped.gini).toBeLessThanOrEqual(base.gini + 1e-9);
  });
});
