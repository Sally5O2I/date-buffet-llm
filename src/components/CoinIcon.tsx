import type { CoinSide } from '../domain/types';

/**
 * 동전 그림 (SVG). 🪙 이모지는 Windows 10 등 일부 환경에서 네모(□)로 보여서 직접 그린다.
 * side: 'heads' = 앞면(♥), 'tails' = 뒷면(★), undefined = 물음표
 */
export function CoinIcon({ side, size = 40, className }: { side?: CoinSide; size?: number; className?: string }) {
  const mark = side === 'heads' ? '♥' : side === 'tails' ? '★' : '?';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <defs>
        <radialGradient id="coin-face" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fbefb8" />
          <stop offset="0.55" stopColor="#e2c564" />
          <stop offset="1" stopColor="#b8952f" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="34" r="28" fill="#8c6d1f" />
      <circle cx="32" cy="31" r="28" fill="url(#coin-face)" />
      <circle cx="32" cy="31" r="21" fill="none" stroke="#a8862a" strokeWidth="2" strokeDasharray="3 3" />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="22"
        fontWeight="900"
        fill="#6b5212"
        fontFamily="system-ui, sans-serif"
      >
        {mark}
      </text>
    </svg>
  );
}
