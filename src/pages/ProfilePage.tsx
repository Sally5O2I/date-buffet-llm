import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chips, RadioChips } from '../components/Chips';
import { Steps } from '../components/Steps';
import {
  AGE_MAX,
  AGE_MIN,
  ALL_BODY_TYPES,
  ALL_GENDERS,
  BODY_TYPE_OPTIONS,
  DRINKING_LABELS,
  GENDER_OPTIONS,
  HEIGHT_MAX,
  HEIGHT_MIN,
  INTERESTS,
  JOB_MAX,
  JOB_SUGGESTIONS,
  MBTI_TYPES,
  MBTI_UNKNOWN,
  PERSONALITIES,
  REGION_MODE_OPTIONS,
  REGIONS,
  SMOKING_ALLOW_OPTIONS,
  SMOKING_OPTIONS,
  SOFT_ITEMS,
  SOFT_ITEM_LABEL,
} from '../domain/constants';
import type { BodyType, Gender, Profile, SoftItem } from '../domain/types';
import { validateProfile, type ProfileErrors } from '../domain/validation';
import { StorageFullError } from '../repository/Repository';
import { useApp } from '../state/AppStore';
import { resizeImage } from '../utils/image';

type Draft = Omit<Profile, 'id' | 'createdAt'>;

const EMPTY: Draft = {
  nickname: '',
  age: NaN,
  gender: undefined as unknown as Gender,
  region: '',
  height: null,
  bodyType: null,
  mbti: null,
  job: null,
  interests: [],
  personality: [],
  smoking: undefined as unknown as Profile['smoking'],
  drinking: NaN,
  bio: '',
  photo: '',
  preference: {
    genders: [],
    ageMin: 25,
    ageMax: 35,
    heightMin: HEIGHT_MIN,
    heightMax: HEIGHT_MAX,
    bodyTypes: [...ALL_BODY_TYPES],
    regionMode: 'any',
    smokingAllow: 'any',
    important: [],
  },
};

const opts = (list: string[]) => list.map((v) => ({ value: v, label: v }));

