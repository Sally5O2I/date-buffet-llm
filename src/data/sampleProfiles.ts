import { DEFAULT_COUNT, DEFAULT_SEED, generateProfiles } from './generator';

/** 앱에 기본으로 들어가는 가상 인물 50명 (모두 지어낸 인물) */
export const SAMPLE_PROFILES = generateProfiles(DEFAULT_COUNT, DEFAULT_SEED);
