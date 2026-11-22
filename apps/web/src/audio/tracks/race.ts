// "Carrera del Caos" — tema de la carrera. Composición original.
// 146 BPM, Sol mayor con préstamos (bVII = Sib) y una bajada cromática "de dibujo animado".
// Bajo en octavas, contratiempos tipo ska, caja en 2 y 4 y un lead pegadizo en staccato.
// Intensidad 1: hi-hats en semicorcheas + palmas. Intensidad 2: arpegio en semicorcheas + bombo extra.
import { drum, mel, rep } from '../score';
import type { TrackDef } from '../score';

// Bajo en octavas por medio compás (8 pasos)
const BS = {
  G: 'G2:2 G3:2 G2:2 G3:2',
  Bb: 'Bb2:2 Bb3:2 Bb2:2 Bb3:2',
  C: 'C3:2 C4:2 C3:2 C4:2',
  D: 'D3:2 D4:2 D3:2 D4:2',
  Dup: 'D3:2 D4:2 E3:2 F#3:2',
  Em: 'E2:2 E3:2 E2:2 E3:2',
  Am: 'A2:2 A3:2 A2:2 A3:2',
};

// Acordes a contratiempo (medio compás): silencio, golpe, silencio, golpe
const SK = (ch: string): string => `r:2 ${ch}:2? r:2 ${ch}:2`;
const CH = {
  G: 'G4+B4+D5',
  Bb: 'Bb4+D5+F5',
  C: 'G4+C5+E5',
  D: 'A4+D5+F#5',
  D7: 'A4+C5+F#5',
  Em: 'G4+B4+E5',
  Am: 'A4+C5+E5',
  Am7: 'G4+C5+E5',
};

// Arpegios en semicorcheas (medio compás)
const AR = {
  G: 'G4:1 B4:1 D5:1 G5:1 B5:1 G5:1 D5:1 B4:1',
  Bb: 'Bb4:1 D5:1 F5:1 Bb5:1 D6:1 Bb5:1 F5:1 D5:1',
  C: 'C5:1 E5:1 G5:1 C6:1 E6:1 C6:1 G5:1 E5:1',
  D: 'D5:1 F#5:1 A5:1 D6:1 F#6:1 D6:1 A5:1 F#5:1',
  D7: 'D5:1 F#5:1 A5:1 C6:1 D6:1 C6:1 A5:1 F#5:1',
  Em: 'E5:1 G5:1 B5:1 E6:1 G6:1 E6:1 B5:1 G5:1',
  Am: 'A4:1 C5:1 E5:1 A5:1 C6:1 A5:1 E5:1 C5:1',
};

const LEAD_A1 = 'D5:2 r:1 D5:1 B4:2 G4:2 A4:2 B4:2 D5:2 r:2';
const LEAD_A2 = 'E5:2 D5:2 B4:2 G4:2 F5:3 D5:3 Bb4:2';
const LEAD_A3 = 'C5:2 r:1 C5:1 E5:2 G5:2 A5:2 G5:2 E5:2 C5:2';
const LEAD_B1 = 'B4:3 E5:3 G5:2 F#5:3 E5:3 B4:2';

const KICK = rep('K.......K.k.....', 4);
const SNARE = rep('....S.......S...', 4);
const HATS = rep('H.h.H.h.H.h.H.h.', 4);
const HATS16 = rep('.h.h.h.h.h.h.h.h', 4);
const CLAP = rep('....c.......c...', 4);
const KICK2 = rep('....k.......k.k.', 4);

