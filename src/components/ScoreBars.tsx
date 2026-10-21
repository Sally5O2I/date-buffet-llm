import type { Explanation } from '../domain/matching';

function Bar({ label, value, tone }: { label: string; value: number; tone?: 'theirs' }) {
  return (
    <div className="bar-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <div className={`bar-fill ${tone ?? ''}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/**
 * 양쪽 점수 비교 + 항목별 막대.
 * 항목 원점수는 양쪽이 같고(대칭), 중요 항목 가중치만 달라서 '기여 점수'가 달라진다.
 */
export function ScoreBars({ explanation, otherName }: { explanation: Explanation; otherName: string }) {
  const e = explanation;
  return (
    <div className="detail">
      <div className="bars">
        <div className="bar-row">
          <div className="bar-label"><b>내가 본 점수</b><span>{Math.round(e.myScore)}점</span></div>
          <Bar label="내가 본 점수" value={e.myScore} />
        </div>
        <div className="bar-row">
          <div className="bar-label"><b>{otherName}님이 본 점수</b><span>{Math.round(e.theirScore)}점</span></div>
          <Bar label={`${otherName}님이 본 점수`} value={e.theirScore} tone="theirs" />
        </div>
        <p className="bar-reason">
          총점 {Math.round(e.total)}점 = √({Math.round(e.myScore)} × {Math.round(e.theirScore)}) — 한쪽만 높으면 총점이 낮아져요.
        </p>
      </div>

      <h4 className="sr-only">항목별 점수</h4>
      <div className="bars">
        {e.items.map((it, idx) => {
          const theirs = e.theirItems[idx];
          return (
            <div className="bar-row" key={it.item}>
              <div className="bar-label">
                <span>
                  <b>{it.label}</b>{' '}
                  {it.weight > 1 && <span className="w">내 중요 ×2</span>}{' '}
                  {theirs.weight > 1 && <span className="w" style={{ color: 'var(--sky-strong)' }}>상대 중요 ×2</span>}
                </span>
                <span>{it.score}점</span>
              </div>
              <Bar label={`${it.label} ${it.score}점`} value={it.score} />
              <p className="bar-reason">
                {it.reason} · 내 점수에 +{Math.round(it.points)}, 상대 점수에 +{Math.round(theirs.points)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
