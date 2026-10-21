import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { COIN_LABEL, RPS_LABEL } from '../domain/social';
import type { CoinSide, GameKind, GameSession, RpsMove } from '../domain/types';
import { useApp } from '../state/AppStore';
import { CoinIcon } from './CoinIcon';

const OPEN_EVENT = 'bm:open-game';
const PENDING_TIMEOUT_MS = 60_000;

/** 어디서든 "게임 걸기" 창을 연다 */
export function openGameInvite(targetId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: targetId }));
}

export function Modal({ title, children, onClose, labelId }: { title: ReactNode; children: ReactNode; onClose?: () => void; labelId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('button, [href], input');
    first?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose?.();
        if (e.key === 'Tab' && ref.current) {
          // 포커스가 모달 밖으로 나가지 않게
          const items = [...ref.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input')];
          if (items.length === 0) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelId} ref={ref}>
        <h2 id={labelId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function GameLayer() {
  const { me, byId, games, inviteGame, respondGame, playMove, isOnline, showToast } = useApp();
  const navigate = useNavigate();
  const [inviteTarget, setInviteTarget] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, force] = useState(0);

  useEffect(() => {
    const h = (e: Event) => setInviteTarget((e as CustomEvent<string>).detail);
    window.addEventListener(OPEN_EVENT, h);
    return () => window.removeEventListener(OPEN_EVENT, h);
  }, []);

  // 대기 시간 초과 표시를 위해 주기적으로 다시 그림
  useEffect(() => {
    const t = window.setInterval(() => force((x) => x + 1), 5000);
    return () => window.clearInterval(t);
  }, []);

  if (!me) return null;
  const dismiss = (id: string) => {
    setDismissed((s) => new Set(s).add(id));
    if (activeId === id) setActiveId(null);
  };

  // 1) 게임 고르기
  if (inviteTarget) {
    const target = byId.get(inviteTarget);
    const close = () => setInviteTarget(null);
    if (!target) return null;
    const online = isOnline(target.id);
    const start = async (kind: GameKind) => {
      if (!isOnline(target.id)) {
        showToast(`${target.nickname}님이 지금 접속 중이 아니에요.`);
        close();
        return;
      }
      const g = await inviteGame(target, kind);
      setActiveId(g.id);
      close();
    };
    return (
      <Modal title={<>🎲 {target.nickname}님에게 게임 걸기</>} onClose={close} labelId="game-invite-title">
        <p className="muted">
          이기면 서로 좋아요가 아니어도 바로 메시지를 보낼 수 있어요. 두 사람 모두 접속 중이어야 해요.
        </p>
        {!online && <p className="notice">지금은 상대가 접속 중이 아니에요.</p>}
        <div className="choice-grid two">
          <button type="button" className="choice" disabled={!online} onClick={() => start('rps')}>
            <span className="em" aria-hidden="true">✊✌️✋</span>가위바위보
          </button>
          <button type="button" className="choice" disabled={!online} onClick={() => start('coin')}>
            <span className="em" aria-hidden="true"><CoinIcon size={40} /></span>동전 던지기
          </button>
        </div>
        <button type="button" className="btn btn-ghost" onClick={close}>취소</button>
      </Modal>
    );
  }

  const now = Date.now();
  const mine = games.filter((g) => !dismissed.has(g.id));

  // 2) 받은 초대 (실제 사용자끼리 — 다른 탭/계정)
  const incoming = mine.find((g) => g.to === me.id && g.status === 'pending' && now - g.createdAt < PENDING_TIMEOUT_MS);
  if (incoming) {
    const from = byId.get(incoming.from);
    return (
      <Modal title={<>🎲 게임 초대가 왔어요</>} labelId="game-incoming-title" onClose={() => respondGame(incoming.id, false)}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {from && <img className="avatar" src={from.photo} alt="" />}
          <p>
            <b>{from?.nickname ?? '누군가'}</b>님이 <b>{incoming.kind === 'rps' ? '가위바위보' : '동전 던지기'}</b>를 신청했어요.
            상대가 이기면 나에게 메시지를 보낼 수 있어요.
          </p>
        </div>
        <div className="choice-grid two">
          <button type="button" className="btn btn-primary" onClick={() => { respondGame(incoming.id, true); setActiveId(incoming.id); }}>
            수락
          </button>
          <button type="button" className="btn" onClick={() => respondGame(incoming.id, false)}>거절</button>
        </div>
      </Modal>
    );
  }

  // 3) 진행 중이거나 방금 끝난 게임
  const game =
    mine.find((g) => g.id === activeId) ??
    mine.find((g) => g.status === 'playing' && now - g.updatedAt < 10 * 60_000);
  if (!game) return null;
  const other = byId.get(game.from === me.id ? game.to : game.from);
  const otherName = other?.nickname ?? '상대';
  return (
    <Modal
      title={<>{game.kind === 'rps' ? '✊ 가위바위보' : <><CoinIcon size={26} /> 동전 던지기</>} · {otherName}님</>}
      labelId="game-title"
      onClose={game.status === 'playing' ? undefined : () => dismiss(game.id)}
    >
      <GameBody
        game={game}
        meId={me.id}
        otherName={otherName}
        expired={game.status === 'pending' && now - game.createdAt >= PENDING_TIMEOUT_MS}
        onMove={(m) => playMove(game.id, m)}
        onClose={() => dismiss(game.id)}
        onChat={() => {
          dismiss(game.id);
          navigate(`/chat/${other?.id}`);
        }}
      />
    </Modal>
  );
}

function GameBody({
  game,
  meId,
  otherName,
  expired,
  onMove,
  onClose,
  onChat,
}: {
  game: GameSession;
  meId: string;
  otherName: string;
  expired: boolean;
  onMove: (m: RpsMove | CoinSide | 'flip') => void;
  onClose: () => void;
  onChat: () => void;
}) {
  const iAmFrom = game.from === meId;

  if (game.status === 'pending') {
    return (
      <>
        <p aria-live="polite">{expired ? `${otherName}님이 응답하지 않았어요.` : `${otherName}님의 수락을 기다리는 중…`}</p>
        <button type="button" className="btn" onClick={onClose}>{expired ? '닫기' : '취소하고 닫기'}</button>
      </>
    );
  }
  if (game.status === 'declined') {
    return (
      <>
        <p>{iAmFrom ? `${otherName}님이 지금은 게임을 받지 않았어요.` : '게임을 거절했어요.'}</p>
        <button type="button" className="btn" onClick={onClose}>닫기</button>
      </>
    );
  }
  if (game.status === 'done') {
    const won = game.winner === meId;
    return (
      <>
        {game.kind === 'rps' && game.fromMove && game.toMove && (
          <p style={{ textAlign: 'center' }}>
            나 {RPS_LABEL[(iAmFrom ? game.fromMove : game.toMove) as RpsMove]} vs {otherName} {RPS_LABEL[(iAmFrom ? game.toMove : game.fromMove) as RpsMove]}
          </p>
        )}
        {game.kind === 'coin' && game.coinResult && (
          <>
            <div className="coin" aria-hidden="true"><CoinIcon side={game.coinResult} size={96} /></div>
            <p style={{ textAlign: 'center' }}>
              {COIN_LABEL[game.coinResult]}이 나왔어요! ({iAmFrom ? '내' : `${otherName}님의`} 선택: {COIN_LABEL[game.fromMove as CoinSide]})
            </p>
          </>
        )}
        <p className={`result ${won ? 'win' : ''}`} role="status">
          {won ? '🎉 이겼어요! 이제 메시지를 보낼 수 있어요.' : `아쉽게 졌어요. ${otherName}님이 메시지를 보낼 수 있어요.`}
        </p>
        <div className="choice-grid two">
          {won && <button type="button" className="btn btn-primary" onClick={onChat}>💬 메시지 보내기</button>}
          <button type="button" className="btn" onClick={onClose}>닫기</button>
        </div>
      </>
    );
  }

  // playing
  if (game.kind === 'rps') {
    const myMove = iAmFrom ? game.fromMove : game.toMove;
    return (
      <>
        {game.lastDraw && (
          <p className="notice sky" role="status">
            비겼어요! ({RPS_LABEL[iAmFrom ? game.lastDraw.fromMove : game.lastDraw.toMove]} vs{' '}
            {RPS_LABEL[iAmFrom ? game.lastDraw.toMove : game.lastDraw.fromMove]}) {game.round}라운드!
          </p>
        )}
        {myMove ? (
          <p aria-live="polite">{RPS_LABEL[myMove as RpsMove]}을(를) 냈어요. {otherName}님을 기다리는 중…</p>
        ) : (
          <>
            <p>무엇을 낼까요?</p>
            <div className="choice-grid">
              {(['scissors', 'rock', 'paper'] as RpsMove[]).map((m) => (
                <button key={m} type="button" className="choice" onClick={() => onMove(m)}>
                  <span className="em" aria-hidden="true">{RPS_LABEL[m].split(' ')[0]}</span>
                  {RPS_LABEL[m].split(' ')[1]}
                </button>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  // coin
  if (iAmFrom) {
    if (!game.fromMove) {
      return (
        <>
          <p>앞면과 뒷면 중 하나를 고르세요. {otherName}님이 동전을 던져요.</p>
          <div className="choice-grid two">
            {(['heads', 'tails'] as CoinSide[]).map((s) => (
              <button key={s} type="button" className="choice" onClick={() => onMove(s)}>
                <span className="em" aria-hidden="true"><CoinIcon side={s} size={40} /></span>
                {COIN_LABEL[s]} ({s === 'heads' ? '♥' : '★'})
              </button>
            ))}
          </div>
        </>
      );
    }
    return (
      <>
        <div className="coin spin" aria-hidden="true"><CoinIcon size={96} /></div>
        <p aria-live="polite" style={{ textAlign: 'center' }}>
          {COIN_LABEL[game.fromMove as CoinSide]}을 골랐어요. {otherName}님이 동전을 던지는 중…
        </p>
      </>
    );
  }
  if (!game.fromMove) return <p aria-live="polite">{otherName}님이 면을 고르는 중…</p>;
  return (
    <>
      <p>
        {otherName}님이 <b>{COIN_LABEL[game.fromMove as CoinSide]}</b>을 골랐어요. 동전을 던지세요!
      </p>
      <button type="button" className="btn btn-primary" onClick={() => onMove('flip')}><CoinIcon size={22} /> 동전 던지기</button>
    </>
  );
}