export const RACE_TRACK: TrackDef = {
  id: 'race',
  title: 'Carrera del Caos',
  bpm: 146,
  key: 'Sol mayor (bVII prestado)',
  echo: { steps: 3, feedback: 0.22, wet: 0.14 },
  voices: [
    { name: 'lead', inst: 'lead', gain: 0.8, pan: 0.05, lowpass: 3200, gate: 0.85, echo: 0.15 },
    { name: 'skank', inst: 'pluck', gain: 0.2, pan: -0.25, opts: { wave: 'square', decay: 0.35, cutoff: 5 } },
    { name: 'bass', inst: 'bass', gain: 0.54, gate: 0.6, boost: [1, 1.05, 1.1], opts: { cutoff: 950 } },
    { name: 'kick', inst: 'drums', gain: 0.73, boost: [1, 1.06, 1.12] },
    { name: 'snare', inst: 'drums', gain: 0.61, pan: 0.05, boost: [1, 1.06, 1.12] },
    { name: 'hats', inst: 'drums', gain: 1.18, pan: 0.3 },
    { name: 'hats16', inst: 'drums', gain: 1.06, pan: 0.35, layer: 1 },
    { name: 'clap', inst: 'drums', gain: 1.19, pan: -0.1, layer: 1 },
    { name: 'crash', inst: 'drums', gain: 0.5, pan: -0.3, layer: 1 },
    { name: 'arp', inst: 'pluck', gain: 0.48, pan: 0.32, layer: 2, echo: 0.2, opts: { decay: 0.4, cutoff: 6 } },
    { name: 'kick2', inst: 'drums', gain: 0.89, layer: 2 },
  ],
  sections: [
    {
      name: 'A',
      bars: 4,
      parts: {
        lead: mel(`${LEAD_A1} | ${LEAD_A2} | ${LEAD_A3} | B4:2 C5:2 D5:4 F#5:3 E5:3 D5:2`, 'race.A.lead'),
        bass: mel(`${BS.G} ${BS.G} | ${BS.G} ${BS.Bb} | ${BS.C} ${BS.C} | ${BS.C} ${BS.Dup}`, 'race.A.bass'),
        skank: mel(
          `${SK(CH.G)} ${SK(CH.G)} | ${SK(CH.G)} ${SK(CH.Bb)} | ${SK(CH.C)} ${SK(CH.C)} | ${SK(CH.C)} ${SK(CH.D)}`,
          'race.A.skank',
        ),
        arp: mel(`${AR.G} ${AR.G} | ${AR.G} ${AR.Bb} | ${AR.C} ${AR.C} | ${AR.C} ${AR.D}`, 'race.A.arp'),
        kick: drum(KICK),
        snare: drum(SNARE),
        hats: drum(HATS),
        hats16: drum(HATS16),
        clap: drum(CLAP),
        crash: drum('X...............'),
        kick2: drum(KICK2),
      },
    },
    {
      name: 'A2',
      bars: 4,
      parts: {
        lead: mel(
          `${LEAD_A1} | ${LEAD_A2} | ${LEAD_A3} |
           r:2 D5:1 C#5:1 C5:1 B4:1 Bb4:1 A4:1 Ab4:1 G4:1 F#4:2 G4:2 A4:2`,
          'race.A2.lead',
        ),
        bass: mel(
          `${BS.G} ${BS.G} | ${BS.G} ${BS.Bb} | ${BS.C} ${BS.C} | D3:2 r:2 D3:1 r:1 D3:2 C3:2 B2:2 A2:2 F#2:2`,
          'race.A2.bass',
        ),
        skank: mel(
          `${SK(CH.G)} ${SK(CH.G)} | ${SK(CH.G)} ${SK(CH.Bb)} | ${SK(CH.C)} ${SK(CH.C)} | ${CH.D7}:2! r:6 r:8`,
          'race.A2.skank',
        ),
        arp: mel(`${AR.G} ${AR.G} | ${AR.G} ${AR.Bb} | ${AR.C} ${AR.C} | ${AR.D7} ${AR.D7}`, 'race.A2.arp'),
        kick: drum(`${rep('K.......K.k.....', 3)} K...............`),
        snare: drum(`${rep('....S.......S...', 3)} ........s.s.SsSS`),
        hats: drum(`${rep('H.h.H.h.H.h.H.h.', 3)} H.h.H.h.........`),
        hats16: drum(HATS16),
        clap: drum(CLAP),
        kick2: drum(KICK2),
      },
    },
    {
      name: 'B',
      bars: 4,
      parts: {
        lead: mel(
          `${LEAD_B1} | C5:3 E5:3 G5:2 A5:4 G5:4 | A5:3 G5:3 E5:2 C5:3 E5:3 A5:2 | F#5:6 E5:2 D5:4 A4:4`,
          'race.B.lead',
        ),
        bass: mel(
          `${BS.Em} ${BS.Em} | ${BS.C} ${BS.C} | ${BS.Am} ${BS.Am} | ${BS.D} D3:2 D4:2 C3:2 D#3:2`,
          'race.B.bass',
        ),
        skank: mel(
          `${SK(CH.Em)} ${SK(CH.Em)} | ${SK(CH.C)} ${SK(CH.C)} | ${SK(CH.Am)} ${SK(CH.Am)} | ${SK(CH.D)} ${SK(CH.D)}`,
          'race.B.skank',
        ),
        arp: mel(`${AR.Em} ${AR.Em} | ${AR.C} ${AR.C} | ${AR.Am} ${AR.Am} | ${AR.D} ${AR.D}`, 'race.B.arp'),
        kick: drum(KICK),
        snare: drum(SNARE),
        hats: drum(HATS),
        hats16: drum(HATS16),
        clap: drum(CLAP),
        crash: drum('X...............'),
        kick2: drum(KICK2),
      },
    },
    {
      name: 'B2',
      bars: 4,
      parts: {
        lead: mel(
          `${LEAD_B1} | C5:3 E5:3 G5:2 C6:4 B5:4 |
           A5:2 G5:2 E5:2 C5:2 D5:2 F#5:2 A5:2 C6:2 |
           D6:2 r:2 A5:2 r:2 F#5:2 E5:2 D5:2 C5:2`,
          'race.B2.lead',
        ),
        bass: mel(
          `${BS.Em} ${BS.Em} | ${BS.C} ${BS.C} | ${BS.Am} ${BS.D} | ${BS.D} D3:2 E3:2 F#3:4`,
          'race.B2.bass',
        ),
        skank: mel(
          `${SK(CH.Em)} ${SK(CH.Em)} | ${SK(CH.C)} ${SK(CH.C)} | ${SK(CH.Am7)} ${SK(CH.D7)} | ${SK(CH.D)} ${CH.D}:2! r:6`,
          'race.B2.skank',
        ),
        arp: mel(`${AR.Em} ${AR.Em} | ${AR.C} ${AR.C} | ${AR.Am} ${AR.D7} | ${AR.D} ${AR.D}`, 'race.B2.arp'),
        kick: drum(`${rep('K.......K.k.....', 3)} K.......K.......`),
        snare: drum(`${rep('....S.......S...', 3)} ....S...s.s.SSSS`),
        hats: drum(`${rep('H.h.H.h.H.h.H.h.', 3)} H.h.H.h.H.......`),
        hats16: drum(HATS16),
        clap: drum(CLAP),
        kick2: drum(KICK2),
      },
    },
  ],
  order: [0, 1, 2, 3],
  loop: true,
};
