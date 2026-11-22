import { z } from 'zod';
import { BTN_MASK, MAX_INPUT_TICKS_PER_MESSAGE } from './constants';
import { ACCESSORY_IDS, CHARACTER_IDS, EMOTE_IDS, PLAY_MODES, QUIZ_DECKS, SKIN_COUNT } from './types';

/**
 * Esquemas de validación de TODO mensaje cliente→servidor.
 * `.strict()` rechaza propiedades desconocidas; los números son acotados.
 */

const shortText = z.string().max(40);

export const createRoomSchema = z.object({ name: shortText.optional() }).strict();

export const joinRoomSchema = z
  .object({
    code: z.string().min(4).max(16),
    name: shortText.optional(),
  })
  .strict();

export const resumeSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();

export const selectSchema = z
  .object({
    character: z.enum(CHARACTER_IDS).nullable(),
    skin: z.number().int().min(0).max(SKIN_COUNT - 1),
    accessory: z.enum(ACCESSORY_IDS),
  })
  .strict();

export const readySchema = z.object({ ready: z.boolean() }).strict();

export const modeSchema = z
  .object({
    mode: z.enum(PLAY_MODES),
    deck: z.enum(QUIZ_DECKS).optional(),
  })
  .strict();

export const inputSchema = z
  .object({
    m: z.number().int().min(0).max(1_000_000),
    t: z.number().int().min(1).max(10_000_000),
    b: z.array(z.number().int().min(0).max(BTN_MASK)).min(1).max(MAX_INPUT_TICKS_PER_MESSAGE),
  })
  .strict();

export const answerSchema = z
  .object({
    q: z.number().int().min(0).max(64),
    choice: z.number().int().min(0).max(3),
  })
  .strict();

export const skipSchema = z.object({ q: z.number().int().min(0).max(64) }).strict();

export const voteSchema = z.object({ kind: z.enum(['rematch', 'next']) }).strict();

export const emoteSchema = z.object({ id: z.enum(EMOTE_IDS) }).strict();

export const pingSchema = z.object({ c: z.number().finite() }).strict();

export const handshakeSchema = z.object({ v: z.number().int() }).passthrough();
