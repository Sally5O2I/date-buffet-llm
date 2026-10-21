import { Link, Navigate } from 'react-router-dom';
import { BRAND_NAME, BrandIcon } from '../components/BrandIcon';
import { useApp } from '../state/AppStore';

const FEATURES = [
  { icon: '🤝', title: '서로 맞을 때만 연결', text: '내 조건뿐 아니라 상대의 조건도 통과해야 추천에 떠요.' },
  { icon: '💡', title: '추천 이유를 설명', text: '"관심사 4개 중 3개가 겹쳐요"처럼 왜 잘 맞는지 보여줘요.' },
  { icon: '🎲', title: '게임으로 먼저 말 걸기', text: '마음에 들면 가위바위보·동전 던지기로 대화를 열 수 있어요.' },
];

/** 첫 화면: 시작하기(가입) / 로그인 */
export function LandingPage() {
  const { ready, userId, me } = useApp();
  if (!ready) return null;
  if (userId) return <Navigate to={me ? '/recommend' : '/profile'} replace />;

  return (
    <div className="landing">
      <section className="landing-hero">
        <BrandIcon size={88} className="landing-mark" />
        <h1>{BRAND_NAME}</h1>
        <p className="landing-tagline">
          골라 담는 데이트 뷔페
          <br />
          서로의 조건이 맞을 때만 연결되는 소개팅
        </p>
        <div className="landing-cta">
          <Link to="/signup" className="btn btn-primary btn-lg">시작하기</Link>
          <Link to="/login" className="btn btn-ghost">이미 계정이 있어요 · 로그인</Link>
        </div>
      </section>

      <ul className="landing-features">
        {FEATURES.map((f) => (
          <li key={f.title} className="card">
            <span className="landing-icon" aria-hidden="true">{f.icon}</span>
            <div>
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="landing-note">과제용 테스트 서비스예요. 가상 인물 50명이 함께 들어 있어요.</p>
    </div>
  );
}
