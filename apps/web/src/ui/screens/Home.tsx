import { useState } from 'react';
import { formatRoomCode, MAX_NAME_LENGTH } from '@duo/shared';
import { audio } from '../../audio';
import { net } from '../../net/NetClient';
import { saveSettings } from '../../persistence/settings';
import { store, useStore } from '../../state/store';
import { IconGear, IconHeart, IconPlay, IconTrophy, IconUsers } from '../icons';

export function Logo() {
  return (
    <div className="logo" aria-label="DUO — Caos para Dos">
      <span className="logo-word">DUO</span>
      <span className="logo-sub">
        Caos para dos{' '}
        <span className="logo-heart" aria-hidden="true">
          <IconHeart className="icon" />
        </span>
      </span>
    </div>
  );
}

export function NameField() {
  const name = useStore((s) => s.settings.name);
  return (
    <div className="field">
      <label htmlFor="name">¿Cómo te llamás? (opcional)</label>
      <input
        id="name"
        className="input"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="nickname"
        placeholder="Tu nombre o apodo"
        onChange={(e) => {
          const settings = { ...store.get().settings, name: e.target.value };
          store.set({ settings });
          saveSettings(settings);
        }}
      />
    </div>
  );
}

export function Home() {
  const busy = useStore((s) => s.busy);
  const notice = useStore((s) => s.notice);
  const connection = useStore((s) => s.connection);
  const name = useStore((s) => s.settings.name);
  const [resumable] = useState(() => net.resumableSession());

  const create = async (): Promise<void> => {
    void audio.unlock();
    audio.play('click');
    await net.createRoom(name.trim());
  };

  return (
    <main className="screen">
      <div className="screen-inner">
        <Logo />
        <div className="card stack">
          <p className="center" style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>
            Un juego para jugar en pareja, <b>cada quien desde su celular</b>. Carreras, cooperación y preguntas para conocerse.
          </p>
          <NameField />
          <button className="btn block" onClick={() => void create()} disabled={busy}>
            <IconPlay /> {busy ? 'Creando sala…' : 'Crear partida'}
          </button>
          <button
            className="btn secondary block"
            onClick={() => {
              void audio.unlock();
              audio.play('click');
              store.set({ view: 'join', notice: null });
            }}
          >
            <IconUsers /> Unirme con un código
          </button>
          {resumable ? (
            <button
              className="btn ghost block"
              onClick={() => {
                void audio.unlock();
                net.resume(resumable);
                store.set({ view: 'room' });
              }}
            >
              Volver a mi sala {formatRoomCode(resumable.code)}
            </button>
          ) : null}
          {notice ? (
            <p className="center" role="alert" style={{ color: 'var(--warn)', margin: 0 }}>
              {notice}
            </p>
          ) : null}
          {connection === 'reconnecting' || connection === 'connecting' ? (
            <p className="center muted small" style={{ margin: 0 }}>
              Conectando con el servidor… (si estuvo dormido puede tardar unos segundos)
            </p>
          ) : null}
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn ghost small" onClick={() => store.set({ view: 'profile' })}>
            <IconTrophy /> Logros
          </button>
          <button className="btn ghost small" onClick={() => store.set({ view: 'settings' })}>
            <IconGear /> Ajustes
          </button>
        </div>
        <p className="center muted small" style={{ margin: 0 }}>
          Sin registro. Sin anuncios. Para jugar, compartan el enlace de la sala.
        </p>
      </div>
    </main>
  );
}
