/**
 * Date Buffet 로고: 접시 위의 하트 + 양옆 포크·나이프.
 * public/favicon.svg 와 같은 그림이다 (바꿀 때 둘 다 고칠 것).
 */
export const BRAND_NAME = 'Date Buffet';

export function BrandIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="15" fill="#FBE9D7" />
      {/* 포크 */}
      <g fill="#7A1F3D">
        <rect x="5" y="13" width="1.8" height="10" rx="0.9" />
        <rect x="8" y="13" width="1.8" height="10" rx="0.9" />
        <rect x="11" y="13" width="1.8" height="10" rx="0.9" />
        <rect x="5" y="21.5" width="7.8" height="3.5" rx="1.75" />
        <rect x="7.8" y="24" width="2.2" height="27" rx="1.1" />
      </g>
      {/* 나이프 */}
      <g fill="#7A1F3D">
        <path d="M55.5 13c3.6 2.2 4.6 8.6 4.6 14.5v1.5h-4.6z" />
        <rect x="55.5" y="28" width="2.4" height="23" rx="1.2" />
      </g>
      {/* 접시 */}
      <circle cx="32" cy="32" r="19.5" fill="#7A1F3D" />
      <circle cx="32" cy="32" r="14" fill="none" stroke="#FBE9D7" strokeWidth="2.2" />
      {/* 하트 */}
      <path
        d="M32 40.2c-.35 0-.7-.12-.98-.35-4.3-3.5-7.32-5.98-7.32-9.6 0-2.6 2.02-4.65 4.55-4.65 1.55 0 2.9.75 3.75 1.95.85-1.2 2.2-1.95 3.75-1.95 2.53 0 4.55 2.05 4.55 4.65 0 3.62-3.02 6.1-7.32 9.6-.28.23-.63.35-.98.35z"
        fill="#FBE9D7"
      />
    </svg>
  );
}
