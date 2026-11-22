import { ACCESSORIES, MODES, type MatchResult, type RoomState } from '@duo/shared';
import { accessoryIconSvg } from '../../game/art/accessories';
import { ACHIEVEMENTS } from '../../persistence/profile';
import { audio } from '../../audio';
import { net } from '../../net/NetClient';
import { useStore } from '../../state/store';
import { EmoteBar, formatTime } from '../common';
import { IconRefresh, IconStar } from '../icons';
import { Portrait } from '../Portrait';

function Details({ result, names }: { result: MatchResult; names: [string, string] }) {
  const d = result.details;
  if (d.kind === 'race') {
    const t = (v: number | null): string => (v === null ? 'No llegó' : `${(v / 60).toFixed(2)} s`);
    return (
      <div className="stack" style={{ gap: 2 }}>
        {[0, 1].map((i) => (
          <div key={i} className="stat-line">
            <span>{names[i as 0 | 1]}</span>
            <span>
              {t(d.finishTicks[i as 0 | 1])} · {d.hearts[i as 0 | 1]} corazones · {d.hits[i as 0 | 1]} golpes · {d.falls[i as 0 | 1]} caídas
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (d.kind === 'coop') {
    return (
      <div className="stack" style={{ gap: 6 }}>
        <div className="stars" aria-label={`${d.stars} de 3 estrellas`}>
          {[1, 2, 3].map((i) => (
            <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2.5l2.8 6 6.5.6-4.9 4.3 1.5 6.4L12 16.5 6.1 19.8l1.5-6.4L2.7 9.1l6.5-.6z"
                fill={i <= d.stars ? '#ffd25e' : 'rgba(255,255,255,0.15)'}
                stroke="#2b1650"
                strokeWidth="1.2"
              />
            </svg>
          ))}
        </div>
        <div className="stat-line">
          <span>Tiempo</span>
          <span>{formatTime(d.timeTicks / 60)}</span>
        </div>
        <div className="stat-line">
          <span>Salas superadas</span>
          <span>
            {d.roomsCleared} / {d.totalRooms}
          </span>
        </div>
        <div className="stat-line">
          <span>Chapuzones</span>
          <span>
            {names[0]}: {d.falls[0]} · {names[1]}: {d.falls[1]}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="center" style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 700, color: 'var(--gold)' }}>
        {d.syncPercent}% de sintonía
      </div>
      <div className="center" style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>
        {d.syncTitle}
      </div>
      <div className="stat-line">
        <span>Predicciones acertadas</span>
        <span>
          {names[0]}: {d.correct[0]} · {names[1]}: {d.correct[1]}
        </span>
      </div>
      <div className="stat-line">
        <span>Coincidencias de sintonía</span>
        <span>{d.matches}</span>
      </div>
      {d.skipped > 0 ? (
        <div className="stat-line">
          <span>Preguntas pasadas</span>
          <span>{d.skipped} (sin castigo)</span>
        </div>
      ) : null}
    </div>
  );
}

export function Results({ room }: { room: RoomState }) {
  const session = useStore((s) => s.session);
  const rewards = useStore((s) => s.rewards);
  const me = (session?.slot ?? 0) as 0 | 1;
  const other = me === 0 ? 1 : 0;
  const res = room.lastResult;
  const earned = rewards && res && rewards.matchId === res.id ? ACHIEVEMENTS.filter((a) => rewards.ids.includes(a.id)) : [];
  const tour = room.tour;
  const inTour = tour !== null && !tour.finished;
  const names: [string, string] = [room.players[0]?.name ?? 'Jugador 1', room.players[1]?.name ?? 'Jugador 2'];
  const partner = room.players[other];
  if (!res) return null;
  const myVoteKind = inTour ? 'next' : 'rematch';
  const myVote = room.votes[myVoteKind][me];
  const partnerVote = room.votes[myVoteKind][other];
  const coopOk = res.cooperative && res.details.kind === 'coop' && res.details.success;

  return (
    <main className="screen">
      <div className="screen-inner" style={{ paddingTop: 50 }}>
        <section className="card stack" aria-labelledby="res-title">
          <span className="muted small center" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
            {MODES[res.mode].name}
            {tour ? ` · Gira ${Math.min(tour.step, tour.order.length)}/${tour.order.length}` : ''}
          </span>
          <h1 id="res-title" className="result-head" data-testid="result-headline">
            {res.headline}
          </h1>
          <div className="score-cols">
            {[0, 1].map((i) => {
              const p = room.players[i as 0 | 1];
              const winner = res.cooperative ? coopOk : res.winner === i || res.winner === null;
              const happy = res.cooperative ? coopOk : res.winner === i || res.winner === null;
              return (
                <div key={i} className={`score-col${winner && !res.cooperative && res.winner === i ? ' winner' : ''}`}>
                  {p?.character ? (
                    <Portrait character={p.character} skin={p.skin} accessory={p.accessory} eyes={happy ? 'happy' : 'sad'} mouth={happy ? 'grin' : 'sad'} size={76} bob={happy} />
                  ) : null}
                  <div style={{ fontWeight: 800 }}>
                    {names[i as 0 | 1]}
                    {i === me ? ' (vos)' : ''}
                  </div>
                  <div className="pts">+{res.points[i as 0 | 1]}</div>
                </div>
              );
            })}
          </div>
          <Details result={res} names={names} />
        </section>

        {tour ? (
          <section className="card stack" aria-label="Gira por la Isla">
            <h3 style={{ margin: 0 }}>{tour.finished ? 'Copa de la Isla' : 'Gira por la Isla'}</h3>
            <div className="score-cols">
              {[0, 1].map((i) => (
                <div key={i} className={`score-col${tour.finished && tour.points[i as 0 | 1] > tour.points[(1 - i) as 0 | 1] ? ' winner' : ''}`}>
                  <div style={{ fontWeight: 800 }}>{names[i as 0 | 1]}</div>
                  <div className="pts">{tour.points[i as 0 | 1]}</div>
                </div>
              ))}
            </div>
            {tour.finished ? (
              <p className="center" style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>
                {tour.points[0] === tour.points[1]
                  ? '¡Empate! La copa se comparte (y el postre también).'
                  : `¡${names[tour.points[0] > tour.points[1] ? 0 : 1]} se lleva la Copa de la Isla!`}
              </p>
            ) : (
              <p className="muted center" style={{ margin: 0 }}>
                Próximo: {MODES[tour.order[tour.step] ?? 'race'].name}
              </p>
            )}
          </section>
        ) : null}

        <section className="card stack" aria-labelledby="rewards-title">
          <h3 id="rewards-title" style={{ margin: 0 }}>
            Recompensas
          </h3>
          <div className="row between small">
            <span>Tus puntos en esta partida</span>
            <b style={{ color: 'var(--gold)' }}>+{res.points[me]}</b>
          </div>
          {earned.length > 0 ? (
            earned.map((a) => (
              <div key={a.id} className="row" style={{ gap: 12 }} data-testid="reward">
                {a.unlocks ? (
                  <span className="acc" aria-hidden="true" style={{ width: 52, height: 52 }} dangerouslySetInnerHTML={{ __html: accessoryIconSvg(a.unlocks) }} />
                ) : null}
                <span>
                  <b>Logro: {a.name}</b>
                  <br />
                  <span className="muted small">
                    {a.description}
                    {a.unlocks ? ` · Desbloqueaste: ${ACCESSORIES[a.unlocks].name}` : ''}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <span className="muted small">Sigan jugando para desbloquear logros y accesorios nuevos.</span>
          )}
        </section>

        <section className="card tight stack" aria-label="Sesión">
          <div className="row between small">
            <span>
              Partidas: <b>{room.stats.played}</b>
            </span>
            <span>
              {names[0]} <b>{room.stats.wins[0]}</b> · {names[1]} <b>{room.stats.wins[1]}</b> · Empates <b>{room.stats.ties}</b> · En equipo{' '}
              <b>{room.stats.coopWins}</b>
            </span>
          </div>
          <div className="row between small">
            <span className="row" style={{ gap: 4 }}>
              <IconStar /> Corazones de la pareja
            </span>
            <b>{room.stats.totalPoints[0] + room.stats.totalPoints[1]}</b>
          </div>
        </section>

        <EmoteBar />

        <button
          className="btn gold block"
          style={{ minHeight: 64, fontSize: '1.3rem' }}
          disabled={myVote || !partner?.connected}
          onClick={() => {
            audio.play('ready');
            net.vote(myVoteKind);
          }}
          data-testid={inTour ? 'next' : 'rematch'}
        >
          <IconRefresh /> {inTour ? (myVote ? 'Esperando…' : 'Siguiente juego') : myVote ? 'Esperando…' : tour?.finished ? 'Otra gira' : '¡Revancha!'}
        </button>
        <p className="center muted" style={{ margin: 0 }} aria-live="polite">
          {!partner?.connected
            ? `${partner?.name ?? 'Tu pareja'} no está conectado/a ahora.`
            : partnerVote && !myVote
              ? `${partner.name} quiere ${inTour ? 'seguir' : 'la revancha'}. ¡Dale!`
              : myVote
                ? `Esperando a ${partner.name}…`
                : ' '}
        </p>
        <button
          className="btn ghost block"
          onClick={() => {
            audio.play('back');
            net.toLobby();
          }}
          data-testid="to-lobby"
        >
          Elegir otro juego
        </button>
      </div>
    </main>
  );
}
