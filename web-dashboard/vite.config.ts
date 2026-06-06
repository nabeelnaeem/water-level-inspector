import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// LAN-friendly dev server: --host so phones/other machines can load it too.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
