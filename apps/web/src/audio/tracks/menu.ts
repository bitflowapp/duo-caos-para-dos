// "Atardecer en la Isla" — tema del menú. Composición original.
// 96 BPM, Fa mayor, swing suave de semicorcheas. Marimba en ostinato 3-3-2
// (aire tropical), bajo redondo, shaker y un gancho romántico de flauta.
// Forma: A (groove) · A2 (entra el gancho) · B (puente con pad y congas) · A3 (gancho con iv menor).
import { drum, mel, rep } from '../score';
import type { TrackDef } from '../score';

// Ostinato de marimba por acorde (grupos 3+3+2 semicorcheas)
const M = {
  F: 'F3:3! C4:3 E4:2? A4:3 C4:3 E4:2?',
  Am: 'A3:3! E4:3 G4:2? C5:3 E4:3 G4:2?',
  Bb: 'Bb3:3! F4:3 A4:2? D5:3 F4:3 A4:2?',
  C7sus: 'C4:3! G4:3 Bb4:2? F4:3 E4:3 G4:2?',
  Dm: 'D3:3! A3:3 C4:2? F4:3 A3:3 C4:2?',
  Gm: 'G3:3! D4:3 F4:2? Bb4:3 D4:3 F4:2?',
  C7: 'C4:3! G4:3 Bb4:2? E4:3 G4:3 Bb4:2?',
  GmC7: 'G3:3! D4:3 F4:2? C4:3 E4:3 Bb4:2?',
  BbBbm: 'Bb3:3! F4:3 A4:2? Db4:3 F4:3 G4:2?',
  Fturn: 'F3:3! C4:3 E4:2? A4:3 C4:3 Bb4:2?',
};

// Bajo: tónica larga, quinta y arpegio corto
const B = {
  F: 'F2:6 C3:2 F2:3 A2:3 C3:2',
  Am: 'A2:6 E2:2 A2:3 C3:3 E3:2',
  Bb: 'Bb2:6 F2:2 Bb2:3 D3:3 F3:2',
  C7sus: 'C3:6 G2:2 C3:3 E3:3 G2:2',
  Dm: 'D3:6 A2:2 D3:3 F3:3 A2:2',
  Gm: 'G2:6 D3:2 G2:3 Bb2:3 D3:2',
  C7: 'C3:6 G2:2 C3:3 E3:3 Bb2:2',
  GmC7: 'G2:6 D3:2 C3:6 G2:2',
  BbBbm: 'Bb2:6 F2:2 Bb2:6 Db3:2',
  Fturn: 'F2:6 C3:2 F2:4 C3:4',
};

const KICK = rep('K.......k.......', 4);
const SHAKER = rep('M.mmM.mmM.mmM.mm', 4);
const RIM = rep('....r.......r...', 4);

