import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../state/AppStore';
import { BRAND_NAME, BrandIcon } from './BrandIcon';

type Theme = 'system' | 'light' | 'dark';
const THEME_KEY = 'bm.theme';

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* 저장 실패해도 현재 탭에는 적용됨 */
    }
  }, [theme]);
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
  const icon = { system: '🖥️', light: '☀️', dark: '🌙' }[theme];
  const label = { system: '시스템 설정', light: '라이트 모드', dark: '다크 모드' }[theme];
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={() => setTheme(next[theme])}
      aria-label={`테마: ${label} (눌러서 변경)`}
      title={`테마: ${label}`}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { me, userId, toast, messages, games } = useApp();
  const location = useLocation();

  // 새 메시지 수 (내가 마지막으로 보낸 이후 상대가 보낸 것) — 간단 표시용
  const unread = useMemo(() => {
    if (!me) return 0;
    const lastSeen = Number(sessionStorage.getItem(`bm.seen.${me.id}`) ?? 0);
    return messages.filter((m) => m.to === me.id && m.at > lastSeen).length;
  }, [messages, me, location.pathname]);
  const pendingGames = me ? games.filter((g) => g.to === me.id && g.status === 'pending').length : 0;

  useEffect(() => {
    if (me && location.pathname.startsWith('/matches')) {
      sessionStorage.setItem(`bm.seen.${me.id}`, String(Date.now()));
    }
  }, [location.pathname, me, messages]);

  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const nav = (
    <nav className="tabbar" aria-label="주요 메뉴">
      <NavLink to="/recommend"><span className="ico" aria-hidden="true">✨</span>추천</NavLink>
      <NavLink to="/discover"><span className="ico" aria-hidden="true">🃏</span>둘러보기</NavLink>
      <NavLink to="/matches">
        <span className="ico" aria-hidden="true">💬</span>매칭·대화
        {unread + pendingGames > 0 && (
          <span className="badge-dot" aria-label={`새 알림 ${unread + pendingGames}개`}>{unread + pendingGames}</span>
        )}
      </NavLink>
      <NavLink to="/profile"><span className="ico" aria-hidden="true">👤</span>내 프로필</NavLink>
    </nav>
  );

  return (
    <>
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <BrandIcon size={32} className="brand-mark" />
            {BRAND_NAME}
          </Link>
          <div className="header-actions">
            {me && <div className="desktop-only">{nav}</div>}
            <ThemeToggle />
            {userId ? (
              <Link to="/accounts" className="btn btn-ghost btn-sm" aria-label="계정">
                {me ? (
                  <img src={me.photo} alt="" className="avatar" style={{ width: 28, height: 28, borderRadius: 9 }} />
                ) : (
                  '계정'
                )}
              </Link>
            ) : (
              location.pathname !== '/login' && (
                <Link to="/login" className="btn btn-ghost btn-sm">로그인</Link>
              )
            )}
          </div>
        </div>
      </header>
      <main id="main" className={`main ${me ? 'with-tabbar' : ''}`} tabIndex={-1}>
        {children}
      </main>
      {me && <div className="mobile-only">{nav}</div>}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}
