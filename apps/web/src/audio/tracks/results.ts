// "Abrazo Final" — tema de resultados. Composición original.
// 88 BPM, Mib mayor. Piano eléctrico FM con un comping tipo "latido",
// bajo cálido descendente (Eb–D–C–Ab), melodía de flauta y destellos de campana.
import { drum, mel, rep } from '../score';
import type { TrackDef } from '../score';

const EP = {
  Eb: 'G3+Bb3+D4',
  BbD: 'F3+Bb3+D4',
  Cm7: 'G3+Bb3+Eb4',
  Ab: 'G3+C4+Eb4',
  Fm7: 'Ab3+C4+Eb4',
  Bb7: 'Ab3+D4+F4',
  Gm7: 'F3+Bb3+D4',
  C7: 'G3+Bb3+E4',
  EbEnd: 'G3+Bb3+Eb4',
};

/** Comping "latido": golpes en 1, en la última semicorchea del 2 y en 3. */
const beat = (a: string, b: string = a): string => `${a}:6 ${a}:2? ${b}:8`;

const BASS = {
  Eb: 'Eb2:6 Bb2:2 Eb3:4 Bb2:4',
  BbD: 'D3:6 F3:2 Bb2:4 D3:4',
  Cm7: 'C3:6 G2:2 C3:4 Eb3:4',
  Ab: 'Ab2:6 Eb3:2 Ab2:4 C3:4',
  Fm7: 'F2:6 C3:2 F2:4 Ab2:4',
  Bb7: 'Bb2:6 F2:2 Bb2:4 D3:4',
  GmC7: 'G2:6 D3:2 C3:6 G2:2',
  FmBb: 'F2:6 C3:2 Bb2:6 F2:2',
  AbBb: 'Ab2:6 Eb3:2 Bb2:6 F2:2',
  EbEnd: 'Eb2:6 Bb2:2 Eb2:8',
};

const KICK = rep('K.........k.....', 4);
const HEART = rep('K..k......k.....', 4);
const CLAP = rep('....c.......c...', 4);
const SHAKER = rep('m.m.m.m.m.m.m.m.', 4);

