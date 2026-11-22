// API pública del audio de DUO (música, efectos y jingles sintetizados con Web Audio).
export { AudioEngine, audio, installAudioLifecycle } from './AudioEngine';
export type { AudioStats, JingleKind, MusicIntensity, MusicTrack, Sfx, SfxOptions } from './AudioEngine';
export { MUSIC_TRACKS, TRACKS } from './music';
export { SFX_IDS } from './sfx';
export { JINGLE_KINDS } from './jingles';
