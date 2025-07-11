import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path';
import path from 'path';

const __dirname = resolve();

export default defineConfig(({ mode }) => {
  let base = '/'; // Default base path
  let outDir = 'dist'; // Default output directory

  if (mode === 'sorobansecurityportal') {
    base = '/sorobansecurityportal/';
    outDir = 'dist_sorobansecurityportal';
  }

  return {
    plugins: [react()],
    base,
    build: {
      outDir,
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
      },
    },
  };
});