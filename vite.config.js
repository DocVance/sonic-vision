import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves from /bat-vision/ — this must match your repo name exactly.
  base: '/sonic-vision/',
  server: {
    https: true,
  },
  plugins: [
    // mkcert is only needed for local HTTPS dev; skip it during build.
    command === 'serve' ? mkcert() : null,
  ].filter(Boolean),
}));
