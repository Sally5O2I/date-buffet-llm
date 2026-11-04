import { HEIGHT_MAX, HEIGHT_MIN } from './constants';
import type { Preference, Profile } from './types';

/** 없어진 항목(체형)이 남아 있는 예전 저장 데이터 */
type LegacyProfile = Profile & { bodyType?: unknown; preference: Preference & { bodyTypes?: unknown } };

/**
 * 저장된 프로필을 현재 형식으로 맞춘다.
 * 키·MBTI가 추가되기 전에 만든 프로필도 깨지지 않게 빈 값과 '상관없음' 조건을 채우고,
 * 예전에 입력한 체형 정보는 버린다.
 */
export function normalizeProfile(p: Profile): Profile {
  const { bodyType: _bodyType, ...rest } = p as LegacyProfile;
  const { bodyTypes: _bodyTypes, ...preference } = rest.preference;
  return {
    ...rest,
    height: p.height ?? null,
    mbti: p.mbti ?? null,
    job: p.job ?? null,
    preference: {
      ...preference,
      heightMin: preference.heightMin ?? HEIGHT_MIN,
      heightMax: preference.heightMax ?? HEIGHT_MAX,
    },
  };
}
