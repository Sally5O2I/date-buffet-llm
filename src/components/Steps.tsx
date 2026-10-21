const STEPS = ['아이디 만들기', '프로필 · 원하는 상대', '추천 보기'];

/** 처음 가입할 때 보이는 단계 표시 (1 → 2 → 3) */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="steps" aria-label="가입 단계">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'now' : 'todo';
        return (
          <li key={label} className={`step ${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="step-num" aria-hidden="true">{state === 'done' ? '✓' : n}</span>
            <span className="step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
