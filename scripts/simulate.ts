/**
 * 공정성 시뮬레이션.
 *   npm run simulate                      # 샘플 50명, TOP 10
 *   npm run simulate -- --n 300 --top 5   # 생성기로 300명
 *   npm run simulate -- --cap 3           # 노출 상한 비교
 * 그룹 간 추천률 최소/최대 비율이 0.8 미만이면 exit code 1
 */
import { generateProfiles, DEFAULT_SEED } from '../src/data/generator';
import { analyzeFairness, ageCounterfactual, GROUP_LABEL, type FairnessReport, type GroupKey } from '../src/domain/fairness';

function arg(name: string, fallback?: number): number | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

const n = arg('n', 50)!;
const topN = arg('top', 10)!;
const seed = arg('seed', DEFAULT_SEED)!;
const cap = arg('cap');
const MIN_RATIO = 0.8;

const profiles = generateProfiles(n, seed);
const f2 = (x: number) => Number(x.toFixed(2));

function printReport(title: string, r: FairnessReport) {
  console.log(`\n━━━ ${title} ━━━`);
  console.table({
    '인원': r.n,
    'TOP N': r.topN,
    '노출 상한': r.exposureCap ?? '없음',
    '노출 지니계수': f2(r.gini),
    '0명 추천 비율': `${(r.zeroRate * 100).toFixed(1)}%`,
    '최대 노출': Math.max(...Object.values(r.exposures)),
    '최소 노출': Math.min(...Object.values(r.exposures)),
  });
  for (const key of Object.keys(r.groups) as GroupKey[]) {
    console.log(`\n[${GROUP_LABEL[key]}]  추천률 최소/최대 = ${f2(r.minMaxRatio[key])} ${r.minMaxRatio[key] >= MIN_RATIO ? '✅' : '❌'}`);
    console.table(
      r.groups[key].map((g) => ({
        그룹: g.group,
        인원: g.members,
        '평균 노출 수': f2(g.avgExposure),
        '평균 노출 기회': f2(g.avgOpportunity),
        '추천률(노출÷기회)': f2(g.rate),
      })),
    );
  }
}

const base = analyzeFairness(profiles, { topN });
printReport(`기본 (n=${n}, seed=${seed})`, base);

// 참고: TOP 5 (배포 기준 아님 — README '공정성 결과' 참고)
if (topN !== 5) {
  const r5 = analyzeFairness(profiles, { topN: 5 });
  console.log('\n━━━ 참고: TOP 5 (배포 기준 아님) ━━━');
  for (const key of Object.keys(r5.minMaxRatio) as GroupKey[]) {
    console.log(`[${GROUP_LABEL[key]}] 추천률 최소/최대 = ${f2(r5.minMaxRatio[key])} ${r5.minMaxRatio[key] >= MIN_RATIO ? '✅' : '⚠️ 기준 미달'}`);
  }
}

let capped: FairnessReport | undefined;
if (cap !== undefined) {
  capped = analyzeFairness(profiles, { topN, exposureCap: cap });
  printReport(`노출 상한 ${cap}`, capped);
  console.log(`\n지니계수 ${f2(base.gini)} → ${f2(capped.gini)}, 0명 추천 비율 ${(base.zeroRate * 100).toFixed(1)}% → ${(capped.zeroRate * 100).toFixed(1)}%`);
}

// 반사실: 나이만 ±1, ±2 바꾼 쌍
let compared = 0;
let maxDiff = 0;
let flipped = 0;
for (const p of profiles) {
  for (const d of [-2, -1, 1, 2]) {
    for (const row of ageCounterfactual(p, profiles, d)) {
      if (row.eligibleBefore !== row.eligibleAfter) flipped++;
      if (!row.eligibleBefore || !row.eligibleAfter) continue;
      compared++;
      maxDiff = Math.max(maxDiff, Math.abs(row.myAfter - row.myBefore), Math.abs(row.theirAfter - row.theirBefore));
    }
  }
}
console.log('\n━━━ 반사실 테스트 (나이만 ±1, ±2) ━━━');
console.table({ '비교한 쌍': compared, '최대 점수 차이': maxDiff, '나이 범위 때문에 통과 여부가 바뀐 쌍': flipped });

const failed = [base, ...(capped ? [capped] : [])].some((r) =>
  Object.values(r.minMaxRatio).some((v) => v < MIN_RATIO),
);
if (failed || maxDiff > 1e-9) {
  console.error(`\n❌ 공정성 기준 미달 (추천률 비율 < ${MIN_RATIO} 또는 반사실 점수 차이 발생)`);
  process.exit(1);
}
console.log('\n✅ 공정성 기준 통과');
