import { useEffect, useRef, useState } from 'react';
import type { RoomState } from '@duo/shared';
import { audio } from '../../audio';
import { net } from '../../net/NetClient';
import { useStore } from '../../state/store';
import { useServerCountdown } from '../common';

const AUTOPILOT = import.meta.env.VITE_E2E === '1' && new URLSearchParams(window.location.search).get('autopilot') === '1';

function TimerRing({ left, total }: { left: number; total: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(1, left / total));
  const color = left < 5 ? '#ff5d6c' : left < 10 ? '#ffc65c' : '#6fe3a5';
  return (
    <svg className="timer-ring" viewBox="0 0 46 46" role="timer" aria-label={`${Math.ceil(left)} segundos`}>
      <circle cx="23" cy="23" r={r} fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
      <circle
        cx="23"
        cy="23"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - k)}
        transform="rotate(-90 23 23)"
      />
      <text x="23" y="28" textAnchor="middle" fontFamily="Fredoka" fontWeight="700" fontSize="15" fill="#fff6e8">
        {Math.ceil(left)}
      </text>
    </svg>
  );
}

export function QuizPanel({ room }: { room: RoomState }) {
  const quiz = useStore((s) => s.quiz);
  const session = useStore((s) => s.session);
  const me = session?.slot ?? 0;
  const q = quiz.question;
  const reveal = quiz.reveal && q && quiz.reveal.q === q.index ? quiz.reveal : null;
  const left = useServerCountdown(q && !reveal ? q.deadline : null);
  const [picked, setPicked] = useState<number | null>(null);
  const lastQ = useRef(-1);
  const ticked = useRef(-1);
  const names = [room.players[0]?.name ?? '', room.players[1]?.name ?? ''];

  useEffect(() => {
    if (!q) return;
    if (q.index !== lastQ.current || q.replaced) {
      lastQ.current = q.index;
      setPicked(q.mine);
    }
  }, [q]);

  useEffect(() => {
    if (left !== null && left > 0 && left < 5.5) {
      const s = Math.ceil(left);
      if (s !== ticked.current) {
        ticked.current = s;
        audio.play('tick', { volume: 0.5 });
      }
    }
  }, [left]);

  useEffect(() => {
    if (!reveal) return;
    audio.play('reveal');
    const t = setTimeout(() => audio.play(reveal.outcome === 'match' ? 'correct' : reveal.outcome === 'miss' ? 'wrong' : 'skip'), 450);
    return () => clearTimeout(t);
  }, [reveal]);

  // Piloto automático (solo builds E2E): responde al azar tras una pausa breve.
  useEffect(() => {
    if (!AUTOPILOT || !q || reveal || q.answered[me]) return;
    const t = setTimeout(() => {
      const choice = Math.floor(Math.random() * q.options.length);
      setPicked(choice);
      net.answer(q.index, choice);
    }, 400 + Math.random() * 600);
    return () => clearTimeout(t);
  }, [q, reveal, me]);

  if (room.phase === 'countdown' || !q) {
    return (
      <div className="quiz">
        <div className="quiz-card center">
          <h2 style={{ margin: '0 0 6px' }}>¿Cuánto me conocés?</h2>
          <p className="muted" style={{ margin: 0 }}>
            Respondan en secreto. Las respuestas se revelan al mismo tiempo. Si una pregunta no les gusta, tóquen “Pasar”: no resta puntos.
          </p>
        </div>
      </div>
    );
  }

  const answeredMe = q.answered[me] || picked !== null;
  const otherAnswered = q.answered[me === 0 ? 1 : 0];
  const roleText =
    q.role === 'subject'
      ? 'Respondé sobre vos'
      : q.role === 'guesser'
        ? `Adiviná qué respondió ${names[q.about ?? 0]}`
        : q.kind === 'whoMore'
          ? 'Elijan a la misma persona'
          : 'Telepatía: elijan lo mismo sin hablar';

  return (
    <div className="quiz">
      <div className="quiz-card" key={`${q.index}-${q.replaced ? 'r' : ''}`} data-testid="quiz-card">
        <div className="quiz-meta">
          <span className="chip">
            Pregunta {q.index + 1} de {q.total}
            {q.romance ? ' · romántica' : ''}
          </span>
          {!reveal && left !== null ? <TimerRing left={left} total={20} /> : null}
        </div>
        <div className="quiz-role">{roleText}</div>
        <div className="quiz-prompt" data-testid="quiz-prompt">
          {q.prompt}
        </div>
        {reveal ? (
          <div className="quiz-result" data-testid="quiz-reveal">
            {reveal.line}
            {reveal.points[me] > 0 ? <div className="small" style={{ color: 'var(--gold)' }}>+{reveal.points[me]} puntos</div> : null}
          </div>
        ) : null}
        <div className="quiz-options" role="group" aria-label="Opciones">
          {q.options.map((opt, i) => {
            let cls = '';
            if (reveal) {
              const a = reveal.answers[0] === i;
              const b = reveal.answers[1] === i;
              cls = a && b ? 'reveal-ab' : a ? 'reveal-a' : b ? 'reveal-b' : '';
            }
            return (
              <button
                key={i}
                className={`quiz-opt ${cls}`}
                aria-pressed={picked === i}
                disabled={answeredMe || !!reveal}
                data-testid={`quiz-opt-${i}`}
                onClick={() => {
                  if (answeredMe) return;
                  setPicked(i);
                  audio.play('answer');
                  net.answer(q.index, i);
                }}
              >
                {opt}
                {reveal && (reveal.answers[0] === i || reveal.answers[1] === i) ? (
                  <span className="who" aria-hidden="true">
                    {reveal.answers[0] === i ? <span style={{ background: 'var(--coral)' }} /> : null}
                    {reveal.answers[1] === i ? <span style={{ background: 'var(--lavender)' }} /> : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="muted small" aria-live="polite">
            {reveal
              ? `${names[0]}: ${reveal.totals[0]} · ${names[1]}: ${reveal.totals[1]}`
              : answeredMe
                ? otherAnswered
                  ? '¡Listo! Revelando…'
                  : `Esperando a ${names[me === 0 ? 1 : 0]}…`
                : otherAnswered
                  ? `${names[me === 0 ? 1 : 0]} ya respondió`
                  : ' '}
          </span>
          {!reveal ? (
            <button
              className="btn ghost small"
              onClick={() => {
                audio.play('skip');
                net.skip(q.index);
              }}
              aria-label="Pasar esta pregunta"
            >
              Pasar{q.replacementsLeft > 0 ? ` (${q.replacementsLeft})` : ''}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
