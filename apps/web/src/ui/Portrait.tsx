import { memo, useMemo } from 'react';
import type { AccessoryId, CharacterId } from '@duo/shared';
import { portraitSvg, type EyeVariant, type MouthVariant } from '../game/art/characters';

interface Props {
  character: CharacterId;
  skin: number;
  accessory: AccessoryId;
  eyes?: EyeVariant;
  mouth?: MouthVariant;
  blush?: boolean;
  bob?: boolean;
  label?: string;
  size?: number;
}

/**
 * Retrato vectorial del personaje para la interfaz. El SVG lo genera nuestro
 * propio código a partir de valores validados (no contiene texto de usuarios),
 * por eso es seguro insertarlo como marcado.
 */
export const Portrait = memo(function Portrait({ character, skin, accessory, eyes, mouth, blush, bob, label, size }: Props) {
  const markup = useMemo(
    () => portraitSvg(character, skin, accessory, eyes ?? 'open', mouth ?? 'smile', blush ?? false),
    [character, skin, accessory, eyes, mouth, blush],
  );
  return (
    <span
      className={`portrait${bob ? ' bob' : ''}`}
      style={size ? { width: size, height: size } : undefined}
      role="img"
      aria-label={label ?? character}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
});
