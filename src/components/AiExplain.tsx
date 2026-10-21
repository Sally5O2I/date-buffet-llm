import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  buildExplainMessages,
  EXPLAIN_SCHEMA,
  findUnsupportedInterests,
  parseExplainOutput,
  partialSummary,
  rejectReason,
  type ExplainResult,
} from '../domain/explainPrompt';
import type { Explanation } from '../domain/matching';
import type { Profile } from '../domain/types';
import { chatStream, loadAiSettings } from '../services/llm';

/** 같은 쌍을 다시 열면 다시 만들지 않는다 (이 탭에서만 유지) */
const cache = new Map<string, ExplainResult>();

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; text: string; startedAt: number }
  | { kind: 'done'; result: ExplainResult }
  | { kind: 'error'; message: string };

export function AiExplain({
  me,
  other,
  explanation,
  canMessage,
}: {
  me: Profile;
  other: Profile;
  explanation: Explanation;
  canMessage: boolean;
}) {
  const settings = loadAiSettings();
  const key = `${me.id}|${other.id}|${settings.model}`;
  const [state, setState] = useState<State>(() => {
    const hit = cache.get(key);
    return hit ? { kind: 'done', result: hit } : { kind: 'idle' };
  });
  const [, tick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  useEffect(() => () => abortRef.current?.abort(), []);

  // 경과 시간 표시 (작은 모델도 CPU에서는 20초 정도 걸린다)
  useEffect(() => {
    if (state.kind !== 'loading') return;
    const t = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [state.kind]);

  async function run(force = false) {
    if (!force && cache.has(key)) {
      setState({ kind: 'done', result: cache.get(key)! });
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const startedAt = Date.now();
    setState({ kind: 'loading', text: '', startedAt });
    try {
      // 작은 모델은 가끔 예시를 베끼거나 빈 답을 낸다 → 한 번은 자동으로 다시 쓴다
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await chatStream(
          settings,
          buildExplainMessages(me, other, explanation),
          (soFar) => setState((s) => (s.kind === 'loading' ? { ...s, text: partialSummary(soFar) } : s)),
          ctrl.signal,
          EXPLAIN_SCHEMA,
        );
        const result = parseExplainOutput(raw);
        const reason = rejectReason(result);
        if (!reason) {
          cache.set(key, result);
          setState({ kind: 'done', result });
          return;
        }
        if (attempt === 0) setState({ kind: 'loading', text: '', startedAt });
        else throw new Error(`AI가 알맞은 설명을 만들지 못했어요 (${reason}). 다시 시도해 주세요.`);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState({ kind: 'error', message: (err as Error).message });
    }
  }

  if (state.kind === 'idle') {
    return (
      <button type="button" className="btn btn-sm btn-ai" onClick={() => run()}>
        🤖 AI 설명 보기
      </button>
    );
  }

  return (
    <section className="ai-box" aria-live="polite" aria-busy={state.kind === 'loading'}>
      <div className="ai-head">
        <span className="ai-badge">🤖 AI 설명</span>
        <span className="ai-model">
          {settings.model} · {/localhost|127\.0\.0\.1/.test(settings.baseUrl) ? '내 컴퓨터' : '발표자 컴퓨터'}
        </span>
      </div>

      {state.kind === 'loading' && (
        <>
          <p className="ai-text">
            {state.text || 'AI가 두 분의 공통점을 읽고 있어요…'}
            <span className="ai-cursor" aria-hidden="true" />
          </p>
          <div className="ai-actions">
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              작성 중 {Math.round((Date.now() - state.startedAt) / 1000)}초
            </span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { abortRef.current?.abort(); setState({ kind: 'idle' }); }}>
              취소
            </button>
          </div>
        </>
      )}

      {state.kind === 'done' && (
        <DoneView
          result={state.result}
          unsupported={findUnsupportedInterests(`${state.result.summary} ${state.result.icebreaker}`, me, other)}
          onRetry={() => run(true)}
          onUse={canMessage ? () => navigate(`/chat/${other.id}?draft=${encodeURIComponent(state.result.icebreaker)}`) : undefined}
        />
      )}

      {state.kind === 'error' && (
        <>
          <p className="error">{state.message}</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            위의 "이 사람이 추천된 이유"는 AI 없이도 그대로 볼 수 있어요.{' '}
            <Link to="/accounts#ai">AI 연결 설정 보기</Link>
          </p>
          <div className="ai-actions">
            <button type="button" className="btn btn-sm" onClick={() => run(true)}>다시 시도</button>
          </div>
        </>
      )}
    </section>
  );
}

function DoneView({
  result,
  unsupported,
  onRetry,
  onUse,
}: {
  result: ExplainResult;
  unsupported: string[];
  onRetry: () => void;
  onUse?: () => void;
}) {
  return (
    <>
      <p className="ai-text">{result.summary}</p>
      {result.icebreaker && (
        <div className="ai-ice">
          <span className="ai-ice-label">💬 첫 메시지 추천</span>
          <p>{result.icebreaker}</p>
        </div>
      )}
      {unsupported.length > 0 && (
        <p className="ai-warn" role="note">
          ⚠️ 사실 확인 필요: 두 분 프로필에 없는 관심사({unsupported.join(', ')})가 언급됐어요.
        </p>
      )}
      <p className="ai-note">AI가 쓴 문장이라 틀릴 수 있어요. 점수와 순위는 앱의 규칙으로 계산돼요.</p>
      <div className="ai-actions">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onRetry}>↻ 다시 쓰기</button>
        {onUse && result.icebreaker && (
          <button type="button" className="btn btn-sm btn-primary" onClick={onUse}>이 메시지로 대화 시작</button>
        )}
      </div>
    </>
  );
}
