// "Show de la Pareja" — tema del quiz. Composición original.
// 120 BPM con swing de corcheas, Sib mayor. Bajo caminante, "stabs" de bronces
// en ritmo charleston, palmas en 2 y 4, ride con swing y una melodía saltarina.
// Intensidad 1: claves marcando el tiempo (reloj). Intensidad 2: shaker en semicorcheas.
import { drum, mel, rep } from '../score';
import type { TrackDef } from '../score';

// Voicings de bronces (3 voces)
const BR = {
  Bb6: 'D4+G4+Bb4',
  G7: 'D4+F4+B4',
  Cm7: 'Eb4+G4+Bb4',
  F7: 'Eb4+A4+C5',
  Eb6: 'Eb4+G4+C5',
  Edim: 'E4+G4+Db5',
  BbF: 'D4+F4+Bb4',
  C7: 'E4+G4+Bb4',
};

/** Charleston: golpe en 1 y en el "y" del 2. */
const charleston = (ch: string): string => `${ch}:2! r:4 ${ch}:2 r:8`;
/** Comping en 2 y 4. */
const backbeat = (ch: string): string => `r:4 ${ch}:2 r:6 ${ch}:2? r:2`;

const RIDE = rep('Y...y.y.Y...y.y.', 4);
const KICK = rep('k...k...k...k...', 4);
const CLAP = rep('....C.......C...', 4);
const CLAVES = rep('l.l.l.l.l.l.l.l.', 4);
const SHAKER16 = rep('MmmmMmmmMmmmMmmm', 4);