export const RESULTS_TRACK: TrackDef = {
  id: 'results',
  title: 'Abrazo Final',
  bpm: 88,
  key: 'Mib mayor',
  swing: { amount: 0.12, unit: 16 },
  echo: { steps: 3, feedback: 0.3, wet: 0.22 },
  voices: [
    { name: 'melody', inst: 'flute', gain: 0.6, pan: 0.08, lowpass: 3600, echo: 0.3 },
    { name: 'ep', inst: 'ep', gain: 0.42, pan: -0.15, echo: 0.15 },
    { name: 'bell', inst: 'bell', gain: 0.3, pan: 0.35, echo: 0.45 },
    { name: 'bass', inst: 'bass', gain: 0.58, gate: 0.9 },
    { name: 'pad', inst: 'pad', gain: 0.18, lowpass: 1500 },
    { name: 'kick', inst: 'drums', gain: 0.45 },
    { name: 'clap', inst: 'drums', gain: 0.28, pan: -0.1 },
    { name: 'shaker', inst: 'drums', gain: 0.24, pan: 0.3 },
  ],
  sections: [
    {
      name: 'A',
      bars: 4,
      parts: {
        melody: mel(
          'G4:4 Bb4:4 Eb5:6 D5:2 | D5:4 F5:4 Bb4:8 | Eb5:4 G5:4 F5:2 Eb5:2 D5:2 C5:2 | C5:6 Bb4:2 G4:8',
          'results.A.melody',
        ),
        ep: mel(`${beat(EP.Eb)} | ${beat(EP.BbD)} | ${beat(EP.Cm7)} | ${beat(EP.Ab)}`, 'results.A.ep'),
        bass: mel(`${BASS.Eb} | ${BASS.BbD} | ${BASS.Cm7} | ${BASS.Ab}`, 'results.A.bass'),
        kick: drum(KICK),
        shaker: drum(SHAKER),
      },
    },
    {
      name: 'A2',
      bars: 4,
      parts: {
        melody: mel(
          `Ab4:4 C5:4 F5:6 Eb5:2 | D5:4 F5:4 Ab5:6 G5:2 |
           G5:4 F5:2 D5:2 E5:4 G5:2 Bb5:2 | Ab5:4 G5:2 F5:2 D5:4 Bb4:4`,
          'results.A2.melody',
        ),
        ep: mel(`${beat(EP.Fm7)} | ${beat(EP.Bb7)} | ${beat(EP.Gm7, EP.C7)} | ${beat(EP.Fm7, EP.Bb7)}`, 'results.A2.ep'),
        bass: mel(`${BASS.Fm7} | ${BASS.Bb7} | ${BASS.GmC7} | ${BASS.FmBb}`, 'results.A2.bass'),
        pad: mel(
          'Ab3+C4+Eb4:16 | Ab3+D4+F4:16 | F3+Bb3+D4:8 G3+Bb3+E4:8 | Ab3+C4+Eb4:8 Ab3+D4+F4:8',
          'results.A2.pad',
        ),
        kick: drum(KICK),
        clap: drum(CLAP),
        shaker: drum(SHAKER),
      },
    },
    {
      name: 'B',
      bars: 4,
      parts: {
        melody: mel(
          'Bb4:2 G4:2 Bb4:2 Eb5:2 G5:6 F5:2 | F5:4 D5:4 Bb4:6 C5:2 | Eb5:4 G5:4 Bb5:4 G5:4 | Ab5:6 G5:2 Eb5:8',
          'results.B.melody',
        ),
        bell: mel(
          'r:8 Bb5:2? G5:2? Eb6:4 | r:8 D6:2? Bb5:2? F5:4 | r:8 G6:2? Eb6:2? Bb5:4 | r:8 C6:2? Eb6:2? G6:4',
          'results.B.bell',
        ),
        ep: mel(`${beat(EP.Eb)} | ${beat(EP.BbD)} | ${beat(EP.Cm7)} | ${beat(EP.Ab)}`, 'results.B.ep'),
        bass: mel(`${BASS.Eb} | ${BASS.BbD} | ${BASS.Cm7} | ${BASS.Ab}`, 'results.B.bass'),
        kick: drum(HEART),
        clap: drum(CLAP),
        shaker: drum(SHAKER),
      },
    },
    {
      name: 'B2',
      bars: 4,
      parts: {
        melody: mel(
          'F5:4 Ab5:4 C6:6 Bb5:2 | Ab5:4 F5:4 D5:6 Eb5:2 | C5:4 Eb5:2 G5:2 F5:4 D5:2 Bb4:2 | Eb5:12 r:4',
          'results.B2.melody',
        ),
        bell: mel(
          'r:8 Ab5:2? C6:2? F6:4 | r:8 F6:2? D6:2? Bb5:4 | r:8 F6:2? D6:2? Bb5:4 | G5:2? Bb5:2? Eb6:4 G6:8',
          'results.B2.bell',
        ),
        ep: mel(`${beat(EP.Fm7)} | ${beat(EP.Bb7)} | ${beat(EP.Ab, EP.Bb7)} | ${beat(EP.EbEnd)}`, 'results.B2.ep'),
        bass: mel(`${BASS.Fm7} | ${BASS.Bb7} | ${BASS.AbBb} | ${BASS.EbEnd}`, 'results.B2.bass'),
        pad: mel(
          'Ab3+C4+Eb4:16 | Ab3+D4+F4:16 | G3+C4+Eb4:8 Ab3+D4+F4:8 | G3+Bb3+Eb4:16',
          'results.B2.pad',
        ),
        kick: drum(HEART),
        clap: drum(CLAP),
        shaker: drum(SHAKER),
      },
    },
  ],
  order: [0, 1, 2, 3],
  loop: true,
};
