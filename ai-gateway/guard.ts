/**
 * AI 문지기의 검사 규칙 — 순수 함수 (tests/guard.test.ts 에서 테스트).
 *
 * 인터넷에 열린 주소로는 "소개팅 설명 요청"만 Ollama까지 보낸다.
 *  - 시스템 프롬프트가 앱의 것(EXPLAIN_SYSTEM)과 글자 하나까지 같아야 한다.
 *  - 사용자 메시지는 "[사실]"로 시작하고 3000자 이하여야 한다.
 *  - 모델·출력 형식(JSON)·최대 길이는 문지기가 강제로 정한다 (요청에 뭐가 와도 무시).
 */
import { EXPLAIN_SCHEMA, EXPLAIN_SYSTEM } from '../src/domain/explainPrompt';

export const ALLOWED_MODEL = 'qwen2.5:3b';
export const MAX_USER_CHARS = 3000;

export type GuardResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; status: number; reason: string };

export function checkExplainRequest(body: unknown): GuardResult {
  const deny = (reason: string): GuardResult => ({ ok: false, status: 403, reason });
  if (!body || typeof body !== 'object') return deny('요청 형식이 올바르지 않아요.');
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length !== 2) return deny('소개팅 설명 요청만 받을 수 있어요.');
  const [sys, user] = messages as { role?: unknown; content?: unknown }[];
  if (sys?.role !== 'system' || sys.content !== EXPLAIN_SYSTEM) return deny('소개팅 설명 요청만 받을 수 있어요.');
  if (user?.role !== 'user' || typeof user.content !== 'string') return deny('소개팅 설명 요청만 받을 수 있어요.');
  if (!user.content.startsWith('[사실]')) return deny('소개팅 설명 요청만 받을 수 있어요.');
  if (user.content.length > MAX_USER_CHARS) return { ok: false, status: 413, reason: '요청이 너무 길어요.' };

  return {
    ok: true,
    payload: {
      model: ALLOWED_MODEL,
      messages: [
        { role: 'system', content: EXPLAIN_SYSTEM },
        { role: 'user', content: user.content },
      ],
      stream: true,
      format: EXPLAIN_SCHEMA,
      options: { temperature: 0.2, num_predict: 320 },
    },
  };
}

/** 한 사람(IP)이 1분에 보낼 수 있는 요청 수 제한 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** 허용되면 true. now는 테스트용으로 주입 가능 */
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

/** 접속 허용 주소 (CORS). 앱 배포 주소와 이 컴퓨터의 개발 서버만 */
export const ALLOWED_ORIGINS = [
  'https://sally5o2i.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];
