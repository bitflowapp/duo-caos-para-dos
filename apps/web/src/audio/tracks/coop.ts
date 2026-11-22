// "Templo Sincronizado" — tema del puzzle cooperativo. Composición original.
// 108 BPM, Re dórico (Dm7 – G con Si natural). Pregunta y respuesta entre dos voces:
// pizzicato a la izquierda (jugador A) y campana a la derecha (jugador B).
// En A se responden cada dos compases; en B cada medio compás ("sincronizados").
// Intensidad 1: shaker en semicorcheas. Intensidad 2: pulso de pizzicato en corcheas.
import { drum, mel, rep } from '../score';
import type { TrackDef } from '../score';

const BASS = {
  Dm: 'D3:4 A2:4 D3:4 C3:4',
  G: 'G2:4 D3:4 B2:4 D3:4',
  Bb: 'Bb2:4 F2:4 Bb2:4 A2:4',
  C: 'C3:4 G2:4 C3:4 E3:4',
  F: 'F2:4 C3:4 F2:4 E2:4',
  CE: 'E2:4 G2:4 C3:4 G2:4',
  FA: 'A2:4 C3:4 F3:4 C3:4',
  Gm: 'G2:4 D3:4 Bb2:4 D3:4',
  A7: 'A2:4 E3:4 A2:4 C#3:4',
};

/** Pulso de corcheas alternando dos notas durante un compás. */
const pulse = (a: string, b: string): string => rep(`${a}:2? ${b}:2?`, 4);

const KICK = rep('K.....k...k.....', 4);
const WOOD = rep('....w..v....w.v.', 4);
const SHAKER = rep('M.m.m.m.M.m.m.m.', 4);
const SHAKER16 = rep('.m.m.m.m.m.m.m.m', 4);
const RIM = rep('....r.......r...', 4);

