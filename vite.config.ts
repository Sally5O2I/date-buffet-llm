import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages는 https://<user>.github.io/<repo>/ 경로로 서비스되므로 base를 저장소 이름에 맞춘다.
// 저장소 이름을 바꾸면 이 값만 바꾸면 된다.
export default defineConfig({
  base: '/date-buffet-llm/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
