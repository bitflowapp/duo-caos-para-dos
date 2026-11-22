import { useEffect, useRef } from 'react';
import { recordResult } from '../persistence/profile';
import { net } from '../net/NetClient';
import { audio } from '../audio';
import { announce, store, toast, useStore } from '../state/store';
import { ConnectionBadge, EmoteFloats, TopActions, Toasts } from './common';
import { GameOverlay } from './game/GameOverlay';
import { Home } from './screens/Home';
import { Join } from './screens/Join';
import { Lobby } from './screens/Lobby';
import { Profile } from './screens/Profile';
import { Results } from './screens/Results';
import { Settings } from './screens/Settings';

/** Registra resultados en el perfil local y dispara jingles/logros. */
function useResultEffects(): void {
  const room = useStore((s) => s.room);
  const session = useStore((s) => s.session);
  const seen = useRef(-1);
  useEffect(() => {
    const res = room?.lastResult;
    if (!room || !session || !res || room.phase !== 'results' || seen.current === res.id) return;
    seen.current = res.id;
    const me = session.slot;
    const partner = room.players[me === 0 ? 1 : 0];
    const fresh = recordResult(res, me, partner?.name ?? '', { roomCode: room.code, tourFinished: room.tour?.finished === true });
    store.set({ rewards: { matchId: res.id, ids: fresh.map((a) => a.id) } });
    if (res.cooperative) {
      audio.jingle(res.details.kind === 'coop' && res.details.success ? 'victory' : 'defeat');
    } else if (res.winner === null) audio.jingle('tie');
    else audio.jingle(res.winner === me ? 'victory' : 'defeat');
    if (room.tour?.finished) setTimeout(() => audio.jingle('tourWin'), 2500);
    announce(res.headline);
    fresh.forEach((a, i) =>
      setTimeout(() => {
        toast(`Logro desbloqueado: ${a.name}`, 'achievement', 4200);
        audio.jingle('achievement');
      }, 1800 + i * 1400),
    );
  }, [room, session]);
}

export function App() {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const replaced = useStore((s) => s.replaced);
  const session = useStore((s) => s.session);
  const connection = useStore((s) => s.connection);
  useResultEffects();

  let screen: React.ReactNode;
  if (view === 'settings') screen = <Settings />;
  else if (view === 'profile') screen = <Profile />;
  else if (room) {
    if (room.phase === 'lobby') screen = <Lobby room={room} />;
    else if (room.phase === 'results') screen = <Results room={room} />;
    else screen = <GameOverlay room={room} />;
  } else if (session && view === 'room') {
    screen = (
      <div className="screen">
        <div className="screen-inner center">
          <div className="card">
            <div className="spinner" />
            <p>{connection === 'online' ? 'Volviendo a tu sala…' : 'Conectando con el servidor…'}</p>
            <button
              className="btn ghost small"
              onClick={() => {
                net.clearSession();
                store.set({ view: 'home' });
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  } else if (view === 'join') screen = <Join />;
  else screen = <Home />;

  const inGame = room && (room.phase === 'countdown' || room.phase === 'playing' || room.phase === 'paused');

  return (
    <>
      {screen}
      {room && view !== 'settings' && view !== 'profile' ? (
        <div className={`topbar${inGame ? '' : ' menu'}`}>
          <ConnectionBadge room={room} />
          <TopActions compact={!!inGame} />
        </div>
      ) : null}
      <EmoteFloats />
      <Toasts />
      {replaced ? (
        <div className="overlay" role="alertdialog" aria-labelledby="replaced-title">
          <div className="card">
            <h2 id="replaced-title">Partida abierta en otra pestaña</h2>
            <p className="muted">Tu lugar en la sala se abrió desde otra pestaña o dispositivo. Podés seguir allá o recuperarlo acá.</p>
            <div className="stack">
              <button
                className="btn block"
                onClick={() => {
                  const info = net.resumableSession();
                  store.set({ replaced: false });
                  if (info) net.resume(info);
                }}
              >
                Jugar en esta pestaña
              </button>
              <button className="btn ghost block" onClick={() => store.set({ replaced: false })}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
