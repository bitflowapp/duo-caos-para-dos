import { useState } from 'react';
import { MODES } from '@duo/shared';
import { ACHIEVEMENTS, loadProfile, resetProfile } from '../../persistence/profile';
import { store, useStore } from '../../state/store';
import { formatTime } from '../common';
import { IconBack } from '../icons';

const OUTCOME: Record<string, string> = {
  win: 'Ganaste',
  loss: 'Perdiste',
  tie: 'Empate',
  'coop-ok': '¡Lo lograron!',
  'coop-fail': 'Casi',
};

export function Profile() {
  const room = useStore((s) => s.room);
  const [p, setP] = useState(() => loadProfile());
  return (
    <main className="screen">
      <div className="screen-inner">
        <div className="row">
          <button className="icon-btn" aria-label="Volver" onClick={() => store.set({ view: room ? 'room' : 'home' })}>
            <IconBack />
          </button>
          <h1 style={{ margin: 0 }}>Logros y progreso</h1>
        </div>
        <section className="card stack">
          <div className="row between">
            <span>Partidas jugadas</span>
            <b>{p.games}</b>
          </div>
          <div className="row between">
            <span>Victorias · Derrotas · Empates</span>
            <b>
              {p.wins} · {p.losses} · {p.ties}
            </b>
          </div>
          <div className="row between">
            <span>Templos superados en equipo</span>
            <b>{p.coopClears}</b>
          </div>
          <div className="row between">
            <span>Corazones de pareja acumulados</span>
            <b>{p.coupleHearts}</b>
          </div>
          <div className="row between">
            <span>Mejor carrera</span>
            <b>{p.bestRaceSeconds === null ? '—' : `${p.bestRaceSeconds.toFixed(2)} s`}</b>
          </div>
          <div className="row between">
            <span>Mejor templo</span>
            <b>{p.bestCoopSeconds === null ? '—' : formatTime(p.bestCoopSeconds)}</b>
          </div>
          <div className="row between">
            <span>Mejor sintonía</span>
            <b>{p.bestSync === null ? '—' : `${p.bestSync}%`}</b>
          </div>
        </section>
        <section className="card">
          <h3>
            Logros ({p.achievements.length}/{ACHIEVEMENTS.length})
          </h3>
          <div className="achievements">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.id} className={`ach${p.achievements.includes(a.id) ? ' on' : ''}`}>
                <b>{a.name}</b>
                {a.description}
                {a.unlocks ? <div className="small muted">Desbloquea un accesorio</div> : null}
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h3>Historial</h3>
          {p.history.length === 0 ? <p className="muted">Todavía no hay partidas. ¡Creen una sala!</p> : null}
          {p.history.map((h) => (
            <div key={h.at} className="history-item">
              <span>
                {new Date(h.at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} · {MODES[h.mode].short}
                {h.partner ? ` con ${h.partner}` : ''}
              </span>
              <span>
                {OUTCOME[h.outcome]} · +{h.myPoints}
              </span>
            </div>
          ))}
        </section>
        <button
          className="btn ghost small"
          onClick={() => {
            if (window.confirm('¿Borrar logros, historial y accesorios de este dispositivo?')) {
              resetProfile();
              setP(loadProfile());
            }
          }}
        >
          Borrar progreso local
        </button>
      </div>
    </main>
  );
}
