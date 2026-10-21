import { useState } from 'react';
import { checkOllama, DEFAULT_AI, loadAiSettings, saveAiSettings, type OllamaStatus } from '../services/llm';

/** 계정 화면의 "AI 설명 (로컬 Ollama)" 설정 */
export function AiSettingsSection() {
  const [s, setS] = useState(loadAiSettings);
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const origin = typeof location !== 'undefined' ? location.origin : '';

  async function test() {
    saveAiSettings(s);
    setChecking(true);
    setStatus(await checkOllama(s));
    setChecking(false);
  }

  return (
    <section className="card section" id="ai" aria-labelledby="h-ai">
      <h2 id="h-ai">🤖 AI 설명 (로컬 Ollama)</h2>
      <p className="hint">
        추천 카드의 "AI 설명 보기"는 <b>이 컴퓨터에서 실행 중인 Ollama</b>에게 설명을 부탁해요. 프로필이 외부 회사로 전송되지 않고,
        API 키도 필요 없어요. Ollama가 꺼져 있으면 기존 설명만 보여요.
      </p>

      <div className="row">
        <div className="field">
          <label htmlFor="ai-url">Ollama 주소</label>
          <input id="ai-url" className="input" value={s.baseUrl} onChange={(e) => setS({ ...s, baseUrl: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="ai-model">모델</label>
          <input id="ai-model" className="input" value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} />
        </div>
      </div>
      <p className="sub muted" style={{ fontSize: '0.8rem', marginTop: -8, marginBottom: 12 }}>
        개인 정보가 담긴 페르소나 모델 대신 기본 모델(<code>qwen2.5:3b</code>)을 권장해요.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={test} disabled={checking}>
          {checking ? '확인 중…' : '저장하고 연결 확인'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setS(DEFAULT_AI); saveAiSettings(DEFAULT_AI); setStatus(null); }}>
          기본값으로
        </button>
      </div>

      {status && (
        <div className={`notice ${status.ok && status.hasModel ? 'sky' : ''}`} style={{ marginTop: 12 }} role="status">
          {status.ok ? (
            status.hasModel ? (
              <>✅ 연결됐어요 (Ollama v{status.version}). 모델 <b>{s.model}</b> 사용 가능.</>
            ) : (
              <>
                ⚠️ Ollama는 켜져 있지만 <b>{s.model}</b> 모델이 없어요. 설치된 모델: {status.models.join(', ') || '없음'}
                <br />터미널에서 <code>ollama pull {s.model}</code> 을 실행해 주세요.
              </>
            )
          ) : (
            <>❌ {status.reason}</>
          )}
        </div>
      )}

      <details style={{ marginTop: 12 }}>
        <summary>연결이 안 될 때 (OLLAMA_ORIGINS 설정)</summary>
        <ol className="muted" style={{ fontSize: '0.9rem', paddingLeft: 20 }}>
          <li>Ollama가 실행 중인지 확인 (작업 표시줄 트레이 아이콘)</li>
          <li>
            이 사이트({origin})에서 Ollama를 부를 수 있도록 허용: PowerShell에서
            <pre className="code">setx OLLAMA_ORIGINS "{origin}"</pre>
            실행 후 Ollama를 완전히 종료했다가 다시 켜기
          </li>
          <li>브라우저가 "로컬 네트워크 접근 허용"을 물으면 허용</li>
        </ol>
      </details>
    </section>
  );
}
