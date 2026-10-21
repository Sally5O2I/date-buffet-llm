/**
 * 데이터 접근 인터페이스.
 * UI와 매칭 로직은 이 인터페이스만 알고, 실제 저장소(localStorage / Supabase)는 모른다.
 * 모든 메서드는 Promise를 반환해 원격 저장소로 바꿔도 호출 코드가 그대로다.
 */
import type { GameSession, Message, Profile, Swipe, Unlock } from '../domain/types';

export type RepoTopic = 'profiles' | 'swipes' | 'messages' | 'unlocks' | 'games' | 'presence';

export interface Repository {
  /** local: 이 브라우저에만 저장 / supabase: 서버에 저장, 실제 사용자끼리 매칭 */
  readonly mode: 'local' | 'supabase';

  // 계정 (아이디 + 비밀번호)
  /** 가입하고 바로 로그인한다. 반환값은 사용자 id (프로필 id로도 쓴다) */
  signUp(username: string, password: string): Promise<string>;
  /** 로그인한다. 반환값은 사용자 id */
  signIn(username: string, password: string): Promise<string>;
  signOut(): Promise<void>;
  /** 로그인 중인 사용자 id (없으면 null) */
  getCurrentUserId(): Promise<string | null>;
  /** 로그인 중인 아이디 (없으면 null) */
  getCurrentUsername(): Promise<string | null>;
  /** 내 계정과 프로필·좋아요·메시지·게임 기록을 모두 지우고 로그아웃 */
  deleteAccount(): Promise<void>;

  // 프로필
  listProfiles(): Promise<Profile[]>;
  saveProfile(profile: Profile): Promise<Profile>;

  // 좋아요/싫어요
  listSwipes(): Promise<Swipe[]>;
  saveSwipe(swipe: Swipe): Promise<void>;

  // 메시지
  listMessages(userId: string): Promise<Message[]>;
  sendMessage(message: Message): Promise<Message>;

  // 게임 승리로 얻은 메시지 권한
  listUnlocks(): Promise<Unlock[]>;
  addUnlock(unlock: Unlock): Promise<void>;

  // 게임
  listGames(userId: string): Promise<GameSession[]>;
  createGame(game: GameSession): Promise<GameSession>;
  /**
   * 게임 상태를 고친다. expectedUpdatedAt을 주면 그 사이 다른 사람이 고쳤을 때 GameConflictError를 던진다
   * (두 사람이 동시에 수를 내도 한쪽이 사라지지 않게).
   */
  updateGame(id: string, patch: Partial<GameSession>, expectedUpdatedAt?: number): Promise<GameSession | null>;

  // 접속 상태
  heartbeat(userId: string): Promise<void>;
  listOnlineIds(): Promise<string[]>;

  /** 데이터가 바뀌면(다른 탭 포함) 호출된다. 반환값은 구독 해제 함수 */
  subscribe(listener: (topic: RepoTopic) => void): () => void;

  /** local 모드 전용: 이 브라우저의 모든 테스트 계정·데이터 삭제 (supabase에서는 deleteAccount와 같음) */
  reset(): Promise<void>;
}

/** 아이디·비밀번호 관련 오류 (화면에 그대로 보여줄 문구) */
export class AuthError extends Error {}

export class GameConflictError extends Error {
  constructor() {
    super('게임 상태가 그 사이 바뀌었어요.');
  }
}

export class StorageFullError extends Error {
  constructor() {
    super('브라우저 저장 공간이 가득 찼어요. 사진을 더 작은 것으로 바꾸거나 테스트 데이터를 초기화해 주세요.');
  }
}
