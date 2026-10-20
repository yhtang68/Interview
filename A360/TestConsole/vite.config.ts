import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  clearScreen: false,
  plugins: [
    react(),
    {
      name: 'test-console-ready-message',
      configureServer(server) {
        server.httpServer?.once('listening', () =>
          server.config.logger.info('Test Console API and UI ready: http://localhost:5173', {
            timestamp: true,
          }),
        );
      },
    },
  ],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:4310' } },
  build: { outDir: 'dist' },
});
