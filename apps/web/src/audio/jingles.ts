// Jingles (remates musicales cortos, 1.5–4 s). Composiciones originales,
// escritas con la misma notación que los temas para validarlas en tests.
import { drum, mel } from './score';
import type { TrackDef } from './score';

export type JingleKind = 'victory' | 'defeat' | 'tie' | 'tourWin' | 'achievement';

export const JINGLE_KINDS: readonly JingleKind[] = ['victory', 'defeat', 'tie', 'tourWin', 'achievement'];

/** Victoria: fanfarria brillante en Do mayor (C – F – G – C). ~3 s */
const victory: TrackDef = {
  id: 'jingle:victory',
  title: '¡Ganaste!',
  bpm: 160,
  key: 'Do mayor',
  echo: { steps: 3, feedback: 0.25, wet: 0.18 },
  voices: [
    { name: 'lead', inst: 'lead', gain: 0.5, lowpass: 3600, echo: 0.2 },
    { name: 'brass', inst: 'brass', gain: 0.55, pan: -0.2 },
    { name: 'bass', inst: 'bass', gain: 0.55, opts: { wave: 'sawtooth', cutoff: 900 } },
    { name: 'bell', inst: 'bell', gain: 0.35, pan: 0.3, echo: 0.4 },
    { name: 'kit', inst: 'drums', gain: 0.55 },
    { name: 'crash', inst: 'drums', gain: 0.32, pan: 0.2 },
  ],
  sections: [
    {
      name: 'V',
      bars: 2,
      parts: {
        lead: mel('C5:1 E5:1 G5:1 C6:3 r:2 A5:1 B5:1 C6:2 D6:2 E6:10 r:8', 'victory.lead'),
        brass: mel('C4+E4+G4:3! r:3 F4+A4+C5:2 G4+B4+D5:4 r:2 C4+E4+G4+C5:10! r:8', 'victory.brass'),
        bass: mel('C3:3 r:3 F2:2 G2:4 r:2 C3:10 r:8', 'victory.bass'),
        bell: mel('r:14 C6:1? E6:1? G6:1? C7:1? E7:6 r:8', 'victory.bell'),
        kit: drum('K.....S.K...sSK. ................', 'victory.kit'),
        crash: drum('..............X. ................', 'victory.crash'),
      },
    },
  ],
  order: [0],
  loop: false,
};

/** Derrota: cómica y tierna (C – Fm6, "¡la próxima!"), sin dramatismo. ~2.4 s */
const defeat: TrackDef = {
  id: 'jingle:defeat',
  title: 'La próxima será',
  bpm: 100,
  key: 'Do mayor con iv menor',
  echo: { steps: 3, feedback: 0.25, wet: 0.2 },
  voices: [
    { name: 'melody', inst: 'flute', gain: 0.6, pan: 0.1, echo: 0.25 },
    { name: 'ep', inst: 'ep', gain: 0.4, pan: -0.15 },
    { name: 'bass', inst: 'bass', gain: 0.55 },
    { name: 'kit', inst: 'drums', gain: 0.4 },
  ],
  sections: [
    {
      name: 'D',
      bars: 1,
      parts: {
        melody: mel('E5:2 D5:2 C5:2 G4:2 Ab4:4 G4:4', 'defeat.melody'),
        ep: mel('E3+G3+C4:8 F3+Ab3+D4:8', 'defeat.ep'),
        bass: mel('C3:8 F2:4 C2:4', 'defeat.bass'),
        kit: drum('k.......k...d...', 'defeat.kit'),
      },
    },
  ],
  order: [0],
  loop: false,
};