export const QUIZ_TRACK: TrackDef = {
  id: 'quiz',
  title: 'Show de la Pareja',
  bpm: 120,
  key: 'Sib mayor',
  swing: { amount: 0.55, unit: 8 },
  echo: { steps: 3, feedback: 0.2, wet: 0.12 },
  voices: [
    { name: 'lead', inst: 'lead', gain: 0.81, pan: 0.1, lowpass: 2600, gate: 0.9, echo: 0.15, opts: { vibrato: 12 } },
    { name: 'brass', inst: 'brass', gain: 0.54, pan: -0.2, gate: 0.8, opts: { cutoff: 2600 } },
    { name: 'bass', inst: 'bass', gain: 0.85, gate: 0.85, opts: { cutoff: 800 } },
    { name: 'ride', inst: 'drums', gain: 1.11, pan: 0.3 },
    { name: 'kick', inst: 'drums', gain: 1.1 },
    { name: 'clap', inst: 'drums', gain: 0.87, pan: -0.05 },
    { name: 'cowbell', inst: 'drums', gain: 0.74, pan: -0.35 },
    { name: 'crash', inst: 'drums', gain: 0.98, pan: 0.25 },
    { name: 'claves', inst: 'drums', gain: 0.74, pan: 0.4, layer: 1 },
    { name: 'shaker16', inst: 'drums', gain: 0.46, pan: -0.3, layer: 2 },
  ],
  sections: [
    {
      name: 'A',
      bars: 4,
      parts: {
        lead: mel(
          `D5:2 F5:2 G5:4 F5:2 D5:2 Bb4:4 | B4:2 D5:2 F5:4 E5:2 F5:2 D5:4 |
           Eb5:2 G5:2 Bb5:4 A5:2 G5:2 Eb5:4 | F5:4 Eb5:2 C5:2 A4:4 r:4`,
          'quiz.A.lead',
        ),
        brass: mel(
          `${charleston(BR.Bb6)} | ${charleston(BR.G7)} | ${charleston(BR.Cm7)} | ${charleston(BR.F7)}`,
          'quiz.A.brass',
        ),
        bass: mel(
          'Bb2:4 D3:4 F3:4 G3:4 | G2:4 B2:4 D3:4 Db3:4 | C3:4 Eb3:4 G3:4 E3:4 | F2:4 A2:4 C3:4 B2:4',
          'quiz.A.bass',
        ),
        ride: drum(RIDE),
        kick: drum(KICK),
        clap: drum(CLAP),
        crash: drum('X...............'),
        claves: drum(CLAVES),
        shaker16: drum(SHAKER16),
      },
    },
    {
      name: 'A2',
      bars: 4,
      parts: {
        lead: mel(
          `D5:2 F5:2 G5:4 Bb5:2 G5:2 F5:4 | F5:2 D5:2 B4:4 D5:2 G5:2 F5:4 |
           Eb5:2 C5:2 G4:4 A4:2 C5:2 Eb5:4 | Bb4:4 r:2 F4:2 G4:2 A4:2 C5:2 D5:2`,
          'quiz.A2.lead',
        ),
        brass: mel(
          `${charleston(BR.Bb6)} | ${charleston(BR.G7)} |
           ${BR.Cm7}:2! r:4 ${BR.Cm7}:2 ${BR.F7}:2! r:4 ${BR.F7}:2 | ${BR.Bb6}:3! r:13`,
          'quiz.A2.brass',
        ),
        bass: mel(
          'Bb2:4 C3:4 D3:4 F3:4 | G2:4 A2:4 B2:4 Db3:4 | C3:4 G2:4 F2:4 A2:4 | Bb2:4 D3:4 F3:4 D3:4',
          'quiz.A2.bass',
        ),
        ride: drum(RIDE),
        kick: drum(KICK),
        clap: drum(`${rep('....C.......C...', 3)} ....C...c.c.CCCC`),
        claves: drum(CLAVES),
        shaker16: drum(SHAKER16),
      },
    },
    {
      name: 'B',
      bars: 4,
      parts: {
        lead: mel(
          `Eb5:4 G5:4 C6:2 Bb5:2 G5:4 | Bb5:4 G5:2 E5:2 Db5:4 r:4 |
           D5:4 F5:4 Bb5:6 r:2 | B5:4 A5:2 G5:2 F5:4 D5:4`,
          'quiz.B.lead',
        ),
        brass: mel(
          `${backbeat(BR.Eb6)} | ${backbeat(BR.Edim)} | ${backbeat(BR.BbF)} | ${backbeat(BR.G7)}`,
          'quiz.B.brass',
        ),
        bass: mel(
          'Eb3:4 F3:4 G3:4 Eb3:4 | E3:4 Db3:4 Bb2:4 E2:4 | F2:4 Bb2:4 D3:4 F#3:4 | G3:4 F3:4 D3:4 B2:4',
          'quiz.B.bass',
        ),
        ride: drum(RIDE),
        kick: drum(KICK),
        clap: drum(CLAP),
        cowbell: drum(rep('b.....b.....b...', 4)),
        claves: drum(CLAVES),
        shaker16: drum(SHAKER16),
      },
    },
    {
      name: 'B2',
      bars: 4,
      parts: {
        lead: mel(
          `E5:2 G5:2 Bb5:4 A5:2 G5:2 E5:4 | Eb5:2 F5:2 A5:4 C6:4 A5:4 |
           Bb5:2 G5:2 F5:2 D5:2 B4:2 D5:2 F5:2 Ab5:2 | G5:4 Eb5:2 C5:2 A4:2 C5:2 Eb5:2 F5:2`,
          'quiz.B2.lead',
        ),
        brass: mel(
          `${backbeat(BR.C7)} | ${backbeat(BR.F7)} |
           ${BR.Bb6}:2! r:6 ${BR.G7}:2! r:6 |
           ${BR.Cm7}:2! r:4 ${BR.Cm7}:2 ${BR.F7}:2! r:2 ${BR.F7}:2 ${BR.F7}:2`,
          'quiz.B2.brass',
        ),
        bass: mel(
          'C3:4 E3:4 G3:4 E3:4 | F3:4 C3:4 A2:4 C3:4 | Bb2:4 D3:4 G2:4 B2:4 | C3:4 Eb3:4 F2:4 A2:4',
          'quiz.B2.bass',
        ),
        ride: drum(RIDE),
        kick: drum(KICK),
        clap: drum(CLAP),
        cowbell: drum(`${rep('..b...b...b.b...', 3)} ..b...b.b.b.bbbb`),
        claves: drum(CLAVES),
        shaker16: drum(SHAKER16),
      },
    },
  ],
  order: [0, 1, 2, 3],
  loop: true,
};
