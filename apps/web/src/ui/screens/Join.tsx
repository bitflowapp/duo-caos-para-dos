import { useState } from 'react';
import { formatRoomCode, normalizeRoomCode } from '@duo/shared';
import { audio } from '../../audio';
import { net } from '../../net/NetClient';
import { store, useStore } from '../../state/store';
import { IconBack, IconUsers } from '../icons';
import { Logo, NameField } from './Home';

export function Join() {
  const invite = useStore((s) => s.inviteCode);
  const busy = useStore((s) => s.busy);
  const notice = useStore((s) => s.notice);
  const name = useStore((s) => s.settings.name);
  const [code, setCode] = useState(invite ? formatRoomCode(invite) : '');
  const valid = normalizeRoomCode(code) !== null;

  const join = async (): Promise<void> => {
    void audio.unlock();
    audio.play('click');
    const ok = await net.joinRoom(code, name.trim());
    if (ok) store.set({ inviteCode: null });
  };

  return (
    <main className="screen">
      <div className="screen-inner">
        <Logo />
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !busy) void join();
          }}
        >
          <h2 style={{ margin: 0 }}>{invite ? '¡Te invitaron a jugar!' : 'Unirme a una sala'}</h2>
          <div className="field">
            <label htmlFor="code">Código de sala</label>
            <input
              id="code"
              className="input code"
              value={code}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              maxLength={12}
              placeholder="ABCD-EFGH"
              aria-invalid={code.length > 0 && !valid}
              onChange={(e) => {
                const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                setCode(raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw);
              }}
            />
          </div>
          <NameField />
          <button className="btn block" type="submit" disabled={!valid || busy}>
            <IconUsers /> {busy ? 'Entrando…' : 'Unirme'}
          </button>
          {notice ? (
            <p className="center" role="alert" style={{ color: 'var(--warn)', margin: 0 }}>
              {notice}
            </p>
          ) : null}
          <button
            type="button"
            className="btn ghost block"
            onClick={() => {
              history.replaceState(null, '', '#/');
              store.set({ view: 'home', inviteCode: null, notice: null });
            }}
          >
            <IconBack /> Volver
          </button>
        </form>
      </div>
    </main>
  );
}
