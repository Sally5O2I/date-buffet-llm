import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { recommend, type RecommendResult, type RejectCode, type Suggestion } from '../domain/matching';
import { useApp } from '../state/AppStore';

const CODE_LABEL: Record<RejectCode, string> = {
  gender: '성별',
  age: '나이',
  height: '키',
  body: '체형',
  region: '지역',
  smoking: '흡연',
};

function RejectionSummary({ r }: { r: RecommendResult }) {
  const codes = Object.keys(r.rejectionCounts) as RejectCode[];
  const mine = codes.filter((c) => r.rejectionCounts[c].mine > 0);
  const theirs = codes.filter((c) => r.rejectionCounts[c].theirs > 0);
  return (
    <ul>
      {mine.length > 0 && (
        <li>
          <b>내 조건</b> 때문에 제외: {mine.map((c) => `${CODE_LABEL[c]} ${r.rejectionCounts[c].mine}명`).join(', ')}
        </li>
      )}
      {theirs.length > 0 && (
        <li>
          <b>상대 조건</b>에 내가 맞지 않아 제외: {theirs.map((c) => `${CODE_LABEL[c]} ${r.rejectionCounts[c].theirs}명`).join(', ')}
        </li>
      )}
      <li>한 사람이 여러 이유로 제외될 수 있어요. (전체 {r.considered}명 검토)</li>
    </ul>
  );
}

export function RecommendPage() {
  const { me, profiles, swipes, settings, setSettings, saveMyProfile, showToast } = useApp();

  const disliked = useMemo(
    () => (me ? swipes.filter((s) => s.from === me.id && !s.liked).map((s) => s.to) : []),
    [swipes, me],
  );
  const result = useMemo(
    () =>
      me
        ? recommend(me, profiles, {
            topN: 10,
            excludeIds: disliked,
            exposureCap: settings.exposureCapOn ? settings.exposureCap : undefined,
          })
        : null,
    [me, profiles, disliked, settings.exposureCapOn, settings.exposureCap],
  );
  if (!me || !result) return null;

  async function apply(s: Suggestion) {
    await saveMyProfile({ ...me!, preference: { ...me!.preference, ...s.patch } });
    showToast('조건을 바꿨어요. 추천을 다시 계산했어요.');
  }

  const top5 = result.candidates.slice(0, 5);
  const rest = result.candidates.slice(5);

  return (
    <>
      <div className="hero">
        <h1>{me.nickname}님과 서로 잘 맞는 사람</h1>
        <p>
          {result.considered}명 중 서로의 조건을 모두 통과한 {result.eligible}명을 점수로 정렬했어요.
          총점은 <b>내가 본 점수</b>와 <b>상대가 본 점수</b>의 기하평균이에요.
        </p>
        <label className="toggle" style={{ marginTop: 6 }}>
          <input
            type="checkbox"
            checked={settings.exposureCapOn}
            onChange={(e) => setSettings({ exposureCapOn: e.target.checked })}
          />
          인기 쏠림 완화 (한 사람이 TOP 10에 최대 {settings.exposureCap}번만 노출)
        </label>
      </div>

      {result.candidates.length === 0 ? (
        <section className="card empty" aria-labelledby="empty-title">
          <div className="big" aria-hidden="true">🔍</div>
          <h2 id="empty-title">지금 조건에 맞는 사람이 없어요</h2>
          <RejectionSummary r={result} />
          {result.suggestions.length > 0 ? (
            <>
              <h3>조건을 이렇게 바꿔보세요</h3>
              <div className="suggest-list">
                {result.suggestions.map((s) => (
                  <div className="suggest" key={s.id}>
                    <p>
                      {s.label}
                      <br />
                      <span className="muted">→ {s.gain}명이 생겨요</span>
                    </p>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => apply(s)}>
                      적용
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">
              {settings.exposureCapOn
                ? '노출 상한 때문에 자리가 없을 수 있어요. 위의 "인기 쏠림 완화"를 꺼보세요.'
                : '내 조건을 넓혀도 상대방들의 조건에 맞지 않아요. 가입자가 늘면 달라질 수 있어요.'}
            </p>
          )}
          <Link to="/profile" className="btn">조건 직접 수정하기</Link>
        </section>
      ) : (
        <>
          <h2 className="section-title">
            <span aria-hidden="true">🏆</span> 가장 잘 맞는 TOP {top5.length}
          </h2>
          <div className="grid">
            {top5.map((c) => (
              <MatchCard key={c.profile.id} candidate={c} highlight />
            ))}
          </div>

          {rest.length > 0 && (
            <>
              <h2 className="section-title">
                <span aria-hidden="true">✨</span> 이어서 6~{5 + rest.length}위
              </h2>
              <div className="grid">
                {rest.map((c) => (
                  <MatchCard key={c.profile.id} candidate={c} />
                ))}
              </div>
            </>
          )}

          <div className="notice sky" style={{ marginTop: 24 }}>
            더 많은 사람을 보고 싶다면 <Link to="/discover">둘러보기</Link>에서 넘겨보며 좋아요를 눌러보세요.
            서로 좋아요가 되면 메시지를 보낼 수 있어요.
          </div>
        </>
      )}
    </>
  );
}
