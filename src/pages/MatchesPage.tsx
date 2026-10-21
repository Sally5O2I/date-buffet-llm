import { Link } from 'react-router-dom';
import { OnlineBadge } from '../components/MatchCard';
import { isMutualLike, messagePermission } from '../domain/social';
import type { Profile } from '../domain/types';
import { useApp } from '../state/AppStore';

function Row({ p, sub, to }: { p: Profile; sub: string; to?: string }) {
  const body = (
    <>
      <img className="avatar sm" src={p.photo} alt="" />
      <div className="grow">
        <b>{p.nickname}</b> <span className="muted">{p.age}세 · {p.region}</span> <OnlineBadge id={p.id} />
        <p className="preview">{sub}</p>
      </div>
      {to && <span aria-hidden="true">›</span>}
    </>
  );
  return to ? (
    <Link className="list-item" to={to} aria-label={`${p.nickname}님과 대화 열기. ${sub}`}>
      {body}
    </Link>
  ) : (
    <div className="list-item">{body}</div>
  );
}

export function MatchesPage() {
  const { me, byId, messages, swipes, unlocks } = useApp();
  if (!me) return null;

  // 대화 중
  const lastByPartner = new Map<string, (typeof messages)[number]>();
  for (const m of messages) {
    const partner = m.from === me.id ? m.to : m.from;
    const prev = lastByPartner.get(partner);
    if (!prev || prev.at < m.at) lastByPartner.set(partner, m);
  }
  const conversations = [...lastByPartner.entries()]
    .sort((a, b) => b[1].at - a[1].at)
    .map(([id, m]) => ({ p: byId.get(id), m }))
    .filter((x): x is { p: Profile; m: (typeof messages)[number] } => !!x.p);

  const talking = new Set(lastByPartner.keys());
  const myLikes = swipes.filter((s) => s.from === me.id && s.liked).map((s) => s.to);
  const mutual = myLikes.filter((id) => isMutualLike(swipes, me.id, id) && !talking.has(id));
  const pending = myLikes.filter((id) => !isMutualLike(swipes, me.id, id));
  const gameWins = unlocks.filter((u) => u.from === me.id && !talking.has(u.to)).map((u) => u.to);

  const profilesOf = (ids: string[]) => ids.map((id) => byId.get(id)).filter((p): p is Profile => !!p);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>매칭·대화</h1>
          <p>서로 좋아요를 누르거나, 게임에서 이기면 메시지를 보낼 수 있어요.</p>
        </div>
      </div>

      <section aria-labelledby="h-conv">
        <h2 id="h-conv" className="section-title">💬 대화 중 ({conversations.length})</h2>
        {conversations.length === 0 ? (
          <p className="muted">아직 대화가 없어요.</p>
        ) : (
          <div className="list">
            {conversations.map(({ p, m }) => (
              <Row key={p.id} p={p} to={`/chat/${p.id}`} sub={`${m.from === me.id ? '나: ' : ''}${m.text}`} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="h-mutual">
        <h2 id="h-mutual" className="section-title">💞 서로 좋아요 ({mutual.length})</h2>
        {mutual.length === 0 ? (
          <p className="muted">
            아직 없어요. <Link to="/discover">둘러보기</Link>나 <Link to="/recommend">추천</Link>에서 좋아요를 눌러보세요.
          </p>
        ) : (
          <div className="list">
            {profilesOf(mutual).map((p) => (
              <Row key={p.id} p={p} to={`/chat/${p.id}`} sub="매칭됐어요! 첫 메시지를 보내보세요." />
            ))}
          </div>
        )}
      </section>

      {gameWins.length > 0 && (
        <section aria-labelledby="h-game">
          <h2 id="h-game" className="section-title">🎲 게임 승리로 대화 가능 ({gameWins.length})</h2>
          <div className="list">
            {profilesOf(gameWins).map((p) => (
              <Row key={p.id} p={p} to={`/chat/${p.id}`} sub="게임에서 이겼어요. 메시지를 보낼 수 있어요." />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="h-pending">
        <h2 id="h-pending" className="section-title">⏳ 내가 좋아요 보낸 사람 ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="muted">없어요.</p>
        ) : (
          <div className="list">
            {profilesOf(pending).map((p) => {
              const perm = messagePermission(me.id, p.id, { swipes, unlocks, messages });
              return (
                <Row
                  key={p.id}
                  p={p}
                  to={perm.allowed ? `/chat/${p.id}` : undefined}
                  sub={perm.allowed ? '메시지를 보낼 수 있어요.' : '상대의 응답을 기다리는 중 · 접속 중이면 게임을 걸어볼 수 있어요.'}
                />
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
