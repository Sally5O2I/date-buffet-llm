interface ChipsProps<T extends string> {
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
  max?: number;
  labelledBy: string;
  invalid?: boolean;
}

/** 복수 선택 칩 (토글 버튼 그룹). 키보드 Tab/Space/Enter로 조작 가능 */
export function Chips<T extends string>({ options, selected, onChange, max, labelledBy, invalid }: ChipsProps<T>) {
  const full = max !== undefined && selected.length >= max;
  return (
    <div className="chips" role="group" aria-labelledby={labelledBy} aria-invalid={invalid || undefined}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className="chip"
            aria-pressed={on}
            disabled={!on && full}
            onClick={() => onChange(on ? selected.filter((x) => x !== o.value) : [...selected, o.value])}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 단일 선택 칩 (라디오 그룹) */
export function RadioChips<T extends string | number>({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  labelledBy: string;
}) {
  return (
    <div className="chips" role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            className="chip"
            aria-checked={on}
            tabIndex={on || (value === undefined && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (!dir) return;
              e.preventDefault();
              const next = options[(i + dir + options.length) % options.length];
              onChange(next.value);
              const group = e.currentTarget.parentElement;
              requestAnimationFrame(() => (group?.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus());
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
