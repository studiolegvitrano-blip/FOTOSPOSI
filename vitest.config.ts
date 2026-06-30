import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx', 'apps/web/src/**/*.test.ts', 'apps/web/src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/.*/**', '**/AppData/**', '**/Impostazioni**'],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web/src'),
    },
  },
});
