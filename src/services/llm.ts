/**
 * 로컬 LLM(Ollama) 연결.
 * 이 컴퓨터에서 Ollama가 켜져 있을 때만 동작하고, 아니면 호출하는 쪽이 규칙 기반 설명으로 대체한다.
 * API 키·서버가 필요 없고, 프로필이 외부 회사로 전송되지 않는다.
 */
import type { ChatMessage } from '../domain/explainPrompt';

export interface AiSettings {
  /** Ollama 주소 (기본 http://localhost:11434) */
  baseUrl: string;
  /** 사용할 모델 (페르소나가 없는 기본 모델 권장) */
  model: string;
}

const KEY = 'bm.ai';
export const DEFAULT_AI: AiSettings = { baseUrl: 'http://localhost:11434', model: 'qwen2.5:3b' };

export function loadAiSettings(): AiSettings {
  try {
    return { ...DEFAULT_AI, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULT_AI;
  }
}

export function saveAiSettings(s: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 실패해도 이번 화면에는 적용된다 */
  }
}

function normalizeUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(u) ? u : `http://${u}`;
}

export type OllamaStatus =
  | { ok: true; version: string; models: string[]; hasModel: boolean }
  | { ok: false; reason: string };

/** Ollama가 켜져 있는지, 모델이 설치돼 있는지 확인 */
export async function checkOllama(s: AiSettings, timeoutMs = 3000): Promise<OllamaStatus> {
  const base = normalizeUrl(s.baseUrl);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const [v, tags] = await Promise.all([
      fetch(`${base}/api/version`, { signal: ctrl.signal }).then((r) => r.json()),
      fetch(`${base}/api/tags`, { signal: ctrl.signal }).then((r) => r.json()),
    ]);
    const models: string[] = (tags.models ?? []).map((m: { name: string }) => m.name);
    const want = s.model.includes(':') ? s.model : `${s.model}:latest`;
    return { ok: true, version: v.version ?? '?', models, hasModel: models.includes(want) };
  } catch {
    return {
      ok: false,
      reason: '로컬 AI(Ollama)에 연결할 수 없어요. Ollama가 켜져 있는지, 접속 허용(OLLAMA_ORIGINS) 설정이 되어 있는지 확인해 주세요.',
    };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Ollama /api/chat 을 스트리밍으로 호출한다. 글자가 생기는 대로 onToken이 불린다.
 * 반환값은 전체 출력 문자열.
 */
export async function chatStream(
  s: AiSettings,
  messages: ChatMessage[],
  onToken: (textSoFar: string) => void,
  signal?: AbortSignal,
  /** JSON 스키마를 주면 Ollama가 그 형식으로만 답한다 (structured output) */
  format?: object,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${normalizeUrl(s.baseUrl)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: s.model,
        messages,
        stream: true,
        ...(format ? { format } : {}),
        // 낮은 temperature = 사실에서 덜 벗어남
        options: { temperature: 0.2, num_predict: 320 },
      }),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new Error('로컬 AI(Ollama)에 연결할 수 없어요.');
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    if (res.status === 404) throw new Error(`모델 "${s.model}"이(가) 설치돼 있지 않아요. 터미널에서 ollama pull ${s.model} 을 실행해 주세요.`);
    throw new Error(`로컬 AI 오류 (${res.status}) ${detail.slice(0, 120)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let out = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line) as { message?: { content?: string }; error?: string };
      if (chunk.error) throw new Error(`로컬 AI 오류: ${chunk.error}`);
      out += chunk.message?.content ?? '';
      onToken(out);
    }
  }
  return out;
}
