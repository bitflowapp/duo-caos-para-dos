import { useEffect, useState } from 'react';
import { EMOTE_IDS, EMOTES, type EmoteId, type RoomState } from '@duo/shared';
import { audio } from '../audio';
import { net } from '../net/NetClient';
import { saveSettings } from '../persistence/settings';
import { store, useStore } from '../state/store';
import { EmoteIcon, IconGear, IconMute, IconSound } from './icons';

export function ConnectionBadge({ room }: { room: RoomState }) {
  const connection = useStore((s) => s.connection);
  const rtt = useStore((s) => s.rtt);
  const session = useStore((s) => s.session);
  const me = session?.slot ?? 0;
  const partner = room.players[me === 0 ? 1 : 0];
  const myClass = connection === 'online' ? '' : connection === 'reconnecting' || connection === 'connecting' ? 'warn' : 'bad';
  const myText =
    connection === 'online' ? (rtt !== null ? `${rtt} ms` : 'En línea') : connection === 'reconnecting' ? 'Reconectando…' : 'Sin conexión';
  return (
    <div className="row" style={{ gap: 6 }}>
      <span className={`chip ${myClass}`} title="Tu conexión">
        <span className="dot" />
        {myText}
      </span>
      {partner ? (
        <span className={`chip ${partner.connected ? '' : 'warn'}`} title="Conexión de tu pareja">
          <span className="dot" />
          {partner.connected ? partner.name : `${partner.name}: reconectando`}
        </span>
      ) : null}
    </div>
  );
}

export function TopActions({ compact }: { compact?: boolean }) {
  const muted = useStore((s) => s.settings.muted);
  return (
    <div className="row" style={{ gap: 6 }}>
      <button
        className="icon-btn"
        aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        aria-pressed={muted}
        onClick={() => {
          const settings = { ...store.get().settings, muted: !muted };
          store.set({ settings });
          saveSettings(settings);
          audio.setMuted(settings.muted);
          void audio.unlock();
        }}
      >
        {muted ? <IconMute /> : <IconSound />}
      </button>
      {!compact ? (
        <button className="icon-btn" aria-label="Ajustes" onClick={() => store.set({ view: 'settings' })}>
          <IconGear />
        </button>
      ) : null}
    </div>
  );
}

export function EmoteBar() {
  const [cool, setCool] = useState(false);
  return (
    <div className="emote-bar" role="group" aria-label="Reacciones">
      {EMOTE_IDS.map((id) => (
        <button
          key={id}
          className="emote-btn"
          aria-label={EMOTES[id].label}
          disabled={cool}
          onClick={() => {
            net.emote(id);
            audio.play('emote');
            setCool(true);
            setTimeout(() => setCool(false), 700);
          }}
        >
          <EmoteIcon id={id} />
        </button>
      ))}
    </div>
  );
}

/** Emotes flotantes (los propios y los de la pareja). */
export function EmoteFloats() {
  const last = useStore((s) => s.lastEmote);
  const session = useStore((s) => s.session);
  const [items, setItems] = useState<Array<{ key: number; id: EmoteId; left: boolean }>>([]);
  useEffect(() => {
    if (!last) return;
    const key = last.at;
    const left = last.slot === (session?.slot ?? 0);
    setItems((arr) => [...arr.slice(-5), { key, id: last.id as EmoteId, left }]);
    if (last.slot !== session?.slot) audio.play('pop');
    const t = setTimeout(() => setItems((arr) => arr.filter((x) => x.key !== key)), 1900);
    return () => clearTimeout(t);
  }, [last, session?.slot]);
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 25 }}>
      {items.map((it) => (
        <div key={it.key} className="emote-float" style={{ left: it.left ? '18%' : '68%', bottom: '24%' }}>
          <EmoteIcon id={it.id} />
        </div>
      ))}
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Segundos restantes hasta una hora del servidor (para cuentas regresivas). */
export function useServerCountdown(target: number | null): number | null {
  const [now, setNow] = useState(() => net.serverNow());
  useEffect(() => {
    if (target === null) return;
    const id = setInterval(() => setNow(net.serverNow()), 100);
    return () => clearInterval(id);
  }, [target]);
  if (target === null) return null;
  return Math.max(0, (target - now) / 1000);
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
