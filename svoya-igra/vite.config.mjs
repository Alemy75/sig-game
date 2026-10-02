import { defineConfig } from 'vite';
import mediaServer from './server.cjs';

// Keep one uploads directory for both development and the local built preview.
function localMedia() {
  const install = server => { server.middlewares.use(mediaServer.middleware); };
  return { name: 'local-media', configureServer: install, configurePreviewServer: install };
}
export default defineConfig({
  plugins: [localMedia()],
  server: { host: '127.0.0.1', port: 8787, strictPort: true, watch: { ignored: ['**/uploads/**'] } },
  preview: { host: '127.0.0.1', port: 8787, strictPort: true },
});
