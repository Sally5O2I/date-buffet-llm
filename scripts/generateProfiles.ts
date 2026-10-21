/**
 * 가상 프로필 생성기 CLI.
 *   npm run generate                       # 50명 요약 표
 *   npm run generate -- --n 50 --seed 7 --out profiles.json
 */
import { writeFileSync } from 'node:fs';
import { DEFAULT_SEED, generateProfiles } from '../src/data/generator';
import { GENDER_LABEL, SMOKING_LABEL, DRINKING_LABELS } from '../src/domain/constants';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const n = Number(arg('n') ?? 50);
const seed = Number(arg('seed') ?? DEFAULT_SEED);
const out = arg('out');
const profiles = generateProfiles(n, seed);

console.table(
  profiles.map((p) => ({
    id: p.id,
    닉네임: p.nickname,
    나이: p.age,
    성별: GENDER_LABEL[p.gender],
    지역: p.region,
    흡연: SMOKING_LABEL[p.smoking],
    음주: DRINKING_LABELS[p.drinking],
    '원하는 성별': p.preference.genders.map((g) => GENDER_LABEL[g]).join('·'),
    '원하는 나이': `${p.preference.ageMin}~${p.preference.ageMax}`,
  })),
);

if (out) {
  writeFileSync(out, JSON.stringify(profiles.map(({ photo: _photo, ...rest }) => rest), null, 2));
  console.log(`저장: ${out}`);
}
