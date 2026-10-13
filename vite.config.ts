/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // The demo data has times in India (+05:30) and the screens write local times: tests run in IST
    globalSetup: ['./vitest.global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // The form tests render the whole page; with many files running at once 5 s is too tight
    testTimeout: 20000,
  },
});
