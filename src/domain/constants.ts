import type { BodyType, Gender, RegionMode, Smoking, SmokingAllow, SoftItem } from './types';

export const AGE_MIN = 19;
export const AGE_MAX = 60;

export const HEIGHT_MIN = 130;
export const HEIGHT_MAX = 230;

export const BODY_TYPE_OPTIONS: { value: BodyType; label: string }[] = [
  { value: 'slim', label: '마름' },
  { value: 'normal', label: '보통' },
  { value: 'chubby', label: '통통' },
];
export const BODY_TYPE_LABEL: Record<BodyType, string> = { slim: '마름', normal: '보통', chubby: '통통' };
export const ALL_BODY_TYPES: BodyType[] = ['slim', 'normal', 'chubby'];

export const MBTI_TYPES = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
] as const;
export const MBTI_UNKNOWN = 'unknown';

/** 직업 입력칸의 자동완성 제안 (자유 입력 가능) */
export const JOB_SUGGESTIONS = [
  '회사원', '공무원', '교사', '간호사', '의료인', '약사', '개발자', '디자이너', '연구원', '엔지니어',
  '마케터', '기획자', '금융업', '영업직', '자영업', '프리랜서', '요리사', '승무원', '사회복지사', '방송·미디어',
  '예술가', '군인', '경찰·소방', '대학생', '대학원생', '취업 준비 중', '비공개',
];
export const JOB_MAX = 20;
export function mbtiLabel(mbti: string | null): string | null {
  if (!mbti) return null;
  return mbti === MBTI_UNKNOWN ? 'MBTI 모름' : mbti;
}

/** 키·체형·MBTI 한 줄 표시 (입력 안 된 항목은 생략) — 예: "175cm · 보통 · ENFP" */
export function bodyLine(p: { height: number | null; bodyType: BodyType | null; mbti: string | null }): string {
  return [p.height != null ? `${p.height}cm` : null, p.bodyType ? BODY_TYPE_LABEL[p.bodyType] : null, mbtiLabel(p.mbti)]
    .filter(Boolean)
    .join(' · ');
}

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
  { value: 'other', label: '기타' },
];
export const GENDER_LABEL: Record<Gender, string> = { male: '남성', female: '여성', other: '기타' };
export const ALL_GENDERS: Gender[] = ['male', 'female', 'other'];

export const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const;

/** 육지로 맞닿은 시·도 (한쪽만 적어도 아래에서 대칭으로 만든다) */
const ADJACENT_RAW: Record<string, string[]> = {
  서울: ['경기', '인천'],
  인천: ['경기'],
  경기: ['강원', '충북', '충남'],
  강원: ['충북', '경북'],
  충북: ['경북', '대전', '세종', '충남', '전북'],
  충남: ['세종', '대전', '전북'],
  세종: ['대전'],
  전북: ['경북', '경남', '전남'],
  전남: ['광주', '경남'],
  경북: ['대구', '경남', '울산'],
  대구: ['경남'],
  경남: ['울산', '부산'],
  울산: ['부산'],
};

export const ADJACENCY: Record<string, Set<string>> = (() => {
  const map: Record<string, Set<string>> = {};
  for (const r of REGIONS) map[r] = new Set();
  for (const [a, list] of Object.entries(ADJACENT_RAW)) {
    for (const b of list) {
      map[a].add(b);
      map[b].add(a);
    }
  }
  return map;
})();

/** 공정성 분석용 권역 */
export const REGION_GROUP: Record<string, string> = {
  서울: '수도권', 인천: '수도권', 경기: '수도권',
  대전: '충청', 세종: '충청', 충북: '충청', 충남: '충청',
  광주: '호남', 전북: '호남', 전남: '호남',
  부산: '영남', 대구: '영남', 울산: '영남', 경북: '영남', 경남: '영남',
  강원: '강원·제주', 제주: '강원·제주',
};

export const INTERESTS = [
  '영화', '음악', '여행', '독서', '요리', '카페', '운동', '등산', '캠핑', '게임',
  '사진', '전시회', '반려동물', '맛집', '댄스', '봉사활동', '공연', '드라이브', '요가', '재테크',
];

export const PERSONALITIES = [
  '외향적', '차분한', '유머러스', '진지한', '리더형', '배려형',
  '계획형', '즉흥적', '다정한', '솔직한', '긍정적', '섬세한',
];

/** 서로 다르지만 잘 맞는(보완되는) 성격 쌍 */
export const COMPLEMENT_PAIRS: [string, string][] = [
  ['외향적', '차분한'],
  ['리더형', '배려형'],
  ['계획형', '즉흥적'],
  ['유머러스', '진지한'],
];

export const SMOKING_OPTIONS: { value: Smoking; label: string }[] = [
  { value: 'non', label: '비흡연' },
  { value: 'sometimes', label: '가끔' },
  { value: 'smoker', label: '흡연' },
];
export const SMOKING_LABEL: Record<Smoking, string> = { non: '비흡연', sometimes: '가끔 흡연', smoker: '흡연' };
export const SMOKING_LEVEL: Record<Smoking, number> = { non: 0, sometimes: 1, smoker: 2 };

export const SMOKING_ALLOW_OPTIONS: { value: SmokingAllow; label: string }[] = [
  { value: 'none', label: '비흡연자만' },
  { value: 'sometimes', label: '가끔 피우는 정도까지' },
  { value: 'any', label: '상관없음' },
];

export const DRINKING_LABELS = ['안 마셔요', '가끔 (월 1~2회)', '보통 (주 1회)', '자주 (주 2~3회)', '매우 자주'];
export const DRINKING_SHORT = ['안 마심', '가끔', '보통', '자주', '매우 자주'];

export const REGION_MODE_OPTIONS: { value: RegionMode; label: string }[] = [
  { value: 'any', label: '상관없음 (점수에만 반영)' },
  { value: 'nearby', label: '같은 시/도 + 인접 지역만' },
  { value: 'same', label: '같은 시/도만' },
];

export const SOFT_ITEMS: SoftItem[] = ['interests', 'personality', 'region', 'drinking', 'smoking'];
export const SOFT_ITEM_LABEL: Record<SoftItem, string> = {
  interests: '관심사',
  personality: '성격',
  region: '지역',
  drinking: '음주 습관',
  smoking: '흡연 습관',
};
