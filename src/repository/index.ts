import { createLocalRepository } from './localRepository';
import { createSupabaseRepository } from './supabaseRepository';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * 저장소 선택. 환경 변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 있으면 Supabase,
 * 없으면 이 브라우저에만 저장하는 local 모드로 동작한다.
 */
export const repo = url && key ? createSupabaseRepository(url, key) : createLocalRepository();

export type { Repository, RepoTopic } from './Repository';
