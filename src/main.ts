import '@fontsource/vt323';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import './ui/style.css';
import { Game } from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
document.fonts?.ready.finally(() => {
  game.init().catch((e) => {
    console.error(e);
    (window as any).err = String(e?.stack || e);
    const l = document.getElementById('loading');
    if (l) l.textContent = 'The dream would not start: ' + (e?.message ?? e) + ' — try ?webgl';
  });
});
