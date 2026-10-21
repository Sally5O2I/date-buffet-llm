/**
 * 가상 인물용 일러스트 아바타(SVG). 실존 인물 사진은 쓰지 않는다.
 */
const BACKGROUNDS: [string, string][] = [
  ['#8EC5E8', '#DCEFFA'],
  ['#C98BA1', '#F3DDE5'],
  ['#A9A675', '#E9E7CF'],
  ['#9FB8D9', '#E3ECF7'],
  ['#D9B48F', '#F6EADC'],
  ['#9CC9B4', '#E2F2EA'],
];
const SKIN = ['#F6D7C3', '#EBC2A3', '#D9A47F', '#B97E5A', '#8D5A3B'];
const HAIR = ['#2B2121', '#4A3426', '#7A5236', '#B08A5B', '#5C5C66', '#7A1F3D'];
const SHIRT = ['#7A1F3D', '#7D7A4E', '#3F6E8F', '#5B4B6B', '#2F5D50', '#A0522D'];

function pick<T>(arr: T[], n: number): T {
  return arr[Math.abs(n) % arr.length];
}

export function makeAvatar(seed: number, gender?: 'male' | 'female' | 'other'): string {
  const s = (k: number) => Math.floor(Math.abs(Math.sin(seed * 9301 + k * 49297)) * 1000);
  const [bg1, bg2] = pick(BACKGROUNDS, s(1));
  const skin = pick(SKIN, s(2));
  const hair = pick(HAIR, s(3));
  const shirt = pick(SHIRT, s(4));
  // 0 짧은 머리, 1 긴 머리, 2 단발, 3 묶은 머리
  const styles = gender === 'male' ? [0, 0, 2] : gender === 'female' ? [1, 2, 3] : [0, 1, 2, 3];
  const style = pick(styles, s(5));
  const glasses = s(6) % 5 === 0;

  const hairShapes = [
    // 짧은 머리
    `<path d="M62 92c0-26 17-42 38-42s38 16 38 42c-6-14-20-20-38-20s-32 6-38 20z" fill="${hair}"/>`,
    // 긴 머리
    `<path d="M58 96c0-30 18-48 42-48s42 18 42 48v52c-8 4-14 4-18 0V98c-8-12-18-16-24-16s-16 4-24 16v50c-4 4-10 4-18 0z" fill="${hair}"/>`,
    // 단발
    `<path d="M58 100c0-30 18-50 42-50s42 20 42 50v24c-6 2-10 0-12-4V100c-10-14-20-18-30-18s-20 4-30 18v20c-2 4-6 6-12 4z" fill="${hair}"/>`,
    // 묶은 머리
    `<circle cx="100" cy="46" r="14" fill="${hair}"/><path d="M62 94c0-26 17-42 38-42s38 16 38 42c-8-16-22-22-38-22s-30 6-38 22z" fill="${hair}"/>`,
  ];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg2}"/><stop offset="1" stop-color="${bg1}"/></linearGradient></defs>
<rect width="200" height="200" fill="url(#g)"/>
<path d="M36 200c4-36 32-56 64-56s60 20 64 56z" fill="${shirt}"/>
<rect x="90" y="124" width="20" height="24" rx="8" fill="${skin}"/>
<ellipse cx="100" cy="98" rx="34" ry="38" fill="${skin}"/>
${hairShapes[style]}
<circle cx="87" cy="100" r="3.4" fill="#2B2121"/><circle cx="113" cy="100" r="3.4" fill="#2B2121"/>
<path d="M89 116c6 6 16 6 22 0" stroke="#7A3B2E" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="80" cy="112" r="5" fill="#E89AA8" opacity=".35"/><circle cx="120" cy="112" r="5" fill="#E89AA8" opacity=".35"/>
${glasses ? '<g fill="none" stroke="#2B2121" stroke-width="2.5"><circle cx="87" cy="100" r="9"/><circle cx="113" cy="100" r="9"/><path d="M96 100h8"/></g>' : ''}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
