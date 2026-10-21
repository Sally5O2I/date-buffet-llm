import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Steps } from '../components/Steps';
import { PASSWORD_MIN, USERNAME_RULE, validateCredentials } from '../domain/validation';
import { useApp } from '../state/AppStore';

type Field = 'username' | 'password' | 'confirm';

/** 아이디·비밀번호 가입(signup) / 로그인(login) */
export function AuthPage({ kind }: { kind: 'signup' | 'login' }) {
  const { ready, userId, me, mode, signUp, signIn } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = kind === 'signup';

  if (!ready) return null;
  if (userId && !busy) return <Navigate to={me ? '/recommend' : '/profile'} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const id = username.trim().toLowerCase();
    const errs = validateCredentials(id, password, isSignup ? confirm : undefined);
    if (!isSignup) delete errs.password; // 로그인은 형식 대신 일치 여부만 본다
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = (['username', 'password', 'confirm'] as Field[]).find((f) => errs[f]);
      document.getElementById(`auth-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (isSignup) {
        await signUp(id, password);
        navigate('/profile', { replace: true });
      } else {
        const { hasProfile } = await signIn(id, password);
        navigate(hasProfile ? '/recommend' : '/profile', { replace: true });
      }
    } catch (err) {
      setFormError((err as Error).message || '잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  }

  const fieldError = (f: Field) =>
    errors[f] ? (
      <p className="error" id={`auth-${f}-err`} role="alert">
        {errors[f]}
      </p>
    ) : null;

  return (
    <div className="auth-wrap">
      {isSignup && <Steps current={1} />}
      <section className="card section auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title">{isSignup ? '아이디 만들기' : '로그인'}</h1>
        <p className="hint">
          {isSignup ? '간단한 아이디와 비밀번호만 있으면 시작할 수 있어요.' : '가입할 때 만든 아이디와 비밀번호를 입력하세요.'}
        </p>

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="auth-username">아이디</label>
            <input
              id="auth-username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={16}
              placeholder="예) blue_whale"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'auth-username-err' : isSignup ? 'auth-username-hint' : undefined}
            />
            {isSignup && (
              <span id="auth-username-hint" className="sub muted" style={{ fontSize: '0.8rem' }}>{USERNAME_RULE}</span>
            )}
            {fieldError('username')}
          </div>

          <div className="field">
            <label htmlFor="auth-password">비밀번호</label>
            <div className="pw-row">
              <input
                id="auth-password"
                className="input"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                maxLength={64}
                placeholder={isSignup ? `${PASSWORD_MIN}자 이상` : ''}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'auth-password-err' : undefined}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPw((v) => !v)}
                aria-pressed={showPw}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPw ? '숨기기' : '보기'}
              </button>
            </div>
            {fieldError('password')}
          </div>

          {isSignup && (
            <div className="field">
              <label htmlFor="auth-confirm">비밀번호 확인</label>
              <input
                id="auth-confirm"
                className="input"
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                maxLength={64}
                aria-invalid={!!errors.confirm}
                aria-describedby={errors.confirm ? 'auth-confirm-err' : undefined}
              />
              {fieldError('confirm')}
            </div>
          )}

          {formError && (
            <p className="error" role="alert" style={{ marginBottom: 12 }}>
              {formError}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? '잠시만요…' : isSignup ? '다음: 프로필 만들기' : '로그인'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? (
            <>이미 계정이 있나요? <Link to="/login">로그인</Link></>
          ) : (
            <>처음이신가요? <Link to="/signup">시작하기</Link></>
          )}
        </p>
        <p className="auth-note">
          🔒 다른 사이트에서 쓰는 비밀번호는 쓰지 마세요.{' '}
          {mode === 'local'
            ? '지금은 테스트 모드라 계정이 이 브라우저에만 저장돼요.'
            : '비밀번호는 암호화되어 저장돼요.'}
        </p>
      </section>
    </div>
  );
}
