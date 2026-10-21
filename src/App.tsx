import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { GameLayer } from './components/GameLayer';
import { AccountsPage } from './pages/AccountsPage';
import { AuthPage } from './pages/AuthPage';
import { ChatPage } from './pages/ChatPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { LandingPage } from './pages/LandingPage';
import { MatchesPage } from './pages/MatchesPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecommendPage } from './pages/RecommendPage';
import { AppProvider, useApp } from './state/AppStore';

/** 로그인해야 들어갈 수 있는 화면 (프로필 작성 전이어도 됨) */
function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, userId } = useApp();
  if (!ready) return <p className="muted">불러오는 중…</p>;
  if (!userId) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** 로그인 + 프로필까지 있어야 들어갈 수 있는 화면 */
function RequireMe({ children }: { children: ReactNode }) {
  const { ready, userId, me } = useApp();
  if (!ready) return <p className="muted">불러오는 중…</p>;
  if (!userId) return <Navigate to="/" replace />;
  if (!me) return <Navigate to="/profile" replace />;
  return <>{children}</>;
}

export function App() {
  // GitHub Pages는 서버 라우팅이 없어서 새로고침 시 404가 나지 않도록 HashRouter 사용
  // 흐름: 첫 화면(/) → 시작하기(/signup) → 프로필·원하는 상대(/profile) → 추천(/recommend)
  return (
    <AppProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signup" element={<AuthPage kind="signup" />} />
            <Route path="/login" element={<AuthPage kind="login" />} />
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="/accounts" element={<RequireAuth><AccountsPage /></RequireAuth>} />
            <Route path="/recommend" element={<RequireMe><RecommendPage /></RequireMe>} />
            <Route path="/discover" element={<RequireMe><DiscoverPage /></RequireMe>} />
            <Route path="/matches" element={<RequireMe><MatchesPage /></RequireMe>} />
            <Route path="/chat/:id" element={<RequireMe><ChatPage /></RequireMe>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        <GameLayer />
      </HashRouter>
    </AppProvider>
  );
}