export const COOP_TRACK: TrackDef = {
  id: 'coop',
  title: 'Templo Sincronizado',
  bpm: 108,
  key: 'Re dórico',
  swing: { amount: 0.1, unit: 16 },
  echo: { steps: 3, feedback: 0.35, wet: 0.25 },
  voices: [
    { name: 'callA', inst: 'pizz', gain: 0.6, pan: -0.45, echo: 0.25 },
    { name: 'callB', inst: 'bell', gain: 0.55, pan: 0.45, echo: 0.3, opts: { decay: 0.6 } },
    { name: 'bass', inst: 'pizz', gain: 0.7, opts: { decay: 1.2 } },
    { name: 'pad', inst: 'pad', gain: 0.2, lowpass: 1400 },
    { name: 'kick', inst: 'drums', gain: 0.45 },
    { name: 'wood', inst: 'drums', gain: 0.36, pan: 0.2 },
    { name: 'shaker', inst: 'drums', gain: 0.28, pan: -0.2 },
    { name: 'rim', inst: 'drums', gain: 0.32, pan: 0.1 },
    { name: 'bongo', inst: 'drums', gain: 0.36, pan: -0.35 },
    { name: 'shaker16', inst: 'drums', gain: 0.22, pan: 0.3, layer: 1 },
    { name: 'pulse', inst: 'pizz', gain: 0.3, pan: 0.15, layer: 2, opts: { decay: 0.6 } },
  ],
  sections: [
    {
      name: 'A',
      bars: 4,
      parts: {
        callA: mel(
          'D5:2 A4:2 C5:2 A4:2 F4:2 G4:2 A4:4 | B4:2 G4:2 A4:2 B4:2 D5:4 r:4 | r:16 | r:16',
          'coop.A.callA',
        ),
        callB: mel(
          'r:16 | r:16 | r:4 F5:2 E5:2 D5:2 C5:2 A4:4 | B4:2 C5:2 D5:2 B4:2 G4:4 r:4',
          'coop.A.callB',
        ),
        bass: mel(`${BASS.Dm} | ${BASS.G} | ${BASS.Dm} | ${BASS.G}`, 'coop.A.bass'),
        pulse: mel(`${pulse('D5', 'A5')} | ${pulse('D5', 'B5')} | ${pulse('D5', 'A5')} | ${pulse('D5', 'B5')}`, 'coop.A.pulse'),
        kick: drum(KICK),
        wood: drum(WOOD),
        shaker: drum(SHAKER),
        shaker16: drum(SHAKER16),
      },
    },
    {
      name: 'A2',
      bars: 4,
      parts: {
        callA: mel(
          'D5:2 A4:2 C5:2 A4:2 F5:2 E5:2 D5:4 | B4:2 D5:2 G5:2 F5:2 E5:4 r:4 | r:16 | r:16',
          'coop.A2.callA',
        ),
        callB: mel(
          'r:16 | r:16 | r:4 D5:2 F5:2 A5:4 G5:2 F5:2 | E5:2 G5:2 C5:2 E5:2 D5:4 r:4',
          'coop.A2.callB',
        ),
        bass: mel(`${BASS.Dm} | ${BASS.G} | ${BASS.Bb} | ${BASS.C}`, 'coop.A2.bass'),
        pulse: mel(`${pulse('D5', 'A5')} | ${pulse('D5', 'B5')} | ${pulse('D5', 'F5')} | ${pulse('E5', 'G5')}`, 'coop.A2.pulse'),
        kick: drum(KICK),
        wood: drum(WOOD),
        shaker: drum(SHAKER),
        shaker16: drum(SHAKER16),
      },
    },
    {
      name: 'B',
      bars: 4,
      parts: {
        callA: mel(
          `C5:2 E5:2 F5:2 A5:2 r:8 | G4:2 C5:2 E5:2 G5:2 r:8 |
           A4:2 D5:2 F5:2 A5:2 r:8 | B4:2 D5:2 G5:2 B5:2 r:8`,
          'coop.B.callA',
        ),
        callB: mel(
          `r:8 G5:2 E5:2 C5:4 | r:8 F5:2 E5:2 D5:2 C5:2 |
           r:8 G5:2 F5:2 E5:2 C5:2 | r:8 A5:2 G5:2 D5:4`,
          'coop.B.callB',
        ),
        bass: mel(`${BASS.F} | ${BASS.CE} | ${BASS.Dm} | ${BASS.G}`, 'coop.B.bass'),
        pad: mel('A3+C4+E4:16 | G3+C4+E4:16 | A3+C4+F4:16 | B3+D4+G4:16', 'coop.B.pad'),
        pulse: mel(`${pulse('F5', 'C6')} | ${pulse('E5', 'C6')} | ${pulse('D5', 'A5')} | ${pulse('D5', 'B5')}`, 'coop.B.pulse'),
        kick: drum(KICK),
        wood: drum(WOOD),
        shaker: drum(SHAKER),
        rim: drum(RIM),
        shaker16: drum(SHAKER16),
      },
    },
    {
      name: 'B2',
      bars: 4,
      parts: {
        callA: mel(
          `Bb4:2 D5:2 F5:2 A5:2 r:8 | A4:2 C5:2 F5:2 A5:2 r:8 |
           G4:2 Bb4:2 D5:2 F5:2 r:8 | A4:2 D5:2 E5:2 G5:2 r:8`,
          'coop.B2.callA',
        ),
        callB: mel(
          `r:8 G5:2 F5:2 D5:4 | r:8 G5:2 F5:2 C5:4 |
           r:8 E5:2 D5:2 Bb4:4 | r:8 C#5:2 E5:2 A5:4`,
          'coop.B2.callB',
        ),
        bass: mel(`${BASS.Bb} | ${BASS.FA} | ${BASS.Gm} | ${BASS.A7}`, 'coop.B2.bass'),
        pad: mel('A3+D4+F4:16 | A3+C4+F4:16 | Bb3+D4+F4:16 | A3+D4+E4:8 G3+C#4+E4:8', 'coop.B2.pad'),
        pulse: mel(`${pulse('D5', 'F5')} | ${pulse('C5', 'F5')} | ${pulse('D5', 'G5')} | ${pulse('E5', 'A5')}`, 'coop.B2.pulse'),
        kick: drum(KICK),
        wood: drum(WOOD),
        shaker: drum(SHAKER),
        rim: drum(RIM),
        bongo: drum(`${rep('..g...n...g.g.n.', 3)} ..g...n.g.g.nnnn`),
        shaker16: drum(SHAKER16),
      },
    },
  ],
  order: [0, 1, 2, 3],
  loop: true,
};
