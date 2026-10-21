/**
 * 가상 프로필 생성기. seed가 같으면 항상 같은 사람들이 나온다(재현 가능).
 * 이름은 '김철수/박영자'처럼 흔한 가명 조합이며, 소개 문구와 함께 모두 지어낸 것으로 실존 인물과 무관하다.
 */
import {
  ALL_BODY_TYPES,
  ALL_GENDERS,
  HEIGHT_MAX,
  HEIGHT_MIN,
  INTERESTS,
  JOB_SUGGESTIONS,
  MBTI_TYPES,
  MBTI_UNKNOWN,
  PERSONALITIES,
  SOFT_ITEMS,
} from '../domain/constants';
import type { BodyType, Gender, Preference, Profile, RegionMode, Smoking, SmokingAllow } from '../domain/types';
import { makeAvatar } from './avatars';

export const DEFAULT_SEED = 20261014;
export const DEFAULT_COUNT = 50;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황'];
/** 나는솔로 스타일 가명 */
const GIVEN: Record<Gender, string[]> = {
  male: ['영수', '영호', '영식', '영철', '광수', '상철', '철수', '경수', '민수', '동훈', '정훈', '성민'],
  female: ['영숙', '정숙', '순자', '영자', '옥순', '현숙', '영희', '미영', '정희', '은숙', '말순', '경자'],
  other: ['하늘', '지우', '유진', '서윤', '태희', '한결', '보람', '새봄'],
};

const BIOS = [
  '주말엔 동네 카페 투어하는 걸 좋아해요.',
  '맛있는 거 같이 먹으러 다닐 사람 찾아요.',
  '산책하면서 이야기 나누는 시간이 제일 좋아요.',
  '요즘 베이킹에 빠져서 매주 뭔가 굽고 있어요.',
  '여행 계획 세우는 게 여행만큼 즐거워요.',
  '퇴근 후 러닝으로 하루를 정리해요.',
  '조용한 전시회 데이트를 좋아해요.',
  '고양이 집사 3년 차, 사진첩이 고양이로 가득해요.',
  '캠핑 장비 모으는 게 취미가 됐어요.',
  '새로운 음악 추천해주는 사람이 좋아요.',
  '천천히 알아가는 대화를 좋아해요.',
  '웃음 코드가 맞는 사람이면 좋겠어요.',
  '책 한 권 들고 공원 가는 걸 좋아해요.',
  '요리해서 같이 먹는 걸 좋아해요.',
  '보드게임 카페 단골이에요.',
  '등산 후 막걸리 한 잔이 최고예요.',
  '사진 찍으러 골목 산책 다녀요.',
  '봉사활동하면서 좋은 사람들을 많이 만났어요.',
  '드라이브하며 노래 부르는 걸 좋아해요.',
  '요가로 하루를 시작해요.',
  '공연 보러 다니는 걸 좋아해요.',
  '솔직하고 담백한 대화를 좋아해요.',
  '반려견이랑 공원 산책이 일상이에요.',
  '맛집 리스트가 엑셀로 정리돼 있어요.',
  '계획 없이 떠나는 여행도 좋아해요.',
  '영화 보고 수다 떠는 걸 좋아해요.',
  '새로운 취미 같이 배워볼 사람 환영해요.',
  '주말 아침 브런치를 좋아해요.',
  '차분하게 이야기 들어주는 편이에요.',
  '긍정적인 에너지를 나누고 싶어요.',
  '바다 보러 훌쩍 떠나는 걸 좋아해요.',
  '평일엔 일, 주말엔 운동으로 균형 잡는 중이에요.',
  '시장 구경하고 길거리 음식 먹는 거 좋아해요.',
  '집에서 영화 보며 쉬는 게 최고의 휴식이에요.',
  '자전거 타고 동네 한 바퀴 도는 게 낙이에요.',
  '식물 키우기에 진심이에요. 화분이 20개 넘어요.',
  '노래방 가면 마이크 잘 안 놓아요.',
  '커피보다 차를 좋아해요.',
  '혼자서도 잘 놀지만 같이 놀면 더 좋아요.',
  '전시·공연 정보 알려주는 거 좋아해요.',
  '소소한 일상 공유하는 사이가 좋아요.',
  '운동 같이 할 사람이면 더 좋아요.',
  '새벽 감성 대화 좋아해요.',
  '여행지에서 현지 음식 먹는 걸 제일 좋아해요.',
  '말보다 행동으로 보여주는 편이에요.',
  '서로 응원해주는 관계를 원해요.',
  '퍼즐 맞추기, 레고 조립 좋아해요.',
  '비 오는 날 전 부쳐 먹는 걸 좋아해요.',
  '주말엔 근교 드라이브 가요.',
  '배려심 있는 사람이 좋아요.',
];

/** 50명 기준 지역 배분: 17개 시·도 모두 최소 2명 */
const REGION_QUOTA: [string, number][] = [
  ['서울', 7], ['경기', 6], ['인천', 3],
  ['대전', 3], ['세종', 2], ['충북', 2], ['충남', 2],
  ['광주', 3], ['전북', 2], ['전남', 2],
  ['부산', 4], ['대구', 3], ['경북', 2], ['경남', 3], ['울산', 2],
  ['강원', 2], ['제주', 2],
];

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample<T>(arr: T[], k: number, rng: () => number): T[] {
  return shuffle(arr, rng).slice(0, k);
}

