# Date Buffet (데이트 뷔페)

> GitHub 저장소: `date-buffet-llm` (로컬 LLM 'AI 설명 보기' 포함 버전) · 배포 주소: `https://sally5o2i.github.io/date-buffet-llm/`

양방향 조건 매칭 소개팅 테스트 앱. React + Vite + TypeScript, 백엔드 없이 localStorage + 가상 인물 50명으로 동작합니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173/date-buffet-llm/
npm test           # 단위 테스트 (매칭·공정성·게임/메시지 규칙)
npm run simulate   # 공정성 시뮬레이션 표 (기준 미달 시 exit 1)
npm run simulate -- --n 300 --seed 7 --top 10 --cap 4
npm run generate   # 가상 프로필 표 출력 (--n, --seed, --out file.json)
npm run build
```

## 저장 모드

| 모드 | 조건 | 동작 |
|---|---|---|
| **local** | 환경 변수 없음 | 이 브라우저에만 저장. 가상 인물 50명과만 테스트 |
| **supabase** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 있음 | 아이디·비밀번호 로그인, 서버 저장. 실제 사용자끼리 매칭·메시지·게임 실시간 |

화면 흐름: 첫 화면(시작하기) → 아이디·비밀번호 만들기 → 내 프로필·원하는 상대 설정 → 추천

### Supabase 설정 (한 번만)

1. Supabase 대시보드 → **Authentication → Sign In / Providers**
   - **Email** 켜기, **Allow new users to sign up** 켜기
   - **Confirm email 끄기** (아이디를 `아이디@blind-match.app` 형식의 내부 주소로 바꿔 쓰므로 메일 인증을 할 수 없음)
2. **SQL Editor** → New query → [`supabase/schema.sql`](supabase/schema.sql) 전체 붙여넣고 **Run**
   (이미 실행했어도 다시 실행하세요. 계정 삭제 함수 `delete_my_account`가 추가됐어요)
3. **Project Settings → API**(또는 상단 **Connect**)에서 **Project URL**과 **anon / publishable key** 복사
   (⚠️ `service_role` / `secret` 키는 절대 쓰지 말 것)
4. 로컬 실행: `.env.example`을 `.env.local`로 복사해 두 값을 채운 뒤 `npm run dev`
5. 배포: GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**으로
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 두 개 등록 → push

anon key는 브라우저 코드에 포함되는 공개용 키라 노출돼도 괜찮고, 데이터 보호는 `schema.sql`의 RLS 규칙이 담당합니다.

### Supabase 모드의 한계
- 이메일이 없어서 **비밀번호 찾기가 불가능**합니다. 비밀번호를 잊으면 대시보드 → Authentication → Users에서 관리자가 바꿔야 합니다.
- 같은 브라우저의 탭들은 같은 로그인을 공유합니다. 다른 사용자 테스트는 시크릿 창·다른 브라우저·휴대폰으로 하세요.
- 게임 승패 판정은 브라우저에서 하므로 마음먹으면 조작할 수 있습니다 (서버 함수로 옮기면 해결).
- 사진은 리사이즈한 데이터를 프로필에 그대로 저장합니다(1인 약 30~50KB). 사용자가 많아지면 Supabase Storage로 옮기는 게 좋습니다.
- 무료 요금제는 7일간 접속이 없으면 프로젝트가 일시정지됩니다. 발표 전에 대시보드에서 확인하세요.

## 구조

| 경로 | 역할 |
|---|---|
| `src/domain/matching.ts` | 매칭 로직 (순수 함수): 하드 필터 → 소프트 점수 → 가중치 → 양방향 √(A→B×B→A) → TOP N, 노출 상한 |
| `src/domain/fairness.ts` | 노출 지니계수, 그룹별 노출·추천률, 반사실(나이) 테스트 |
| `src/domain/social.ts` | 서로 좋아요, 메시지 권한, 가위바위보/동전 판정 |
| `src/domain/validation.ts` | 폼 검증, 연락처·SNS 입력 차단 |
| `src/data/generator.ts` | seed 고정 가상 프로필 생성기 |
| `src/repository/` | 저장소 인터페이스. `index.ts` 한 줄로 local ↔ Supabase 교체 |
| `src/services/bots.ts` | 가상 인물의 좋아요·답장·게임 응답 흉내 (Supabase 전환 시 삭제) |
| `src/pages/`, `src/components/` | UI (matching.ts는 import만 함) |

## 테스트 방법

1. 프로필을 만들면 바로 추천 페이지로 이동합니다.
2. **두 사용자끼리 테스트 (local 모드)**: **새 탭**을 열고 다른 아이디로 가입·로그인. 탭마다 로그인이 따로 유지되어 서로 좋아요·메시지·게임 초대를 실시간으로 주고받을 수 있습니다 (같은 브라우저 안에서만). 계정은 이 브라우저에만 저장되고 비밀번호는 PBKDF2 해시로만 보관됩니다.
3. 가상 인물은 10분마다 접속 상태가 바뀌고, 좋아요·메시지·게임에 자동으로 반응합니다.

## 가상 인물 50명

`src/data/generator.ts`가 seed 고정으로 생성합니다 (`npm run generate`로 표 확인). 이름은 '김영수·박옥순' 같은 흔한 가명이며 모두 지어낸 인물입니다.

- 성별: 남 22 · 여 22 · 기타 6
- 나이: 21~40세, 세 구간(21~27 / 28~33 / 34~40)에 고르게
- 지역: 17개 시·도 모두 최소 2명 (서울 7, 경기 6, 부산 4 …)
- 흡연: 비흡연 32 · 가끔 11 · 흡연 7 / 음주: 5단계 각 10명
- 키: 남 165~186 · 여 152~172 · 기타 155~182cm / 체형: 마름 14 · 보통 26 · 통통 10 / MBTI: 16유형 + 일부 '모름'
- 원하는 키: 절반은 상관없음, 절반은 범위 지정 / 원하는 체형: 약 55% 모두, 나머지는 두 가지만
- 원하는 성별: 이성만 약 60% · 동성만 약 15% · 모두 약 25% (기타는 별도 분포)

## 공정성 결과 (샘플 50명, `npm run simulate`)

| 기준 | 나이대 | 성별 | 지역 | 판정 |
|---|---|---|---|---|
| **TOP 10 (배포 기준)** | 0.92 | 0.87 | 0.90 | ✅ 통과 |
| TOP 5 (참고) | 0.96 | 0.94 | **0.79** | ⚠️ 기준 미달 |

- 노출 지니계수 0.56, 추천 0명 비율 18.0%, 반사실(나이만 ±1·±2) 점수 차이 0
- 키·체형 조건이 추가되면서 0명 추천 비율이 8% → 18%로 늘었습니다 (절대 조건이 많을수록 후보가 줄어듦).
- 체형별 추천률(노출÷기회)은 마름 0.86 · 보통 0.92 · 통통 0.94로 알고리즘 차이는 작습니다.
  다만 노출 '기회' 자체가 마름·통통(약 3.6)이 보통(4.2)보다 적은데, 이는 사용자들이 고른 '원하는 체형' 조건 때문입니다.
- **TOP 5 지역이 미달인 이유**: 리스트가 좁을수록 그룹 구성의 작은 차이가 그대로 드러납니다.
  지역 점수를 완화하거나(100/70/50/30 등) 아예 없애도 TOP 5 지역 비율은 0.8을 넘지 못했고,
  예를 들어 강원·제주 그룹은 우연히 흡연자 비율이 높아 흡연 습관 점수에서 밀렸습니다.
  그래서 명세 점수(같은 시/도 100, 인접 50, 그 외 0)를 유지하고, 배포를 막는 테스트는 TOP 10 기준으로 두었습니다.

## 🤖 AI 설명 보기 (로컬 LLM · Ollama)

추천 카드의 **"AI 설명 보기"**를 누르면, 이 컴퓨터에서 실행 중인 Ollama의 `qwen2.5:3b`가 두 사람이 왜 잘 맞는지 2~3문장으로 설명하고 **첫 메시지**를 추천합니다.

| 역할 | 담당 |
|---|---|
| 점수·순위 계산 | `matching.ts` (규칙, 단위 테스트·공정성 검사 대상) |
| 설명 문장 | LLM (계산된 사실만 받아서 풀어 쓰기) |

- **보내는 정보**: 닉네임·나이·성별·지역·직업·MBTI·관심사·성격·음주·흡연·한 줄 소개, 겹치는 관심사, 앱이 계산한 상위 근거 3개
- **보내지 않는 정보**: 사진, 키, 체형 (외모 평가 방지), 연락처
- **형식 강제**: Ollama structured output(JSON 스키마)로 `{summary, icebreaker}`만 받음
- **품질 장치**: temperature 0.2 · 예시/빈칸 베끼기 감지 시 1회 자동 재작성 · 두 사람 프로필에 없는 관심사를 언급하면 "⚠️ 사실 확인 필요" 표시 · 연락처가 섞인 문장 제거
- **실패 시**: Ollama가 꺼져 있거나 다른 사람 컴퓨터에서는 기존 규칙 기반 설명("관심사 4개 중 3개가 겹쳐요")만 보입니다.
- **설정**: 계정 화면 → "AI 설명 (로컬 Ollama)"에서 주소·모델 변경, 연결 확인
- **실측** (이 PC, CPU): 설명 1개 12~25초, 글자가 생기는 대로 화면에 표시(스트리밍)

### 준비
```bash
ollama pull qwen2.5:3b
```
배포 사이트에서 쓰려면 Ollama가 그 사이트 주소를 허용해야 합니다.
```powershell
setx OLLAMA_ORIGINS "https://sally5o2i.github.io"
```
(설정 후 Ollama를 완전히 종료했다가 다시 실행)

관련 코드: `src/domain/explainPrompt.ts`(프롬프트·파싱·검증, 순수 함수) · `src/services/llm.ts`(Ollama 호출) · `src/components/AiExplain.tsx`(화면) · `tests/explainPrompt.test.ts`

### 🎤 발표용: 다른 사람 핸드폰에서도 AI 설명 쓰기

브라우저의 `localhost`는 "지금 이 기기"라서, 다른 사람 핸드폰은 내 컴퓨터 AI에 닿지 못합니다.
발표 중에만 **AI 문지기 + Cloudflare 임시 터널**로 내 컴퓨터 AI를 잠깐 열어 줍니다.

```
다른 사람 핸드폰 ──https──▶ xxxx.trycloudflare.com ──▶ AI 문지기(:8787) ──▶ Ollama(:11434)
```

1. 터널 프로그램 설치 (처음 한 번)
   ```powershell
   winget install --id Cloudflare.cloudflared
   ```
2. Ollama 실행 후, `ai-gateway\start-demo.ps1` 실행 → **공유 링크**가 출력되고 클립보드에 복사됨
   (`https://sally5o2i.github.io/date-buffet-llm/?ai=https://xxxx.trycloudflare.com`)
