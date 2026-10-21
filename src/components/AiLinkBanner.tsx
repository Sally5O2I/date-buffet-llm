import { useState } from 'react';
import { useApp } from '../state/AppStore';
import { clearSharedAiParam, loadAiSettings, readSharedAiUrl, saveAiSettings } from '../services/llm';

/**
 * 발표자가 공유한 링크(?ai=https://xxxx.trycloudflare.com)로 들어왔을 때,
 * 그 AI를 쓸지 한 번 묻는다. 동의해야만 주소가 저장된다.
 */
export function AiLinkBanner() {
  const { showToast } = useApp();
  const [url, setUrl] = useState(() => readSharedAiUrl(window.location.search));
  if (!url) return null;

  const close = () => {
    clearSharedAiParam();
    setUrl(null);
  };

  return (
    <div className="ai-link-banner card" role="dialog" aria-labelledby="ai-link-title">
      <p id="ai-link-title">
        <b>🤖 발표자가 공유한 AI가 있어요</b>
      </p>
      <p className="muted" style={{ fontSize: '0.88rem' }}>
        사용하면 추천 카드의 "AI 설명 보기"가 <b>발표자 컴퓨터의 AI</b>로 설명을 만들어요. 그때 두 사람의 닉네임·관심사·성격·한 줄 소개
        같은 정보가 이 주소로 전송돼요 (사진·키·체형은 보내지 않아요).
      </p>
      <p className="ai-link-url">{url}</p>
      <div className="ai-actions">
        <button type="button" className="btn btn-sm btn-ghost" onClick={close}>
          사용 안 함
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            saveAiSettings({ ...loadAiSettings(), baseUrl: url });
            close();
            showToast('발표자 AI에 연결했어요. 추천 카드에서 "AI 설명 보기"를 눌러 보세요.');
          }}
        >
          사용하기
        </button>
      </div>
    </div>
  );
}
