import { audio } from '../../audio';
import { saveSettings, type Settings as S } from '../../persistence/settings';
import { store, useStore } from '../../state/store';
import { IconBack } from '../icons';
import { NameField } from './Home';

function update(patch: Partial<S>): void {
  const settings = { ...store.get().settings, ...patch };
  store.set({ settings });
  saveSettings(settings);
  audio.setMusicVolume(settings.musicVolume);
  audio.setSfxVolume(settings.sfxVolume);
  audio.setMuted(settings.muted);
  document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
}

export function Settings() {
  const s = useStore((st) => st.settings);
  const room = useStore((st) => st.room);
  return (
    <main className="screen">
      <div className="screen-inner">
        <div className="row">
          <button className="icon-btn" aria-label="Volver" onClick={() => store.set({ view: room ? 'room' : 'home' })}>
            <IconBack />
          </button>
          <h1 style={{ margin: 0 }}>Ajustes</h1>
        </div>
        <section className="card">
          <h3>Sonido</h3>
          <label className="setting">
            <span>Silenciar todo</span>
            <input type="checkbox" className="switch" checked={s.muted} onChange={(e) => update({ muted: e.target.checked })} />
          </label>
          <label className="setting">
            <span>Música</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.musicVolume}
              onChange={(e) => update({ musicVolume: Number(e.target.value) })}
              aria-label="Volumen de música"
            />
          </label>
          <label className="setting">
            <span>Efectos</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.sfxVolume}
              onChange={(e) => {
                update({ sfxVolume: Number(e.target.value) });
                audio.play('heart');
              }}
              aria-label="Volumen de efectos"
            />
          </label>
        </section>
        <section className="card">
          <h3>Juego</h3>
          <NameField />
          <label className="setting">
            <span>
              Vibración
              <br />
              <span className="muted small">En Android. iPhone no lo permite desde la web.</span>
            </span>
            <input type="checkbox" className="switch" checked={s.vibration} onChange={(e) => update({ vibration: e.target.checked })} />
          </label>
          <label className="setting">
            <span>Reducir movimiento</span>
            <input type="checkbox" className="switch" checked={s.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} />
          </label>
          <div className="setting">
            <span>Calidad gráfica</span>
            <div className="row" role="group" aria-label="Calidad gráfica">
              {(['auto', 'high', 'low'] as const).map((q) => (
                <button key={q} className="chip-btn" aria-pressed={s.quality === q} onClick={() => update({ quality: q })}>
                  {q === 'auto' ? 'Auto' : q === 'high' ? 'Alta' : 'Ahorro'}
                </button>
              ))}
            </div>
          </div>
          <div className="setting">
            <span>Controles en pantalla</span>
            <div className="row" role="group" aria-label="Controles en pantalla">
              {(['auto', 'on', 'off'] as const).map((q) => (
                <button key={q} className="chip-btn" aria-pressed={s.touchControls === q} onClick={() => update({ touchControls: q })}>
                  {q === 'auto' ? 'Auto' : q === 'on' ? 'Siempre' : 'Ocultos'}
                </button>
              ))}
            </div>
          </div>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Teclado: Espacio/↑ saltar · ↓ deslizar · ←/→ moverse · E acción · Shift usar ítem. La calidad “Ahorro” se aplica al recargar.
          </p>
        </section>
        <section className="card">
          <h3>Privacidad</h3>
          <p className="muted small" style={{ margin: 0 }}>
            DUO no pide registro ni guarda datos personales en el servidor. Las salas viven en memoria y se borran al cerrarse. Tus logros y preferencias quedan
            solo en este dispositivo. No hay publicidad ni métricas de seguimiento.
          </p>
        </section>
      </div>
    </main>
  );
}