/** Empate: pregunta (izquierda) y respuesta (derecha) que terminan juntas en IV–I. ~2 s */
const tie: TrackDef = {
  id: 'jingle:tie',
  title: 'Empate',
  bpm: 120,
  key: 'Do mayor',
  echo: { steps: 3, feedback: 0.3, wet: 0.2 },
  voices: [
    { name: 'left', inst: 'pizz', gain: 0.6, pan: -0.5, echo: 0.2 },
    { name: 'right', inst: 'bell', gain: 0.5, pan: 0.5, echo: 0.3 },
    { name: 'ep', inst: 'ep', gain: 0.35 },
    { name: 'kit', inst: 'drums', gain: 0.4 },
  ],
  sections: [
    {
      name: 'T',
      bars: 1,
      parts: {
        left: mel('C5:1 E5:1 G5:2 r:4 F5:4 E5:4', 'tie.left'),
        right: mel('r:4 G5:1 E5:1 C5:2 A5:4 G5:4', 'tie.right'),
        ep: mel('C3+G3+E4:8 F3+A3+C4:4 E3+G3+C4:4', 'tie.ep'),
        kit: drum('K..k....m.m.M...', 'tie.kit'),
      },
    },
  ],
  order: [0],
  loop: false,
};

/** Gira ganada: redoble creciente y fanfarria grande con campanas. ~3.6 s */
const tourWin: TrackDef = {
  id: 'jingle:tourWin',
  title: '¡Campeones del Caos!',
  bpm: 132,
  key: 'Do mayor',
  echo: { steps: 3, feedback: 0.3, wet: 0.2 },
  voices: [
    { name: 'lead', inst: 'lead', gain: 0.5, lowpass: 3800, echo: 0.2 },
    { name: 'brass', inst: 'brass', gain: 0.58, pan: -0.2 },
    { name: 'bass', inst: 'bass', gain: 0.55, opts: { wave: 'sawtooth', cutoff: 900 } },
    { name: 'bell', inst: 'bell', gain: 0.35, pan: 0.3, echo: 0.4 },
    { name: 'roll', inst: 'drums', gain: 0.4, pan: 0.1 },
    { name: 'kick', inst: 'drums', gain: 0.55 },
    { name: 'crash', inst: 'drums', gain: 0.32, pan: -0.2 },
  ],
  sections: [
    {
      name: 'W',
      bars: 2,
      parts: {
        lead: mel('r:8 G4:2 A4:2 B4:2 D5:2 | C5:2 E5:2 G5:2 C6:2 E6:8', 'tourWin.lead'),
        brass: mel('r:8 G3+B3+D4:8 | C4+E4+G4:2! r:2 C4+E4+G4:2 r:2 C4+E4+G4+C5:8!', 'tourWin.brass'),
        bass: mel('r:8 G2:8 | C3:2 r:2 C3:2 r:2 C2:8', 'tourWin.bass'),
        bell: mel('r:16 | r:8 C6:1? E6:1? G6:1? C7:1? E7:4', 'tourWin.bell'),
        roll: drum('ssssssssSSSSSSSS | ....s.s.........', 'tourWin.roll'),
        kick: drum('................ | K...K...K.......', 'tourWin.kick'),
        crash: drum('................ | X.......X.......', 'tourWin.crash'),
      },
    },
  ],
  order: [0],
  loop: false,
};

/** Logro: arpegio de campanas ascendente con chispa. ~1.6 s */
const achievement: TrackDef = {
  id: 'jingle:achievement',
  title: '¡Logro!',
  bpm: 150,
  key: 'Do mayor',
  echo: { steps: 3, feedback: 0.3, wet: 0.25 },
  voices: [
    { name: 'bell', inst: 'bell', gain: 0.45, pan: 0.2, echo: 0.4 },
    { name: 'pluck', inst: 'pluck', gain: 0.4, pan: -0.2, opts: { wave: 'triangle' } },
    { name: 'kit', inst: 'drums', gain: 0.3, pan: 0.3 },
  ],
  sections: [
    {
      name: 'L',
      bars: 1,
      parts: {
        bell: mel('C6:1 E6:1 G6:1 C7:3 G6:1? C7:1 E7:8', 'achievement.bell'),
        pluck: mel('C5+E5+G5:4 r:2 C5+F5+A5:2 C5+E5+G5:8', 'achievement.pluck'),
        kit: drum('m.m.M...........', 'achievement.kit'),
      },
    },
  ],
  order: [0],
  loop: false,
};

export const JINGLES: Readonly<Record<JingleKind, TrackDef>> = { victory, defeat, tie, tourWin, achievement };
