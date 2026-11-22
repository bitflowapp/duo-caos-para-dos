import { useEffect, useRef, useState } from 'react';
import { CHARACTERS, MODES, type RoomState } from '@duo/shared';
import { audio } from '../../audio';
import { CHARACTER_COLOR } from '../../game/art/palette';
import { net } from '../../net/NetClient';
import { useHud } from '../../state/hud';
import { useStore } from '../../state/store';
import { formatTime, useServerCountdown } from '../common';
import { IconCount, IconHeart } from '../icons';
import { QuizPanel } from './QuizPanel';
import { CoopControls, RaceControls } from './TouchControls';

function Countdown({ target, label }: { target: number | null; label?: string }) {
  const left = useServerCountdown(target);
  const last = useRef(-1);
  const n = left === null ? null : Math.ceil(left);
  useEffect(() => {
    if (n === null || n === last.current) return;
    last.current = n;
    if (n > 0 && n <= 3) audio.play('countdown');
    if (n === 0) audio.play('go');
  }, [n]);
  if (left === null) return null;
  if (n !== null && n > 3) {
    return (
      <div className="banner" key="intro">
        {label ?? '¡Prepárense!'}
      </div>
    );
  }
  if (n === 0) return null;
  return (
    <div className="countdown-num" key={n} aria-live="assertive">
      {n}
    </div>
  );
}

function GoFlash() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 900);
    return () => clearTimeout(t);
  }, []);
  return show ? <div className="banner">¡YA!</div> : null;
}

function Banner() {
  const banner = useHud((h) => h.banner);
  if (!banner) return null;
  return (
    <div className={`banner ${banner.kind === 'chaos' ? 'chaos' : ''}`} key={banner.id} role="status">
      {banner.text}
      {banner.sub ? <span className="sub">{banner.sub}</span> : null}
    </div>
  );
}

function RaceHud({ room }: { room: RoomState }) {
  const progress = useHud((h) => h.progress);
  const place = useHud((h) => h.place);
  const hearts = useHud((h) => h.hearts);
  const finished = useHud((h) => h.finished);
  const elapsed = useHud((h) => h.elapsed);
  const session = useStore((s) => s.session);
  const game = useStore((s) => s.game);
  const me = session?.slot ?? 0;
  const color = (slot: 0 | 1): string => CHARACTER_COLOR[game?.characters[slot] ?? 'chispa'];
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="progress-track" role="progressbar" aria-label="Progreso de la carrera" aria-valuenow={Math.round(progress[me] * 100)}>
          {[0, 1].map((i) => (
            <span
              key={i}
              className={`progress-dot${i === me ? ' me' : ''}`}
              style={{ left: `${progress[i as 0 | 1] * 100}%`, background: color(i as 0 | 1) }}
              title={room.players[i as 0 | 1]?.name}
            />
          ))}
          <svg className="flag" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 21V3" stroke="#fff6e8" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M6 4h12l-3 4 3 4H6z" fill="#ff7a59" stroke="#2b1650" strokeWidth="1.4" />
          </svg>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="place" aria-label={`Puesto ${place}`}>
            {place}°
          </span>
          <span className="hud-pill">
            <IconHeart className="heart-ico" /> {hearts}
          </span>
          <span className="hud-pill">{formatTime(elapsed / 60)}</span>
        </div>
      </div>
      {finished ? (
        <div className="banner" style={{ top: '30%' }}>
          {finished.place === 1 ? '¡Primer puesto!' : '¡Llegaste!'}
          <span className="sub">esperando resultados…</span>
        </div>
      ) : null}
    </div>
  );
}