3. 링크(또는 QR)를 공유 → 들어온 사람에게 "발표자가 공유한 AI를 사용할까요?" 확인창이 뜨고, **사용하기**를 누르면 연결
4. 끝나면 창에서 Ctrl + C → 문지기와 터널이 함께 꺼짐 (주소는 실행할 때마다 새로 생김)

**AI 문지기(`ai-gateway/`)가 하는 일**
- 앱의 소개팅 설명 요청만 통과 (시스템 프롬프트가 정확히 일치해야 함, 자유 질문 차단)
- 모델(`qwen2.5:3b`)·출력 형식·최대 길이를 문지기가 강제 → 개인 페르소나 모델은 목록에도 안 보임
- 앱 주소(github.io)에서 온 요청만 허용, 한 사람당 1분에 6번, 대기 최대 4개
- 공유 링크의 AI 주소는 `https://*.trycloudflare.com`만 받고, 사용 전 반드시 확인을 받음

**한계**: 컴퓨터·Ollama·터널이 켜져 있는 동안만 동작, 설명 1개 10~20초이고 한 번에 한 명씩 처리 (동시에 여러 명이면 줄을 섬).
24시간 서비스하려면 클라우드 LLM API가 필요합니다.

## 공정성 측정 정의

- **노출 수**: 다른 사람들의 TOP N 리스트에 들어간 횟수
- **노출 기회**: 양쪽 조건을 모두 통과해 후보가 될 수 있었던 횟수
- **추천률** = 노출 ÷ 기회. 그룹 간 추천률 최소/최대 비율이 0.8 미만이면 실패
  (사용자 '선호' 때문에 생기는 차이와 '알고리즘' 때문에 생기는 차이를 분리하기 위해 기회로 나눔)
