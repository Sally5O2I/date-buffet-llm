import { AGE_MAX, AGE_MIN, HEIGHT_MAX, HEIGHT_MIN, JOB_MAX, MBTI_TYPES, MBTI_UNKNOWN, REGIONS } from './constants';
import type { Profile } from './types';

/** 연락처·SNS 아이디 같은 민감 정보가 들어 있는지 */
export function containsContactInfo(text: string): boolean {
  const compact = text.replace(/[\s.\-()]/g, '');
  return (
    /01[016789]\d{7,8}/.test(compact) || // 휴대폰 번호
    /\d{2,3}\d{3,4}\d{4}/.test(compact) || // 일반 전화번호
    /[\w.+-]+@[\w-]+\.[\w.]+/.test(text) || // 이메일
    /(카톡|카카오|kakao|katalk|인스타|insta|instagram|텔레그램|telegram|라인\s*아이디|open\.kakao|https?:\/\/)/i.test(text)
  );
}

export const CONTACT_ERROR = '연락처, 이메일, SNS 아이디, 링크는 입력할 수 없어요.';

export const USERNAME_RULE = '영문 소문자·숫자·밑줄(_) 4~16자';
export const PASSWORD_MIN = 6;

/** 아이디·비밀번호 검사. confirm을 주면 비밀번호 확인도 검사한다 (가입 화면) */
export function validateCredentials(
  username: string,
  password: string,
  confirm?: string,
): Partial<Record<'username' | 'password' | 'confirm', string>> {
  const e: Partial<Record<'username' | 'password' | 'confirm', string>> = {};
  if (!/^[a-z0-9_]{4,16}$/.test(username)) e.username = `아이디는 ${USERNAME_RULE}로 입력해 주세요.`;
  if (password.length < PASSWORD_MIN || password.length > 64) e.password = `비밀번호는 ${PASSWORD_MIN}~64자로 입력해 주세요.`;
  if (confirm !== undefined && confirm !== password) e.confirm = '비밀번호가 서로 달라요.';
  return e;
}

export type ProfileErrors = Partial<Record<string, string>>;

export function validateProfile(p: Omit<Profile, 'id' | 'createdAt'>): ProfileErrors {
  const e: ProfileErrors = {};
  const name = p.nickname.trim();
  if (name.length < 2 || name.length > 12) e.nickname = '닉네임은 2~12자로 입력해 주세요.';
  else if (containsContactInfo(name)) e.nickname = CONTACT_ERROR;
  if (!Number.isInteger(p.age) || p.age < AGE_MIN || p.age > AGE_MAX) e.age = `나이는 ${AGE_MIN}~${AGE_MAX}세 사이로 입력해 주세요.`;
  if (!p.gender) e.gender = '성별을 선택해 주세요.';
  if (!(REGIONS as readonly string[]).includes(p.region)) e.region = '지역을 선택해 주세요.';
  if (p.height == null || !Number.isInteger(p.height) || p.height < HEIGHT_MIN || p.height > HEIGHT_MAX) {
    e.height = `키는 ${HEIGHT_MIN}~${HEIGHT_MAX}cm 사이 정수로 입력해 주세요.`;
  }
  if (!p.bodyType) e.bodyType = '체형을 선택해 주세요.';
  const job = (p.job ?? '').trim();
  if (job.length < 2 || job.length > JOB_MAX) e.job = `직업을 2~${JOB_MAX}자로 입력해 주세요. (밝히기 싫으면 "비공개")`;
  else if (containsContactInfo(job)) e.job = CONTACT_ERROR;
  if (!p.mbti || !([...MBTI_TYPES, MBTI_UNKNOWN] as string[]).includes(p.mbti)) e.mbti = 'MBTI를 선택해 주세요. (모르면 "잘 모르겠어요")';
  if (p.interests.length < 1) e.interests = '관심사를 1개 이상 골라 주세요.';
  else if (p.interests.length > 8) e.interests = '관심사는 최대 8개까지 고를 수 있어요.';
  if (p.personality.length < 1) e.personality = '성격 키워드를 1개 이상 골라 주세요.';
  else if (p.personality.length > 5) e.personality = '성격 키워드는 최대 5개까지 고를 수 있어요.';
  if (!p.smoking) e.smoking = '흡연 여부를 선택해 주세요.';
  if (!(p.drinking >= 0 && p.drinking <= 4)) e.drinking = '음주 빈도를 선택해 주세요.';
  const bio = p.bio.trim();
  if (bio.length < 5 || bio.length > 60) e.bio = '한 줄 소개는 5~60자로 입력해 주세요.';
  else if (containsContactInfo(bio)) e.bio = CONTACT_ERROR;
  if (!p.photo) e.photo = '사진을 등록해 주세요. (필수)';

  const pref = p.preference;
  if (pref.genders.length === 0) e.prefGenders = '보고 싶은 성별을 1개 이상 선택해 주세요.';
  if (
    !Number.isInteger(pref.ageMin) || !Number.isInteger(pref.ageMax) ||
    pref.ageMin < AGE_MIN || pref.ageMax > AGE_MAX || pref.ageMin > pref.ageMax
  ) {
    e.prefAge = `나이 범위를 ${AGE_MIN}~${AGE_MAX}세 안에서, 최소 ≤ 최대로 입력해 주세요.`;
  }
  if (
    !Number.isInteger(pref.heightMin) || !Number.isInteger(pref.heightMax) ||
    pref.heightMin < HEIGHT_MIN || pref.heightMax > HEIGHT_MAX || pref.heightMin > pref.heightMax
  ) {
    e.prefHeight = `키 범위를 ${HEIGHT_MIN}~${HEIGHT_MAX}cm 안에서, 최소 ≤ 최대로 입력해 주세요.`;
  }
  if (pref.bodyTypes.length === 0) e.prefBody = '원하는 체형을 1개 이상 선택해 주세요.';
  if (pref.important.length !== 3) e.important = `중요한 항목을 정확히 3개 골라 주세요. (지금 ${pref.important.length}개)`;
  return e;
}