function CoopHud() {
  const rooms = useHud((h) => h.rooms);
  const total = useHud((h) => h.totalRooms);
  const timeLeft = useHud((h) => h.timeLeft);
  const hint = useHud((h) => h.hint);
  const syncCount = useHud((h) => h.syncCount);
  const armed = useHud((h) => h.consoleArmed);
  const synced = useHud((h) => h.synced);
  const left = useServerCountdown(syncCount ? syncCount.at + 3000 : null);
  const [hintOpen, setHintOpen] = useState(true);
  const lastHint = useRef<string | null>(null);
  useEffect(() => {
    if (hint !== lastHint.current) {
      lastHint.current = hint;
      setHintOpen(true);
      const t = setTimeout(() => setHintOpen(false), 9000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [hint]);
  const countN = left !== null && left > 0 ? Math.ceil(left) : null;
  useEffect(() => {
    if (countN !== null) audio.play(countN === 1 ? 'go' : 'countdown');
  }, [countN]);
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="hud-pill">
            Sala {Math.min(rooms + 1, total)}/{total}
          </span>
          <span className="hud-pill" style={{ color: timeLeft < 60 * 30 ? 'var(--danger)' : undefined }}>
            {formatTime(timeLeft / 60)}
          </span>
          {rooms >= 3 && !synced ? (
            <span className="hud-pill">
              Consolas: {armed[0] ? '●' : '○'} {armed[1] ? '●' : '○'}
            </span>
          ) : null}
        </div>
        {hint && hintOpen ? (
          <button className="hud-pill" style={{ pointerEvents: 'auto', border: 0, color: 'inherit', maxWidth: 520, textAlign: 'center' }} onClick={() => setHintOpen(false)}>
            {hint}
          </button>
        ) : hint ? (
          <button className="hud-pill" style={{ pointerEvents: 'auto', border: 0, color: 'inherit' }} onClick={() => setHintOpen(true)}>
            Pista
          </button>
        ) : null}
      </div>
      {rooms >= 3 && !synced ? (
        <button
          className="btn secondary small"
          style={{ position: 'absolute', top: 'calc(var(--safe-top) + 112px)', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto' }}
          onClick={() => net.count()}
          data-testid="coop-count"
        >
          <IconCount /> Contar 3, 2, 1
        </button>
      ) : null}
      {countN !== null ? (
        <div className="countdown-num" key={`c${countN}`}>
          {countN}
        </div>
      ) : left !== null && left <= 0 && left > -0.8 ? (
        <div className="banner">¡AHORA!</div>
      ) : null}
    </div>
  );
}

function PauseOverlay({ room }: { room: RoomState }) {
  const session = useStore((s) => s.session);
  const left = useServerCountdown(room.pause?.deadline ?? null);
  const resumeLeft = useServerCountdown(room.pause ? null : room.phaseEndsAt);
  const me = session?.slot ?? 0;
  if (!room.pause) {
    return resumeLeft !== null && resumeLeft > 0 ? (
      <div className="overlay" style={{ background: 'rgba(10,4,26,0.35)' }}>
        <div className="card">
          <h2 style={{ margin: 0 }}>¡Seguimos!</h2>
          <div className="countdown-num" style={{ position: 'static', transform: 'none', animation: 'none', fontSize: '5rem' }}>
            {Math.ceil(resumeLeft)}
          </div>
        </div>
      </div>
    ) : null;
  }
  const who = room.players[room.pause.slot];
  const isMe = room.pause.slot === me;
  return (
    <div className="overlay" role="alertdialog" aria-labelledby="pause-title">
      <div className="card stack">
        <h2 id="pause-title" style={{ margin: 0 }}>
          Partida en pausa
        </h2>
        <div className="spinner" />
        <p style={{ margin: 0 }}>
          {isMe ? 'Recuperando tu conexión…' : `${who?.name ?? 'Tu pareja'} perdió la conexión. Esperándole…`}
        </p>
        <p className="muted small" style={{ margin: 0 }}>
          {left !== null ? `Si no vuelve en ${Math.ceil(left)} s, la partida termina.` : ''}
        </p>
      </div>
    </div>
  );
}

function RotateHint() {
  const portrait = useHud((h) => h.portrait);
  const [dismissed, setDismissed] = useState(false);
  if (!portrait || dismissed) return null;
  return (
    <button className="rotate-hint" onClick={() => setDismissed(true)}>
      Girá el celular para ver más pista · ✕
    </button>
  );
}

export function GameOverlay({ room }: { room: RoomState }) {
  const game = useStore((s) => s.game);
  const mode = game?.mode ?? room.currentGame ?? 'race';
  const [wentLive, setWentLive] = useState(false);
  useEffect(() => {
    if (room.phase === 'playing' && !wentLive) setWentLive(true);
  }, [room.phase, wentLive]);
  const me = useStore((s) => s.session?.slot ?? 0);
  const myChar = game?.characters[me];

  return (
    <div className="screen passthrough" style={{ padding: 0 }}>
      {mode === 'race' ? <RaceHud room={room} /> : null}
      {mode === 'coop' ? <CoopHud /> : null}
      {mode === 'quiz' ? <QuizPanel room={room} /> : null}
      <div className="hud">
        <Banner />
        {room.phase === 'countdown' ? (
          <Countdown
            target={room.phaseEndsAt}
            label={`${MODES[mode].name}${myChar ? ` · sos ${CHARACTERS[myChar].name}` : ''}`}
          />
        ) : null}
        {room.phase === 'playing' && wentLive && mode !== 'quiz' ? <GoFlash key={room.matchId} /> : null}
      </div>
      {room.phase !== 'countdown' && mode === 'race' ? <RaceControls /> : null}
      {room.phase !== 'countdown' && mode === 'coop' ? <CoopControls /> : null}
      {mode !== 'quiz' ? <RotateHint /> : null}
      {room.phase === 'paused' ? <PauseOverlay room={room} /> : null}
    </div>
  );
}