function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** n개 자리를 비율대로 채운 뒤 섞는다 (확률이 아니라 할당이라 분포가 고르게 나온다) */
function quota<T>(items: [T, number][], n: number, rng: () => number): T[] {
  const total = items.reduce((s, [, w]) => s + w, 0);
  const out: T[] = [];
  for (const [v, w] of items) for (let i = 0; i < Math.round((w / total) * n); i++) out.push(v);
  while (out.length < n) out.push(items[Math.floor(rng() * items.length)][0]);
  return shuffle(out.slice(0, n), rng);
}

function genderPreference(g: Gender, rng: () => number): Gender[] {
  const r = rng();
  if (g === 'other') {
    if (r < 0.5) return [...ALL_GENDERS];
    if (r < 0.75) return ['other', 'female'];
    return ['other', 'male'];
  }
  const opposite: Gender = g === 'male' ? 'female' : 'male';
  if (r < 0.6) return [opposite]; // 이성만
  if (r < 0.75) return [g]; // 동성만
  return [...ALL_GENDERS]; // 모두
}

/** 성별별로 겹치지 않는 '성+이름' 목록 */
function namePool(rng: () => number): Record<Gender, string[]> {
  const make = (g: Gender) => shuffle(SURNAMES.flatMap((s) => GIVEN[g].map((n) => s + n)), rng);
  return { male: make('male'), female: make('female'), other: make('other') };
}

export function generateProfiles(n = DEFAULT_COUNT, seed = DEFAULT_SEED): Profile[] {
  const rng = mulberry32(seed);
  const genders = quota<Gender>([['male', 22], ['female', 22], ['other', 6]], n, rng);
  const bands = quota<[number, number]>([[[21, 27], 1], [[28, 33], 1], [[34, 40], 1]], n, rng);
  const regions = quota(REGION_QUOTA, n, rng);
  const smokings = quota<Smoking>([['non', 32], ['sometimes', 11], ['smoker', 7]], n, rng);
  const drinkings = quota<number>([[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], n, rng);
  const names = namePool(rng);
  const used: Record<Gender, number> = { male: 0, female: 0, other: 0 };
  const bios = shuffle(BIOS, rng);

  const base = Array.from({ length: n }, (_, i) => {
    const gender = genders[i];
    const [lo, hi] = bands[i];
    const age = int(rng, lo, hi);
    const pool = names[gender];
    const nickname = pool[used[gender]++ % pool.length];
    const regionR = rng();
    const regionMode: RegionMode = regionR < 0.75 ? 'any' : regionR < 0.92 ? 'nearby' : 'same';
    const allowR = rng();
    const smokingAllow: SmokingAllow = allowR < 0.2 ? 'none' : allowR < 0.5 ? 'sometimes' : 'any';
    const preference = {
      genders: genderPreference(gender, rng),
      ageMin: Math.max(19, age - int(rng, 5, 10)),
      ageMax: Math.min(60, age + int(rng, 5, 10)),
      regionMode,
      smokingAllow,
      important: sample(SOFT_ITEMS, 3, rng),
    };
    return {
      id: `sample-${String(i + 1).padStart(2, '0')}`,
      nickname,
      age,
      gender,
      region: regions[i],
      interests: sample(INTERESTS, int(rng, 3, 5), rng),
      personality: sample(PERSONALITIES, int(rng, 2, 4), rng),
      smoking: smokings[i],
      drinking: drinkings[i],
      bio: bios[i % bios.length],
      photo: makeAvatar(seed + i * 7919, gender),
      preference,
      isSample: true,
      createdAt: 0,
    };
  });

  // 키·체형·MBTI는 나중에 추가된 항목이라 별도의 난수열로 만든다.
  // (기존 이름·지역·성향 등이 seed 그대로 유지되도록)
  const rng2 = mulberry32(seed ^ 0x9e3779b9);
  const bodies = quota<BodyType>([['slim', 14], ['normal', 26], ['chubby', 10]], n, rng2);
  const heightRange: Record<Gender, [number, number]> = { male: [165, 186], female: [152, 172], other: [155, 182] };
  // 직업도 별도 난수열 (키·체형 값이 바뀌지 않게)
  const rng3 = mulberry32(seed ^ 0x51ed27);
  const jobPool = JOB_SUGGESTIONS.filter((j) => j !== '비공개');
  const jobs = Array.from({ length: n }, () => (rng3() < 0.06 ? '비공개' : jobPool[Math.floor(rng3() * jobPool.length)]));

  return base.map((p, i): Profile => {
    const [hLo, hHi] = heightRange[p.gender];
    const heightAny = rng2() < 0.5; // 절반은 키 상관없음
    const bodyR = rng2();
    const bodyTypes: BodyType[] =
      bodyR < 0.55 ? [...ALL_BODY_TYPES] : bodyR < 0.8 ? ['slim', 'normal'] : ['normal', 'chubby'];
    const preference: Preference = {
      ...p.preference,
      heightMin: heightAny ? HEIGHT_MIN : int(rng2, 150, 165),
      heightMax: heightAny ? HEIGHT_MAX : int(rng2, 176, 195),
      bodyTypes,
    };
    return {
      ...p,
      height: int(rng2, hLo, hHi),
      bodyType: bodies[i],
      mbti: rng2() < 0.1 ? MBTI_UNKNOWN : MBTI_TYPES[Math.floor(rng2() * MBTI_TYPES.length)],
      job: jobs[i],
      preference,
    };
  });
}
