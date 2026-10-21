import type { Profile } from '../src/domain/types';

let seq = 0;

/** 테스트용 프로필. 기본값은 서로 무난하게 맞도록 잡고 필요한 것만 덮어쓴다. */
type Overrides = Partial<Omit<Profile, 'preference'>> & { preference?: Partial<Profile['preference']> };

export function makeProfile(overrides: Overrides = {}): Profile {
  seq++;
  const { preference, ...rest } = overrides;
  return {
    id: `t-${seq}`,
    nickname: `테스트${seq}`,
    age: 30,
    gender: 'female',
    region: '서울',
    height: 170,
    bodyType: 'normal',
    mbti: 'ENFP',
    job: '회사원',
    interests: ['영화', '여행', '카페'],
    personality: ['다정한', '긍정적'],
    smoking: 'non',
    drinking: 1,
    bio: '테스트 프로필',
    photo: 'data:,',
    createdAt: 0,
    ...rest,
    preference: {
      genders: ['male', 'female', 'other'],
      ageMin: 20,
      ageMax: 45,
      heightMin: 130,
      heightMax: 230,
      bodyTypes: ['slim', 'normal', 'chubby'],
      regionMode: 'any',
      smokingAllow: 'any',
      important: ['interests', 'personality', 'region'],
      ...preference,
    },
  };
}
