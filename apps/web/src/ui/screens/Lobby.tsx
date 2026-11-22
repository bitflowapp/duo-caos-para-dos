import { useMemo, useState } from 'react';
import {
  ACCESSORIES,
  ACCESSORY_IDS,
  CHARACTERS,
  CHARACTER_IDS,
  MODES,
  PLAY_MODES,
  SKIN_COUNT,
  formatRoomCode,
  type AccessoryId,
  type CharacterId,
  type PlayMode,
  type RoomState,
} from '@duo/shared';
import { audio } from '../../audio';
import { accessoryIconSvg } from '../../game/art/accessories';
import { SKINS } from '../../game/art/palette';
import { net } from '../../net/NetClient';
import { ACHIEVEMENTS, unlockedAccessories } from '../../persistence/profile';
import { toast, useStore } from '../../state/store';
import { EmoteBar } from '../common';
import { IconCopy, IconShare } from '../icons';
import { Portrait } from '../Portrait';

function inviteUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/sala/${formatRoomCode(code)}`;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function InviteCard({ room }: { room: RoomState }) {
  const url = inviteUrl(room.code);
  const share = async (): Promise<void> => {
    audio.play('click');
    if (navigator.share) {
      try {
        await navigator.share({ title: 'DUO — Caos para Dos', text: '¡Juguemos a DUO! Entrá a nuestra sala:', url });
        return;
      } catch {
        // cancelado: probamos copiar
      }
    }
    if (await copy(url)) toast('Enlace copiado. ¡Mandáselo a tu pareja!');
  };
  return (
    <section className="card stack" aria-labelledby="invite-title">
      <h2 id="invite-title" style={{ margin: 0 }}>
        Sala privada
      </h2>
      <div className="room-code" aria-label={`Código de sala ${formatRoomCode(room.code).split('').join(' ')}`} data-testid="room-code">
        {formatRoomCode(room.code)}
      </div>
      <div className="row">
        <button className="btn grow" onClick={() => void share()}>
          <IconShare /> Invitar
        </button>
        <button
          className="btn ghost"
          aria-label="Copiar código"
          onClick={async () => {
            if (await copy(formatRoomCode(room.code))) toast('Código copiado');
          }}
        >
          <IconCopy />
        </button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Tu pareja abre el enlace (o escribe el código) desde su celular. La sala es solo para ustedes dos.
      </p>
    </section>
  );
}

function PlayerCard({ room, slot, me }: { room: RoomState; slot: 0 | 1; me: 0 | 1 }) {
  const p = room.players[slot];
  if (!p) {
    return (
      <div className="player-card" aria-label="Lugar libre">
        <div className="empty-seat" aria-hidden="true">
          ?
        </div>
        <span className="name muted">Esperando…</span>
        <span className="badge-wait">Invitá a tu pareja</span>
      </div>
    );
  }
  return (
    <div className={`player-card${slot === me ? ' me' : ''}`} aria-label={`${p.name}${slot === me ? ' (vos)' : ''}`}>
      {p.character ? (
        <Portrait character={p.character} skin={p.skin} accessory={p.accessory} bob mouth={p.ready ? 'grin' : 'smile'} eyes={p.ready ? 'happy' : 'open'} />
      ) : (
        <div className="empty-seat" aria-hidden="true">
          …
        </div>
      )}
      <span className="name">
        {p.name}
        {slot === me ? ' (vos)' : ''}
      </span>
      <span className={p.ready ? 'badge-ready' : 'badge-wait'}>{!p.connected ? 'Reconectando…' : p.ready ? '¡Listo!' : p.character ? 'Eligiendo' : 'Sin personaje'}</span>
    </div>
  );
}

export function Lobby({ room }: { room: RoomState }) {
  const session = useStore((s) => s.session);
  const me = (session?.slot ?? 0) as 0 | 1;
  const mine = room.players[me];
  const partner = room.players[me === 0 ? 1 : 0];
  const unlocked = useMemo(() => unlockedAccessories(), []);
  const [showAll, setShowAll] = useState(false);

  const select = (character: CharacterId | null, skin = mine?.skin ?? 0, accessory: AccessoryId = mine?.accessory ?? 'none'): void => {
    audio.play('click');
    net.select(character, skin, accessory);
  };

  const myChar = mine?.character ?? null;
  const takenByPartner = partner?.character ?? null;
  const bothHere = !!partner;

  const statusText = !myChar
    ? 'Elegí un personaje para poder confirmar.'
    : !partner
      ? mine?.ready
        ? 'Listo. Falta tu pareja: mandale el enlace de arriba para que entre.'
        : 'Falta tu pareja: mandale el enlace de arriba. Mientras tanto, elegí y confirmá.'
      : mine?.ready && !partner.ready
        ? `Esperando a ${partner.name}…`
        : !mine?.ready && partner.ready
          ? `${partner.name} ya confirmó. ¡Dale!`
          : 'Cuando los dos confirmen, arranca la cuenta regresiva.';

  const onReady = (): void => {
    if (!myChar) {
      audio.play('back');
      toast('Elegí un personaje primero');
      document.getElementById('char-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    audio.play(mine?.ready ? 'unready' : 'ready');
    net.setReady(!mine?.ready);
  };

  return (
    <main className="screen">
      <div className="screen-inner" style={{ paddingTop: 48 }}>
        {!bothHere ? <InviteCard room={room} /> : null}

        <section className="card stack" aria-label="Jugadores">
          <div className="players">
            <PlayerCard room={room} slot={0} me={me} />
            <PlayerCard room={room} slot={1} me={me} />
          </div>
          {bothHere ? <EmoteBar /> : null}
        </section>

        <section className="card stack" aria-labelledby="char-title">
          <h3 id="char-title" style={{ margin: 0 }}>
            Elegí tu personaje
          </h3>
          <div className="tiles">
            {CHARACTER_IDS.map((id) => {
              const info = CHARACTERS[id];
              const taken = takenByPartner === id;
              return (
                <button
                  key={id}
                  className="tile"
                  aria-pressed={myChar === id}
                  disabled={taken}
                  onClick={() => select(id, myChar === id ? (mine?.skin ?? 0) : 0)}
                  data-testid={`pick-${id}`}
                >
                  <Portrait character={id} skin={myChar === id ? (mine?.skin ?? 0) : 0} accessory={myChar === id ? (mine?.accessory ?? 'none') : 'none'} size={84} />
                  {info.name}
                  <span className="tag">{taken ? `Elegido por ${partner?.name ?? 'tu pareja'}` : info.tagline}</span>
                </button>
              );
            })}
          </div>
          {myChar ? (
            <>
              <div className="swatches" role="group" aria-label="Apariencia">
                {Array.from({ length: SKIN_COUNT }, (_, i) => (
                  <button
                    key={i}
                    className="swatch"
                    aria-label={CHARACTERS[myChar].skins[i]}
                    aria-pressed={mine?.skin === i}
                    style={{ background: SKINS[myChar][i]?.base }}
                    onClick={() => select(myChar, i)}
                  />
                ))}
              </div>
              <div className="accessories" role="group" aria-label="Accesorio">
                {ACCESSORY_IDS.filter((a) => showAll || unlocked.has(a) || a === mine?.accessory).map((a) => {
                  const ok = unlocked.has(a);
                  const ach = ACHIEVEMENTS.find((x) => x.id === ACCESSORIES[a].unlockedBy);
                  return (
                    <button
                      key={a}
                      className="acc"
                      aria-pressed={mine?.accessory === a}
                      aria-label={ok ? ACCESSORIES[a].name : `${ACCESSORIES[a].name} (bloqueado: ${ach?.name ?? ''})`}
                      title={ok ? ACCESSORIES[a].name : `Se desbloquea con el logro “${ach?.name ?? ''}”`}
                      disabled={!ok}
                      onClick={() => select(myChar, mine?.skin ?? 0, a)}
                      dangerouslySetInnerHTML={{ __html: accessoryIconSvg(a) }}
                    />
                  );
                })}
                {!showAll ? (
                  <button className="chip-btn" style={{ flex: 'none' }} onClick={() => setShowAll(true)}>
                    Ver todos
                  </button>
                ) : null}
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                {CHARACTERS[myChar].personality}
              </p>
            </>
          ) : null}
        </section>

        <section className="card stack" aria-labelledby="mode-title">
          <h3 id="mode-title" style={{ margin: 0 }}>
            ¿A qué juegan?
          </h3>
          <div className="modes">
            {PLAY_MODES.map((m: PlayMode) => (
              <button
                key={m}
                className="mode"
                aria-pressed={room.mode === m}
                onClick={() => {
                  audio.play('click');
                  net.setMode(m);
                }}
                data-testid={`mode-${m}`}
              >
                <span className="k">
                  {MODES[m].kind} · {MODES[m].minutes}
                </span>
                <span className="t">{MODES[m].name}</span>
                <span className="d">{MODES[m].description}</span>
              </button>
            ))}
          </div>
          {room.mode === 'quiz' || room.mode === 'tour' ? (
            <label className="setting" style={{ borderBottom: 0, padding: '4px 0 0' }}>
              <span>
                <b>Incluir preguntas románticas</b>
                <br />
                <span className="muted small">Siempre se pueden pasar, sin castigo.</span>
              </span>
              <input
                type="checkbox"
                className="switch"
                checked={room.quizDeck === 'romance'}
                onChange={(e) => net.setMode(room.mode, e.target.checked ? 'romance' : 'light')}
              />
            </label>
          ) : null}
        </section>

        <button
          className="btn ghost small"
          onClick={() => {
            if (window.confirm('¿Salir de la sala? Tu pareja va a quedar esperando.')) net.leaveRoom();
          }}
        >
          Salir de la sala
        </button>
        <div className="action-bar">
          <p className="action-status" aria-live="polite" data-testid="ready-status">
            {statusText}
          </p>
          <button
            className={`btn block ${mine?.ready ? 'ghost' : 'mint'}`}
            style={{ minHeight: 64, fontSize: '1.3rem' }}
            aria-disabled={!myChar}
            onClick={onReady}
            data-testid="ready"
          >
            {mine?.ready ? 'Cancelar “listo”' : '¡Estoy listo!'}
          </button>
        </div>
      </div>
    </main>
  );
}
