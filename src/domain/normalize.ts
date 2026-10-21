import { ALL_BODY_TYPES, HEIGHT_MAX, HEIGHT_MIN } from './constants';
import type { Profile } from './types';

/**
 * 저장된 프로필을 현재 형식으로 맞춘다.
 * 키·체형·MBTI가 추가되기 전에 만든 프로필도 깨지지 않게 빈 값과 '상관없음' 조건을 채운다.
 */
export function normalizeProfile(p: Profile): Profile {
  return {
    ...p,
    height: p.height ?? null,
    bodyType: p.bodyType ?? null,
    mbti: p.mbti ?? null,
    job: p.job ?? null,
    preference: {
      ...p.preference,
      heightMin: p.preference.heightMin ?? HEIGHT_MIN,
      heightMax: p.preference.heightMax ?? HEIGHT_MAX,
      bodyTypes: p.preference.bodyTypes ?? [...ALL_BODY_TYPES],
    },
  };
}
