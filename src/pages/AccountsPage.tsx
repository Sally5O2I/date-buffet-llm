import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AiSettingsSection } from '../components/AiSettingsSection';
import { GENDER_LABEL } from '../domain/constants';
import { repo } from '../repository';
import { useApp } from '../state/AppStore';

type Confirm = null | 'logout' | 'delete' | 'reset';

const CONFIRM_TEXT: Record<Exclude<Confirm, null>, string> = {
  logout: '로그아웃할까요?',
  delete: '내 계정과 프로필·좋아요·메시지·게임 기록을 모두 삭제할까요? 되돌릴 수 없어요.',
  reset: '이 브라우저의 모든 테스트 계정과 기록을 지울까요?',
};

export function AccountsPage() {
  const { me, username, mode, signOut, deleteAccount, showToast } = useApp();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#ai') document.getElementById('ai')?.scrollIntoView({ block: 'start' });
  }, [hash]);
  const [busy, setBusy] = useState(false);

  async function run(kind: Exclude<Confirm, null>) {
    setBusy(true);
    try {
      if (kind === 'logout') await signOut();
      if (kind === 'delete') await deleteAccount();
      if (kind === 'reset') {
        await repo.reset();
        await signOut();
      }
      showToast(kind === 'logout' ? '로그아웃했어요.' : '삭제했어요.');
      navigate('/', { replace: true });
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>계정</h1>
          <p>로그인한 아이디: <b>{username}</b></p>
        </div>
      </div>

      <section className="card section" aria-labelledby="h-acc">
        <h2 id="h-acc">내 프로필</h2>
        {me ? (
          <div className="list" style={{ marginTop: 12 }}>
            <div className="list-item">
              <img className="avatar sm" src={me.photo} alt="" />
              <div className="grow">
                <b>{me.nickname}</b> <span className="muted">{me.age}세 · {GENDER_LABEL[me.gender]} · {me.region}</span>
              </div>
              <Link to="/profile" className="btn btn-sm btn-sky">수정</Link>
            </div>
          </div>
        ) : (
          <>
            <p className="muted" style={{ margin: '8px 0 12px' }}>아직 프로필이 없어요.</p>
            <Link to="/profile" className="btn btn-primary">프로필 만들기</Link>
          </>
        )}
        <p className="notice sky" style={{ marginTop: 16 }}>
          {mode === 'local' ? (
            <>
              두 사람 사이의 매칭·메시지·게임을 테스트하려면 <b>새 탭</b>을 열어 다른 아이디로 가입·로그인하세요. 탭마다 로그인이 따로 유지돼요.
            </>
          ) : (
            <>
              다른 사람과 매칭을 테스트하려면 <b>시크릿 창</b>, <b>다른 브라우저</b>, 또는 <b>휴대폰</b>으로 접속해 다른 아이디로 가입하세요.
            </>
          )}
        </p>
      </section>

      <AiSettingsSection />

      <section className="card section" aria-labelledby="h-danger">
        <h2 id="h-danger">로그아웃 · 삭제</h2>
        <p className="hint">로그아웃해도 프로필은 남아 있어요. 같은 아이디로 다시 로그인하면 이어서 쓸 수 있어요.</p>
        {confirm ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={confirm === 'logout' ? '' : 'error'}>{CONFIRM_TEXT[confirm]}</span>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(confirm)}>
              네
            </button>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setConfirm(null)}>취소</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => setConfirm('logout')}>로그아웃</button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirm('delete')}>계정 삭제</button>
            {mode === 'local' && (
              <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirm('reset')}>
                이 브라우저 테스트 데이터 전체 초기화
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
