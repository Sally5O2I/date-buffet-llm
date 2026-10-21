import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { OnlineBadge } from '../components/MatchCard';
import { openGameInvite } from '../components/GameLayer';
import { messagePermission } from '../domain/social';
import { useApp } from '../state/AppStore';

const REASON_TEXT = {
  mutual: '서로 좋아요로 매칭된 대화예요.',
  'game-win': '게임에서 이겨서 열린 대화예요.',
  reply: '상대가 먼저 메시지를 보냈어요.',
} as const;

export function ChatPage() {
  const { id } = useParams();
  const { me, byId, messages, swipes, unlocks, sendMessage, isOnline } = useApp();
  // AI 설명의 "이 메시지로 대화 시작"을 누르면 ?draft= 로 첫 메시지가 미리 채워진다 (보내기 전 수정 가능)
  const location = useLocation();
  const [text, setText] = useState(() => (new URLSearchParams(location.search).get('draft') ?? '').slice(0, 300));
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const other = id ? byId.get(id) : undefined;

  const thread = me && other
    ? messages
        .filter((m) => (m.from === me.id && m.to === other.id) || (m.from === other.id && m.to === me.id))
        .sort((a, b) => a.at - b.at)
    : [];

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [thread.length]);

  if (!me) return null;
  if (!other) {
    return (
      <div className="card empty">
        <h2>대화 상대를 찾을 수 없어요</h2>
        <Link to="/matches" className="btn">돌아가기</Link>
      </div>
    );
  }

  const perm = messagePermission(me.id, other.id, { swipes, unlocks, messages });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await sendMessage(other!, text);
      setText('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card chat" aria-label={`${other.nickname}님과의 대화`}>
      <div className="chat-head">
        <Link to="/matches" className="btn btn-ghost btn-icon" aria-label="대화 목록으로">‹</Link>
        <img className="avatar sm" src={other.photo} alt="" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.05rem' }}>{other.nickname}</h1>
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            {other.age}세 · {other.region} <OnlineBadge id={other.id} />
          </p>
        </div>
      </div>

      <div className="chat-body" ref={bodyRef} role="log" aria-live="polite" aria-label="메시지">
        {perm.allowed && <p className="notice sky" style={{ alignSelf: 'center' }}>{REASON_TEXT[perm.reason]}</p>}
        {thread.length === 0 && perm.allowed && <p className="muted" style={{ textAlign: 'center' }}>첫 메시지를 보내보세요 👋</p>}
        {thread.map((m) => (
          <div key={m.id} className={`bubble ${m.from === me.id ? 'me' : 'them'}`}>
            <span className="sr-only">{m.from === me.id ? '나' : other.nickname}: </span>
            {m.text}
            <time dateTime={new Date(m.at).toISOString()}>
              {new Date(m.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
        ))}
      </div>

      {perm.allowed ? (
        <form className="chat-form" onSubmit={onSubmit}>
          <label htmlFor="msg" className="sr-only">메시지 입력</label>
          <input
            id="msg"
            className="input"
            value={text}
            maxLength={300}
            autoComplete="off"
            placeholder="메시지 입력 (연락처 공유는 막혀 있어요)"
            aria-invalid={!!error}
            aria-describedby={error ? 'msg-err' : undefined}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={!text.trim()}>보내기</button>
        </form>
      ) : (
        <div className="chat-form" style={{ flexDirection: 'column' }}>
          <p className="notice">
            아직 메시지를 보낼 수 없어요. 서로 좋아요가 되거나, 게임에서 이기면 대화가 열려요.
          </p>
          <button type="button" className="btn btn-primary" disabled={!isOnline(other.id)} onClick={() => openGameInvite(other.id)}>
            🎲 게임 걸기 {isOnline(other.id) ? '' : '(상대 미접속)'}
          </button>
        </div>
      )}
      {error && <p id="msg-err" className="error" role="alert" style={{ padding: '0 12px 12px' }}>{error}</p>}
    </section>
  );
}
