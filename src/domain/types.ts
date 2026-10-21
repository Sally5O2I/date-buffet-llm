// 도메인 타입. UI·저장소·매칭 로직이 모두 이 타입만 공유한다.

export type Gender = 'male' | 'female' | 'other';
export type Smoking = 'non' | 'sometimes' | 'smoker';
/** 체형(몸무게): 마름 / 보통 / 통통 */
export type BodyType = 'slim' | 'normal' | 'chubby';
/** 상대 흡연 허용 범위: 비흡연자만 / 가끔까지 / 상관없음 */
export type SmokingAllow = 'none' | 'sometimes' | 'any';
/** 지역 조건: 상관없음(점수만) / 같은 시·도 + 인접 / 같은 시·도만 */
export type RegionMode = 'any' | 'nearby' | 'same';
/** 소프트 점수 항목 */
export type SoftItem = 'interests' | 'personality' | 'region' | 'drinking' | 'smoking';

export interface Preference {
  /** 보고 싶은 성별(복수). 상대의 성별이 여기에 없으면 하드 필터 탈락 */
  genders: Gender[];
  ageMin: number;
  ageMax: number;
  /** 원하는 키 범위(cm). 상대의 키가 범위 밖이면 하드 필터 탈락 */
  heightMin: number;
  heightMax: number;
  /** 원하는 체형(복수). 상대의 체형이 여기에 없으면 하드 필터 탈락 */
  bodyTypes: BodyType[];
  regionMode: RegionMode;
  smokingAllow: SmokingAllow;
  /** 중요하게 보는 항목 3개 (가중치 2배) */
  important: SoftItem[];
}

export interface Profile {
  id: string;
  nickname: string;
  age: number;
  gender: Gender;
  /** 17개 광역 시·도 중 하나 */
  region: string;
  /** 키(cm). 이 항목이 생기기 전에 만든 프로필은 null (조건 검사에서 통과로 본다) */
  height: number | null;
  /** 체형. 예전 프로필은 null */
  bodyType: BodyType | null;
  /** MBTI 16유형 또는 'unknown'(잘 모름). 예전 프로필은 null */
  mbti: string | null;
  /** 직업 (자유 입력, 표시용). 예전 프로필은 null */
  job: string | null;
  interests: string[];
  personality: string[];
  smoking: Smoking;
  /** 0(안 마심) ~ 4(매우 자주) */
  drinking: number;
  bio: string;
  /** data URL (리사이즈된 이미지) */
  photo: string;
  preference: Preference;
  /** 가상 샘플 인물 여부 */
  isSample?: boolean;
  createdAt: number;
}

export interface Swipe {
  from: string;
  to: string;
  liked: boolean;
  at: number;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  at: number;
}

/** 게임 승리 등으로 얻은 메시지 권한 (from → to 방향) */
export interface Unlock {
  from: string;
  to: string;
  reason: 'game-win';
  at: number;
}

export type GameKind = 'rps' | 'coin';
export type RpsMove = 'rock' | 'paper' | 'scissors';
export type CoinSide = 'heads' | 'tails';
export type GameStatus = 'pending' | 'playing' | 'done' | 'declined';

export interface GameSession {
  id: string;
  kind: GameKind;
  /** 게임을 건 사람 */
  from: string;
  /** 게임을 받은 사람 */
  to: string;
  status: GameStatus;
  createdAt: number;
  updatedAt: number;
  round: number;
  /** rps: 건 사람의 수 / coin: 건 사람이 고른 면 */
  fromMove?: RpsMove | CoinSide;
  /** rps: 받은 사람의 수 */
  toMove?: RpsMove;
  /** coin: 실제로 나온 면 */
  coinResult?: CoinSide;
  /** 승자 id. 무승부는 null */
  winner?: string | null;
  /** 직전 라운드가 비겼을 때 보여줄 기록 */
  lastDraw?: { fromMove: RpsMove; toMove: RpsMove };
}