/** 보고 싶은 성별 빠른 선택 */
function genderPresets(me: Gender | undefined): { label: string; value: Gender[] }[] {
  const all = { label: '모두', value: [...ALL_GENDERS] };
  if (!me) return [all];
  const same = { label: '동성만', value: [me] };
  if (me === 'other') return [same, all];
  return [{ label: '이성만', value: [me === 'male' ? 'female' : 'male'] }, same, all];
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function ProfilePage() {
  const { me, saveMyProfile, ready, mode } = useApp();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [saveError, setSaveError] = useState('');
  const loadedFor = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!ready) return;
    const key = me?.id ?? 'new';
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    if (me) {
      const { id: _id, createdAt: _c, ...rest } = me;
      setDraft(rest);
    } else {
      setDraft(EMPTY);
    }
    setErrors({});
    setSubmitted(false);
  }, [ready, me]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => {
      const next = { ...d, [k]: v };
      if (submitted) setErrors(validateProfile(next));
      return next;
    });
  };
  const setPref = <K extends keyof Draft['preference']>(k: K, v: Draft['preference'][K]) => {
    setDraft((d) => {
      const next = { ...d, preference: { ...d.preference, [k]: v } };
      if (submitted) setErrors(validateProfile(next));
      return next;
    });
  };

  async function onPhoto(file: File | undefined) {
    setPhotoError('');
    if (!file) return;
    try {
      set('photo', await resizeImage(file));
    } catch (err) {
      setPhotoError((err as Error).message);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setSaveError('');
    const errs = validateProfile(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // 첫 번째 오류 항목으로 포커스 이동
      requestAnimationFrame(() => {
        const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error="true"] button, [data-error="true"] input');
        el?.focus();
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      return;
    }
    setSaving(true);
    try {
      await saveMyProfile({
        ...draft,
        nickname: draft.nickname.trim(),
        bio: draft.bio.trim(),
        job: (draft.job ?? '').trim(),
      });
      navigate('/recommend');
    } catch (err) {
      setSaveError(
        err instanceof StorageFullError || err instanceof Error
          ? (err as Error).message
          : '저장하지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      setSaving(false);
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <p className="error" id={`err-${k}`} role="alert">
        {errors[k]}
      </p>
    ) : null;
  const errCount = Object.keys(errors).length;
  const p = draft.preference;

  return (
    <>
      {!me && <Steps current={2} />}
      <div className="page-head">
        <div>
          <h1>{me ? '내 프로필 수정' : '내 프로필 · 원하는 상대 설정'}</h1>
          <p>연락처·SNS 아이디 같은 개인정보는 받지 않아요. 저장하면 바로 추천을 보여드려요.</p>
        </div>
      </div>
      {mode === 'supabase' && (
        <p className="notice" style={{ marginBottom: 16 }}>
          ⚠️ 테스트용 서비스예요. 입력한 프로필과 사진은 서버에 저장되어 <b>다른 사용자에게 보여요.</b> 본인 실제 사진이나
          실명 대신 테스트용 정보를 써 주세요.
        </p>
      )}

      <form ref={formRef} onSubmit={onSubmit} noValidate>
        <div className="form-grid">
          <section className="card section" aria-labelledby="sec-me">
            <h2 id="sec-me">내 정보</h2>
            <p className="hint">상대에게 보여지는 정보예요.</p>

            <div className="field" data-error={!!errors.photo}>
              <span className="label" id="lbl-photo">사진<span className="req" aria-hidden="true">*</span><span className="sr-only">(필수)</span></span>
              <div className="photo-upload">
                {draft.photo ? (
                  <img className="photo-preview" src={draft.photo} alt="등록한 프로필 사진 미리보기" />
                ) : (
                  <div className="photo-preview" aria-hidden="true">📷</div>
                )}
                <div style={{ display: 'grid', gap: 6 }}>
                  <label className="btn btn-sm btn-sky" style={{ cursor: 'pointer' }}>
                    {draft.photo ? '사진 바꾸기' : '사진 올리기'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      aria-labelledby="lbl-photo"
                      aria-invalid={!!errors.photo}
                      aria-describedby={errors.photo ? 'err-photo' : undefined}
                      onChange={(e) => onPhoto(e.target.files?.[0])}
                    />
                  </label>
                  <span className="sub muted" style={{ fontSize: '0.8rem' }}>정사각형으로 잘라 이 브라우저에만 저장돼요.</span>
                </div>
              </div>
              {photoError && <p className="error" role="alert">{photoError}</p>}
              {err('photo')}
            </div>

            <div className="field">
              <label htmlFor="nickname">닉네임<span className="req" aria-hidden="true">*</span></label>
              <input
                id="nickname"
                className="input"
                value={draft.nickname}
                maxLength={12}
                autoComplete="off"
                aria-invalid={!!errors.nickname}
                aria-describedby={errors.nickname ? 'err-nickname' : undefined}
                onChange={(e) => set('nickname', e.target.value)}
                placeholder="2~12자"
              />
              {err('nickname')}
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="age">나이<span className="req" aria-hidden="true">*</span></label>
                <input
                  id="age"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={AGE_MIN}
                  max={AGE_MAX}
                  value={Number.isNaN(draft.age) ? '' : draft.age}
                  aria-invalid={!!errors.age}
                  aria-describedby={errors.age ? 'err-age' : undefined}
                  onChange={(e) => set('age', e.target.value === '' ? NaN : Number(e.target.value))}
                />
                {err('age')}
              </div>
              <div className="field">
                <label htmlFor="region">지역<span className="req" aria-hidden="true">*</span></label>
                <select
                  id="region"
                  className="select"
                  value={draft.region}
                  aria-invalid={!!errors.region}
                  aria-describedby={errors.region ? 'err-region' : undefined}
                  onChange={(e) => set('region', e.target.value)}
                >
                  <option value="">선택</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {err('region')}
              </div>
            </div>

            <div className="field" data-error={!!errors.gender}>
              <span className="label" id="lbl-gender">성별<span className="req" aria-hidden="true">*</span></span>
              <RadioChips labelledBy="lbl-gender" options={GENDER_OPTIONS} value={draft.gender} onChange={(v) => set('gender', v)} />
              {err('gender')}
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="height">키<span className="req" aria-hidden="true">*</span></label>
                <div className="range-row">
                  <input
                    id="height"
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={HEIGHT_MIN}
                    max={HEIGHT_MAX}
                    placeholder="예) 170"
                    value={draft.height ?? ''}
                    aria-invalid={!!errors.height}
                    aria-describedby={errors.height ? 'err-height' : undefined}
                    onChange={(e) => set('height', e.target.value === '' ? null : Number(e.target.value))}
                  />
                  <span>cm</span>
                </div>
                {err('height')}
              </div>
              <div className="field">
                <label htmlFor="mbti">MBTI<span className="req" aria-hidden="true">*</span></label>
                <select
                  id="mbti"
                  className="select"
                  value={draft.mbti ?? ''}
                  aria-invalid={!!errors.mbti}
                  aria-describedby={errors.mbti ? 'err-mbti' : undefined}
                  onChange={(e) => set('mbti', e.target.value || null)}
                >
                  <option value="">선택</option>
                  {MBTI_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value={MBTI_UNKNOWN}>잘 모르겠어요</option>
                </select>
                {err('mbti')}
              </div>
            </div>

            <div className="field">
              <label htmlFor="job">
                직업<span className="req" aria-hidden="true">*</span> <span className="sub">직접 입력 · 목록에서 골라도 돼요</span>
              </label>
              <input
                id="job"
                className="input"
                list="job-suggestions"
                value={draft.job ?? ''}
                maxLength={JOB_MAX}
                autoComplete="off"
                placeholder='예) 회사원, 간호사, 개발자 / 밝히기 싫으면 "비공개"'
                aria-invalid={!!errors.job}
                aria-describedby={errors.job ? 'err-job' : 'job-hint'}
                onChange={(e) => set('job', e.target.value)}
              />
              <datalist id="job-suggestions">
                {JOB_SUGGESTIONS.map((j) => (
                  <option key={j} value={j} />
                ))}
              </datalist>
              <span id="job-hint" className="sub muted" style={{ fontSize: '0.8rem' }}>
                회사 이름 같은 구체적인 정보는 쓰지 않는 걸 권해요.
              </span>
              {err('job')}
            </div>

            <div className="field" data-error={!!errors.bodyType}>
              <span className="label" id="lbl-body">몸무게(체형)<span className="req" aria-hidden="true">*</span></span>
              <RadioChips<BodyType>
                labelledBy="lbl-body"
                options={BODY_TYPE_OPTIONS}
                value={draft.bodyType ?? undefined}
                onChange={(v) => set('bodyType', v)}
              />
              {err('bodyType')}
            </div>

            <div className="field" data-error={!!errors.interests}>
              <span className="label" id="lbl-interests">
                관심사<span className="req" aria-hidden="true">*</span> <span className="sub">최대 8개 · {draft.interests.length}개 선택</span>
              </span>
              <Chips labelledBy="lbl-interests" options={opts(INTERESTS)} selected={draft.interests} max={8} onChange={(v) => set('interests', v)} invalid={!!errors.interests} />
              {err('interests')}
            </div>

            <div className="field" data-error={!!errors.personality}>
              <span className="label" id="lbl-personality">
                성격 키워드<span className="req" aria-hidden="true">*</span> <span className="sub">최대 5개 · {draft.personality.length}개 선택</span>
              </span>
              <Chips labelledBy="lbl-personality" options={opts(PERSONALITIES)} selected={draft.personality} max={5} onChange={(v) => set('personality', v)} invalid={!!errors.personality} />
              {err('personality')}
            </div>

            <div className="field" data-error={!!errors.smoking}>
              <span className="label" id="lbl-smoking">흡연 여부<span className="req" aria-hidden="true">*</span></span>
              <RadioChips labelledBy="lbl-smoking" options={SMOKING_OPTIONS} value={draft.smoking} onChange={(v) => set('smoking', v)} />
              {err('smoking')}
            </div>

            <div className="field" data-error={!!errors.drinking}>
              <span className="label" id="lbl-drinking">음주 빈도<span className="req" aria-hidden="true">*</span></span>
              <RadioChips
                labelledBy="lbl-drinking"
                options={DRINKING_LABELS.map((label, value) => ({ value, label }))}
                value={Number.isNaN(draft.drinking) ? undefined : draft.drinking}
                onChange={(v) => set('drinking', v)}
              />
              {err('drinking')}
            </div>

            <div className="field">
              <label htmlFor="bio">
                한 줄 소개<span className="req" aria-hidden="true">*</span> <span className="sub">{draft.bio.trim().length}/60</span>
              </label>
              <input
                id="bio"
                className="input"
                value={draft.bio}
                maxLength={60}
                aria-invalid={!!errors.bio}
                aria-describedby={errors.bio ? 'err-bio' : 'bio-hint'}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="예) 주말엔 동네 카페 투어를 해요"
              />
              <span id="bio-hint" className="sub muted" style={{ fontSize: '0.8rem' }}>연락처, 이메일, SNS 아이디, 링크는 쓸 수 없어요.</span>
              {err('bio')}
            </div>
          </section>

          <section className="card section" aria-labelledby="sec-pref">
            <h2 id="sec-pref">원하는 상대</h2>
            <p className="hint">
              성별·나이·키·체형·흡연(그리고 선택한 경우 지역)은 <b>절대 조건</b>이에요. 서로의 조건을 모두 통과해야 추천에 나와요.
            </p>

            <div className="field" data-error={!!errors.prefGenders}>
              <span className="label" id="lbl-pgender">보고 싶은 성별<span className="req" aria-hidden="true">*</span></span>
              <div className="chips" role="group" aria-label="빠른 선택">
                {genderPresets(draft.gender).map((pr) => (
                  <button
                    key={pr.label}
                    type="button"
                    className="chip"
                    aria-pressed={sameSet(pr.value, p.genders)}
                    onClick={() => setPref('genders', pr.value)}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
              <span className="sub muted" style={{ fontSize: '0.8rem' }}>직접 고르기</span>
              <Chips labelledBy="lbl-pgender" options={GENDER_OPTIONS} selected={p.genders} onChange={(v) => setPref('genders', v)} invalid={!!errors.prefGenders} />
              {err('prefGenders')}
            </div>

            <fieldset className="field">
              <legend className="label">나이 범위<span className="req" aria-hidden="true">*</span></legend>
              <div className="range-row">
                <label className="sr-only" htmlFor="ageMin">최소 나이</label>
                <input
                  id="ageMin"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={AGE_MIN}
                  max={AGE_MAX}
                  value={Number.isNaN(p.ageMin) ? '' : p.ageMin}
                  aria-invalid={!!errors.prefAge}
                  aria-describedby={errors.prefAge ? 'err-prefAge' : undefined}
                  onChange={(e) => setPref('ageMin', e.target.value === '' ? NaN : Number(e.target.value))}
                />
                <span aria-hidden="true">~</span>
                <label className="sr-only" htmlFor="ageMax">최대 나이</label>
                <input
                  id="ageMax"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={AGE_MIN}
                  max={AGE_MAX}
                  value={Number.isNaN(p.ageMax) ? '' : p.ageMax}
                  aria-invalid={!!errors.prefAge}
                  aria-describedby={errors.prefAge ? 'err-prefAge' : undefined}
                  onChange={(e) => setPref('ageMax', e.target.value === '' ? NaN : Number(e.target.value))}
                />
                <span>세</span>
              </div>
              {err('prefAge')}
            </fieldset>

            <fieldset className="field">
              <legend className="label">키 범위<span className="req" aria-hidden="true">*</span></legend>
              <div className="chips" role="group" aria-label="키 빠른 선택">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={p.heightMin === HEIGHT_MIN && p.heightMax === HEIGHT_MAX}
                  onClick={() => {
                    setPref('heightMin', HEIGHT_MIN);
                    setPref('heightMax', HEIGHT_MAX);
                  }}
                >
                  상관없음
                </button>
              </div>
              <div className="range-row">
                <label className="sr-only" htmlFor="heightMin">최소 키</label>
                <input
                  id="heightMin"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={HEIGHT_MIN}
                  max={HEIGHT_MAX}
                  value={Number.isNaN(p.heightMin) ? '' : p.heightMin}
                  aria-invalid={!!errors.prefHeight}
                  aria-describedby={errors.prefHeight ? 'err-prefHeight' : undefined}
                  onChange={(e) => setPref('heightMin', e.target.value === '' ? NaN : Number(e.target.value))}
                />
                <span aria-hidden="true">~</span>
                <label className="sr-only" htmlFor="heightMax">최대 키</label>
                <input
                  id="heightMax"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={HEIGHT_MIN}
                  max={HEIGHT_MAX}
                  value={Number.isNaN(p.heightMax) ? '' : p.heightMax}
                  aria-invalid={!!errors.prefHeight}
                  aria-describedby={errors.prefHeight ? 'err-prefHeight' : undefined}
                  onChange={(e) => setPref('heightMax', e.target.value === '' ? NaN : Number(e.target.value))}
                />
                <span>cm</span>
              </div>
              {err('prefHeight')}
            </fieldset>

            <div className="field" data-error={!!errors.prefBody}>
              <span className="label" id="lbl-pbody">
                원하는 체형<span className="req" aria-hidden="true">*</span> <span className="sub">복수 선택 · 모두 고르면 상관없음</span>
              </span>
              <Chips<BodyType>
                labelledBy="lbl-pbody"
                options={BODY_TYPE_OPTIONS}
                selected={p.bodyTypes}
                onChange={(v) => setPref('bodyTypes', v)}
                invalid={!!errors.prefBody}
              />
              {err('prefBody')}
            </div>

            <div className="field">
              <span className="label" id="lbl-rmode">지역 조건</span>
              <RadioChips labelledBy="lbl-rmode" options={REGION_MODE_OPTIONS} value={p.regionMode} onChange={(v) => setPref('regionMode', v)} />
            </div>

            <div className="field">
              <span className="label" id="lbl-sallow">상대 흡연 허용</span>
              <RadioChips labelledBy="lbl-sallow" options={SMOKING_ALLOW_OPTIONS} value={p.smokingAllow} onChange={(v) => setPref('smokingAllow', v)} />
            </div>

            <div className="field" data-error={!!errors.important}>
              <span className="label" id="lbl-important">
                중요하게 보는 항목 3개<span className="req" aria-hidden="true">*</span>{' '}
                <span className="sub">가중치 2배 · {p.important.length}/3</span>
              </span>
              <Chips<SoftItem>
                labelledBy="lbl-important"
                options={SOFT_ITEMS.map((v) => ({ value: v, label: SOFT_ITEM_LABEL[v] }))}
                selected={p.important}
                max={3}
                onChange={(v) => setPref('important', v)}
                invalid={!!errors.important}
              />
              {err('important')}
            </div>
          </section>
        </div>

        <div className="form-actions">
          <p className="msg" role="status" aria-live="polite">
            {saveError ? (
              <span className="error">{saveError}</span>
            ) : submitted && errCount > 0 ? (
              <span className="error">고쳐야 할 항목이 {errCount}개 있어요.</span>
            ) : (
              <span className="muted">* 표시는 필수예요.</span>
            )}
          </p>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '저장 중…' : '저장하고 추천 보기'}
          </button>
        </div>
      </form>
    </>
  );
}
