import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { normalizeRoomCode } from '@duo/shared';
import { audio, installAudioLifecycle } from './audio';
import { input } from './input/InputState';
import { net } from './net/NetClient';
import { store } from './state/store';
import { App } from './ui/App';

// Preferencias de audio guardadas
const settings = store.get().settings;
audio.setMusicVolume(settings.musicVolume);
audio.setSfxVolume(settings.sfxVolume);
audio.setMuted(settings.muted);
installAudioLifecycle(audio);
input.install();
document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);

// Enlace de invitación: #/sala/ABCD-EFGH
function readInvite(): void {
  const m = /#\/sala\/([A-Za-z0-9-]{8,12})/.exec(window.location.hash);
  const code = m?.[1] ? normalizeRoomCode(m[1]) : null;
  const stored = net.storedSession();
  if (stored && (!code || stored.code === code)) {
    // Recarga de la misma pestaña: volvemos a la sala con el token.
    store.set({ session: stored, view: 'room' });
    net.connect();
    return;
  }
  if (code) store.set({ inviteCode: code, view: 'join' });
}
readInvite();
window.addEventListener('hashchange', readInvite);

const rootEl = document.getElementById('ui-root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Phaser se carga en paralelo: la interfaz aparece de inmediato.
const gameEl = document.getElementById('game-root');
if (gameEl) {
  void import('./game/PhaserGame').then(({ createGame }) => createGame(gameEl));
}

// Conexión temprana (el servidor gratuito puede tardar en despertar).
net.connect();

// Exponer estado solo en builds de prueba E2E.
if (import.meta.env.VITE_E2E === '1') {
  (window as unknown as { __duo: unknown }).__duo = { store, net };
}
