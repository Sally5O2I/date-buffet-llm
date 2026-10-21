import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { OnlineBadge } from '../components/MatchCard';
import { openGameInvite } from '../components/GameLayer';
import { bodyLine, GENDER_LABEL, SMOKING_LABEL, DRINKING_LABELS } from '../domain/constants';
import { combineScores, directionalScore, mutualRejections } from '../domain/matching';
import type { Profile } from '../domain/types';
import { useApp } from '../state/AppStore';

const THRESHOLD = 100;

interface DeckItem {
  profile: Profile;
  score: number;
  /** 성별 외 조건(나이·지역·흡연)까지 모두 통과했는지 */
  fullMatch: boolean;
}

export function DiscoverPage() {
  const { me, profiles, swipes, swipe, showToast, isOnline } = useApp();
  const [relaxed, setRelaxed] = useState(false);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<null | 'like' | 'nope'>(null);
  const start = useRef<{ x: number; id: number } | null>(null);
  const busy = useRef(false);

  const deck: DeckItem[] = useMemo(() => {
    if (!me) return [];
    const swiped = new Set(swipes.filter((s) => s.from === me.id).map((s) => s.to));
    return profiles
      .filter((p) => p.id !== me.id && !swiped.has(p.id))
      .map((p) => {
        const rej = mutualRejections(me, p);
        // 성별 조건은 둘러보기에서도 절대 완화하지 않는다
        if (rej.some((r) => r.code === 'gender')) return null;
        if (rej.length > 0 && !relaxed) return null;
        const score = combineScores(directionalScore(me, p).score, directionalScore(p, me).score);
        return { profile: p, score, fullMatch: rej.length === 0 };
      })
      .filter((x): x is DeckItem => !!x)
      .sort((a, b) => Number(b.fullMatch) - Number(a.fullMatch) || b.score - a.score);
  }, [me, profiles, swipes, relaxed]);

  const top = deck[0];

  const decide = useCallback(
    async (liked: boolean) => {
      if (!top || busy.current) return;
      busy.current = true;
      setLeaving(liked ? 'like' : 'nope');
      setDx(liked ? 600 : -600);
      await new Promise((r) => setTimeout(r, 220));
      const { matched } = await swipe(top.profile, liked);
      if (matched) showToast(`🎉 ${top.profile.nickname}님과 서로 좋아요! 매칭·대화에서 메시지를 보내보세요.`);
      setDx(0);
      setLeaving(null);
      busy.current = false;
    },
    [top, swipe, showToast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [role="dialog"]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); decide(true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); decide(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide]);

  if (!me) return null;

  const rot = dx / 20;
  const likeOpacity = Math.max(0, Math.min(1, dx / THRESHOLD));
  const nopeOpacity = Math.max(0, Math.min(1, -dx / THRESHOLD));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>둘러보기</h1>
          <p>오른쪽으로 넘기면 <b>마음에 들어요</b>, 왼쪽으로 넘기면 <b>별로예요</b>. 서로 좋아요면 매칭돼요.</p>
        </div>
        <span className="spacer" />
        <label className="toggle">
          <input type="checkbox" checked={relaxed} onChange={(e) => setRelaxed(e.target.checked)} />
          조건 밖 사람도 보기 (성별 조건은 항상 지켜요)
        </label>
      </div>

      <div className="deck-wrap">
        {!top ? (
          <div className="card empty">
            <div className="big" aria-hidden="true">🌙</div>
            <h2>지금은 더 볼 사람이 없어요</h2>
            <p className="muted">
              {relaxed ? '모두 확인했어요. 새 가입자를 기다려 주세요.' : '"조건 밖 사람도 보기"를 켜면 더 볼 수 있어요.'}
            </p>
            <Link to="/matches" className="btn btn-primary">매칭·대화 보기</Link>
          </div>
        ) : (
          <>
            <div className="deck" aria-live="polite">
              {deck[1] && (
                <div className="swipe-card behind" aria-hidden="true">
                  <img className="photo" src={deck[1].profile.photo} alt="" />
                </div>
              )}
              <div
                key={top.profile.id}
                className="swipe-card"
                style={{
                  transform: `translateX(${dx}px) rotate(${rot}deg)`,
                  transition: start.current && !leaving ? 'none' : 'transform 0.22s ease',
                }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  start.current = { x: e.clientX, id: e.pointerId };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (start.current?.id === e.pointerId) setDx(e.clientX - start.current.x);
                }}
                onPointerUp={() => {
                  if (!start.current) return;
                  start.current = null;
                  if (dx > THRESHOLD) decide(true);
                  else if (dx < -THRESHOLD) decide(false);
                  else setDx(0);
                }}
                onPointerCancel={() => {
                  start.current = null;
                  setDx(0);
                }}
              >
                <div className="photo-wrap">
                  <img className="photo" src={top.profile.photo} alt={`${top.profile.nickname}님의 프로필 사진`} draggable={false} />
                  {/* 왼쪽으로 밀수록 얼굴 위에 반투명 X가 진해진다 */}
                  <svg
                    className="nope-x"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="xMidYMid meet"
                    aria-hidden="true"
                    style={{ opacity: (leaving === 'nope' ? 1 : nopeOpacity) * 0.6 }}
                  >
                    <path d="M22 22 L78 78 M78 22 L22 78" />
                  </svg>
                  {/* 오른쪽으로 밀수록 얼굴 위에 반투명 O가 진해진다 */}
                  <svg
                    className="like-o"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="xMidYMid meet"
                    aria-hidden="true"
                    style={{ opacity: (leaving === 'like' ? 1 : likeOpacity) * 0.6 }}
                  >
                    <circle cx="50" cy="50" r="30" />
                  </svg>
                </div>
                <span className="swipe-stamp like" style={{ opacity: leaving === 'like' ? 1 : likeOpacity }} aria-hidden="true">LIKE</span>
                <span className="swipe-stamp nope" style={{ opacity: leaving === 'nope' ? 1 : nopeOpacity }} aria-hidden="true">NOPE</span>
                <div className="info">
                  <h2 style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {top.profile.nickname}, {top.profile.age}
                    <OnlineBadge id={top.profile.id} />
                  </h2>
                  <p className="muted" style={{ fontSize: '0.9rem' }}>
                    {GENDER_LABEL[top.profile.gender]} · {top.profile.region}
                    {top.profile.job && ` · ${top.profile.job}`} · {SMOKING_LABEL[top.profile.smoking]} · 음주 {DRINKING_LABELS[top.profile.drinking]}
                    {bodyLine(top.profile) && (
                      <>
                        <br />
                        {bodyLine(top.profile)}
                      </>
                    )}
                  </p>
                  <p>{top.profile.bio}</p>
                  <div className="tags">
                    <span className={`tag ${top.fullMatch ? 'burgundy' : ''}`}>
                      {top.fullMatch ? `궁합 ${Math.round(top.score)}점` : `조건 밖 · 참고 ${Math.round(top.score)}점`}
                    </span>
                    {top.profile.interests.map((i) => (
                      <span className="tag sky" key={i}>{i}</span>
                    ))}
                    {top.profile.personality.map((i) => (
                      <span className="tag" key={i}>{i}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="deck-buttons">
              <button type="button" className="round-btn nope" onClick={() => decide(false)} aria-label={`${top.profile.nickname}님 별로예요 (왼쪽)`}>
                ✕
              </button>
              <button
                type="button"
                className="round-btn"
                onClick={() => openGameInvite(top.profile.id)}
                disabled={!isOnline(top.profile.id)}
                aria-label={`${top.profile.nickname}님에게 게임 걸기`}
                title={isOnline(top.profile.id) ? '게임에서 이기면 바로 메시지 가능' : '접속 중인 사람에게만 걸 수 있어요'}
                style={{ fontSize: '1.3rem', opacity: isOnline(top.profile.id) ? 1 : 0.4 }}
              >
                🎲
              </button>
              <button type="button" className="round-btn like" onClick={() => decide(true)} aria-label={`${top.profile.nickname}님 마음에 들어요 (오른쪽)`}>
                ♥
              </button>
            </div>
            <p className="kbd-hint">
              키보드: <kbd>←</kbd> 별로예요 · <kbd>→</kbd> 마음에 들어요 · 남은 사람 {deck.length}명
            </p>
          </>
        )}
      </div>
    </>
  );
}
