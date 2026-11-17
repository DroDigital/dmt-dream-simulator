// A dev server for automated tests: no HMR and no file watching, so edits
// made while a long Playwright run is going don't reload the page under it.
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

export default mergeConfig(base as any, defineConfig({ server: { port: 5174, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } } }));
