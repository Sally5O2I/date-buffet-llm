import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bodyLine, GENDER_LABEL } from '../domain/constants';
import type { Candidate } from '../domain/matching';
import { messagePermission, swipeOf } from '../domain/social';
import { useApp } from '../state/AppStore';
import { AiExplain } from './AiExplain';
import { ScoreBars } from './ScoreBars';
import { openGameInvite } from './GameLayer';

export function OnlineBadge({ id }: { id: string }) {
  const { isOnline } = useApp();
  if (!isOnline(id)) return null;
  return (
    <span className="online-label">
      <span className="online-dot" aria-hidden="true" />
      접속 중
    </span>
  );
}

export function MatchCard({ candidate, highlight }: { candidate: Candidate; highlight?: boolean }) {
  const { profile: p, explanation: e, rank } = candidate;
  const { me, swipes, unlocks, messages, swipe, isOnline, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const detailId = useId();
  if (!me) return null;

  const liked = swipeOf(swipes, me.id, p.id)?.liked;
  const perm = messagePermission(me.id, p.id, { swipes, unlocks, messages });
  const total = Math.round(e.total);

  async function like() {
    const { matched } = await swipe(p, true);
    showToast(matched ? `🎉 ${p.nickname}님과 서로 좋아요! 이제 메시지를 보낼 수 있어요.` : `${p.nickname}님에게 좋아요를 보냈어요.`);
  }

  return (
    <article className={`card match-card ${highlight ? 'top' : ''}`} aria-labelledby={`${detailId}-name`}>
      <div className="mc-head">
        <img className="avatar" src={p.photo} alt={`${p.nickname}님의 프로필 사진`} />
        <div className="mc-title">
          <span className="rank">{rank}위</span>
          <h3 id={`${detailId}-name`}>
            {p.nickname} <OnlineBadge id={p.id} />
          </h3>
          <p className="meta">
            {p.age}세 · {GENDER_LABEL[p.gender]} · {p.region}
            {p.job && ` · ${p.job}`}
            {bodyLine(p) && (
              <>
                <br />
                {bodyLine(p)}
              </>
            )}
          </p>
        </div>
        <div className="score-ring" style={{ ['--p' as string]: total }} aria-label={`총점 ${total}점`} role="img">
          <span>{total}</span>
        </div>
      </div>

      <p>{p.bio}</p>

      <div>
        <p className="muted" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>이 사람이 추천된 이유</p>
        <ul className="reasons">
          {e.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>

      <AiExplain me={me} other={p} explanation={e} canMessage={perm.allowed} />

      <button
        type="button"
        className="btn btn-sky btn-sm"
        aria-expanded={open}
        aria-controls={`${detailId}-detail`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '점수 자세히 접기 ▲' : '점수 자세히 보기 ▼'}
      </button>
      <div id={`${detailId}-detail`} hidden={!open}>
        {open && <ScoreBars explanation={e} otherName={p.nickname} />}
      </div>

      <div className="mc-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={like} disabled={liked}>
          {liked ? '♥ 좋아요 보냄' : '♥ 좋아요'}
        </button>
        {perm.allowed ? (
          <button type="button" className="btn btn-sm" onClick={() => navigate(`/chat/${p.id}`)}>
            💬 메시지
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm"
            disabled={!isOnline(p.id)}
            onClick={() => openGameInvite(p.id)}
            title={isOnline(p.id) ? '이기면 바로 메시지를 보낼 수 있어요' : '상대가 접속 중일 때만 게임을 걸 수 있어요'}
          >
            🎲 게임 걸기
          </button>
        )}
      </div>
    </article>
  );
}