export const MENU_TRACK: TrackDef = {
  id: 'menu',
  title: 'Atardecer en la Isla',
  bpm: 96,
  key: 'Fa mayor',
  swing: { amount: 0.14, unit: 16 },
  echo: { steps: 3, feedback: 0.3, wet: 0.22 },
  voices: [
    { name: 'marimba', inst: 'marimba', gain: 0.66, pan: -0.15, echo: 0.18 },
    { name: 'hook', inst: 'flute', gain: 0.65, pan: 0.12, lowpass: 3800, echo: 0.3 },
    { name: 'bell', inst: 'bell', gain: 0.47, pan: 0.3, echo: 0.4 },
    { name: 'bass', inst: 'bass', gain: 1.17, gate: 0.9, opts: { cutoff: 520 } },
    { name: 'pad', inst: 'pad', gain: 0.16, lowpass: 1600 },
    { name: 'kick', inst: 'drums', gain: 0.93 },
    { name: 'rim', inst: 'drums', gain: 1.1, pan: 0.2 },
    { name: 'shaker', inst: 'drums', gain: 0.61, pan: 0.35 },
    { name: 'conga', inst: 'drums', gain: 0.76, pan: -0.3 },
  ],
  sections: [
    {
      name: 'A',
      bars: 4,
      parts: {
        marimba: mel(`${M.F} | ${M.Am} | ${M.Bb} | ${M.C7sus}`, 'menu.A.marimba'),
        bass: mel(`${B.F} | ${B.Am} | ${B.Bb} | ${B.C7sus}`, 'menu.A.bass'),
        bell: mel('r:16 | r:12 E6:2 C6:2? | r:16 | r:10 G5:2? Bb5:2 E6:2', 'menu.A.bell'),
        kick: drum(KICK),
        shaker: drum(SHAKER),
      },
    },
    {
      name: 'A2',
      bars: 4,
      parts: {
        marimba: mel(`${M.F} | ${M.Am} | ${M.Bb} | ${M.GmC7}`, 'menu.A2.marimba'),
        bass: mel(`${B.F} | ${B.Am} | ${B.Bb} | ${B.GmC7}`, 'menu.A2.bass'),
        hook: mel(
          `r:2 C5:2 F5:3 E5:3 C5:2 A4:4 |
           r:2 C5:2 E5:3 D5:3 C5:2 G4:4 |
           r:2 D5:2 F5:3 E5:3 D5:2 A4:2 Bb4:2 |
           Bb4:2 A4:2 G4:4 r:2 E4:2 G4:2 Bb4:2`,
          'menu.A2.hook',
        ),
        kick: drum(KICK),
        rim: drum(RIM),
        shaker: drum(SHAKER),
      },
    },
    {
      name: 'B',
      bars: 4,
      parts: {
        marimba: mel(`${M.Dm} | ${M.Bb} | ${M.Gm} | ${M.C7}`, 'menu.B.marimba'),
        bass: mel(`${B.Dm} | ${B.Bb} | ${B.Gm} | ${B.C7}`, 'menu.B.bass'),
        hook: mel(
          `A5:6 G5:2 F5:4 E5:2 F5:2 |
           D5:8 r:2 C5:2 D5:2 F5:2 |
           G5:6 F5:2 D5:4 Bb4:2 C5:2 |
           E5:6 G5:2 Bb5:4 r:4`,
          'menu.B.hook',
        ),
        pad: mel('A3+C4+F4:16 | A3+D4+F4:16 | Bb3+D4+F4:16 | Bb3+E4+G4:16', 'menu.B.pad'),
        kick: drum(KICK),
        rim: drum(RIM),
        shaker: drum(SHAKER),
        conga: drum(`${rep('..q...uu..q.d.ud', 3)} ..q...uu..q.dudd`),
      },
    },
    {
      name: 'A3',
      bars: 4,
      parts: {
        marimba: mel(`${M.F} | ${M.Am} | ${M.BbBbm} | ${M.Fturn}`, 'menu.A3.marimba'),
        bass: mel(`${B.F} | ${B.Am} | ${B.BbBbm} | ${B.Fturn}`, 'menu.A3.bass'),
        hook: mel(
          `r:2 C5:2 F5:3 E5:3 C5:2 A4:4 |
           r:2 C5:2 E5:3 D5:3 C5:2 G4:4 |
           r:2 D5:2 F5:4 F5:2 Db5:2 C5:2 Bb4:2 |
           A4:4 G4:2 F4:6 r:4`,
          'menu.A3.hook',
        ),
        pad: mel('A3+C4+E4:16 | G3+C4+E4:16 | A3+D4+F4:8 Db4+F4+G4:8 | A3+C4+F4:16', 'menu.A3.pad'),
        bell: mel('r:16 | r:16 | r:16 | r:8 C6:2? A5:2 F5:4', 'menu.A3.bell'),
        kick: drum(KICK),
        rim: drum(RIM),
        shaker: drum(SHAKER),
        conga: drum(rep('..q...uu..q.d.ud', 4)),
      },
    },
  ],
  order: [0, 1, 2, 3],
  loop: true,
};
