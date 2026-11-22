import type { EmoteId } from '@duo/shared';

/** Íconos SVG originales (sin dependencias de terceros). */
type IconProps = { className?: string; title?: string };

const base = (path: React.ReactNode, { className, title }: IconProps, vb = '0 0 24 24') => (
  <svg className={className ?? 'icon'} viewBox={vb} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
    {title ? <title>{title}</title> : null}
    {path}
  </svg>
);

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const IconJump = (p: IconProps) => base(<path {...S} d="M12 20V5M5 11l7-7 7 7" />, p);
export const IconSlide = (p: IconProps) =>
  base(
    <>
      <path {...S} d="M5 7l7 6 7-6" />
      <path {...S} d="M4 18h16" />
    </>,
    p,
  );
export const IconLeft = (p: IconProps) => base(<path {...S} d="M15 5l-7 7 7 7" />, p);
export const IconRight = (p: IconProps) => base(<path {...S} d="M9 5l7 7-7 7" />, p);
export const IconHand = (p: IconProps) =>
  base(
    <>
      <path {...S} d="M8 13V6.5a1.5 1.5 0 013 0V12m0-6.5V5a1.5 1.5 0 013 0v7m0-5.5a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L4.6 14a1.6 1.6 0 012.6-1.8L8 13" />
    </>,
    p,
  );
export const IconStar = (p: IconProps) =>
  base(<path fill="currentColor" d="M12 2.5l2.8 6 6.5.6-4.9 4.3 1.5 6.4L12 16.5 6.1 19.8l1.5-6.4L2.7 9.1l6.5-.6z" />, p);
export const IconSound = (p: IconProps) =>
  base(
    <>
      <path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z" />
      <path {...S} d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
    </>,
    p,
  );
export const IconMute = (p: IconProps) =>
  base(
    <>
      <path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z" />
      <path {...S} d="M17 9l5 6M22 9l-5 6" />
    </>,
    p,
  );
export const IconGear = (p: IconProps) =>
  base(
    <>
      <circle {...S} cx="12" cy="12" r="3.2" />
      <path
        {...S}
        d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"
      />
    </>,
    p,
  );
export const IconTrophy = (p: IconProps) =>
  base(
    <>
      <path {...S} d="M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4M12 14v4M8 21h8M9.5 18h5" />
    </>,
    p,
  );
export const IconShare = (p: IconProps) =>
  base(
    <>
      <path {...S} d="M12 15V3M7 8l5-5 5 5" />
      <path {...S} d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </>,
    p,
  );
export const IconCopy = (p: IconProps) =>
  base(
    <>
      <rect {...S} x="8" y="8" width="12" height="12" rx="2.5" />
      <path {...S} d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
    </>,
    p,
  );
export const IconBack = (p: IconProps) => base(<path {...S} d="M19 12H5M11 6l-6 6 6 6" />, p);
export const IconClose = (p: IconProps) => base(<path {...S} d="M6 6l12 12M18 6L6 18" />, p);
export const IconPlay = (p: IconProps) => base(<path fill="currentColor" d="M8 5.5v13a1 1 0 001.5.9l10.4-6.5a1 1 0 000-1.8L9.5 4.6A1 1 0 008 5.5z" />, p);
export const IconUsers = (p: IconProps) =>
  base(
    <>
      <circle {...S} cx="9" cy="8" r="3.4" />
      <path {...S} d="M2.8 20a6.2 6.2 0 0112.4 0" />
      <circle {...S} cx="17" cy="9" r="2.6" />
      <path {...S} d="M16 14.2a5 5 0 016.2 4.8" />
    </>,
    p,
  );
export const IconRefresh = (p: IconProps) =>
  base(
    <>
      <path {...S} d="M20 12a8 8 0 11-2.3-5.6" />
      <path {...S} d="M20 4v5h-5" />
    </>,
    p,
  );
export const IconHeart = (p: IconProps) =>
  base(<path fill="currentColor" d="M12 20.5C5 15.6 2.5 12.4 2.5 8.9 2.5 6.1 4.7 4 7.4 4c1.8 0 3.5 1 4.6 2.5C13.1 5 14.8 4 16.6 4c2.7 0 4.9 2.1 4.9 4.9 0 3.5-2.5 6.7-9.5 11.6z" />, p);
export const IconCount = (p: IconProps) =>
  base(
    <>
      <circle {...S} cx="12" cy="13" r="8" />
      <path {...S} d="M12 9v4l2.5 2.5M9.5 2.5h5" />
    </>,
    p,
  );

const EMOTE_SVG: Record<EmoteId, React.ReactNode> = {
  heart: <path d="M24 42C10 32 4 25 4 17.5 4 11.7 8.6 7 14.4 7c3.8 0 7.4 2 9.6 5.2C26.2 9 29.8 7 33.6 7 39.4 7 44 11.7 44 17.5 44 25 38 32 24 42z" fill="#ff4f8b" stroke="#2b1650" strokeWidth="3" />,
  laugh: (
    <>
      <circle cx="24" cy="24" r="19" fill="#ffd25e" stroke="#2b1650" strokeWidth="3" />
      <path d="M13 19q4-5 8 0M27 19q4-5 8 0" fill="none" stroke="#2b1650" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 27h22q-2 10-11 10t-11-10z" fill="#2b1650" />
      <path d="M17 33q7 4 14 0" fill="#ff7d9a" />
      <path d="M6 22q-3 3 0 7M42 22q3 3 0 7" stroke="#8fd3ff" strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
  ),
  wow: (
    <>
      <circle cx="24" cy="24" r="19" fill="#9cefe0" stroke="#2b1650" strokeWidth="3" />
      <circle cx="17" cy="19" r="4" fill="#fff" stroke="#2b1650" strokeWidth="2.5" />
      <circle cx="31" cy="19" r="4" fill="#fff" stroke="#2b1650" strokeWidth="2.5" />
      <circle cx="17" cy="19" r="1.6" fill="#2b1650" />
      <circle cx="31" cy="19" r="1.6" fill="#2b1650" />
      <ellipse cx="24" cy="32" rx="5" ry="6.5" fill="#2b1650" />
    </>
  ),
  kiss: (
    <>
      <path d="M8 26q8-8 16-2 8-6 16 2-8 10-16 10T8 26z" fill="#ff4f8b" stroke="#2b1650" strokeWidth="3" strokeLinejoin="round" />
      <path d="M8 26q16 4 32 0" fill="none" stroke="#2b1650" strokeWidth="2.5" />
      <path d="M36 8c-2-4-8-2-6 2l6 6 6-6c2-4-4-6-6-2z" fill="#ff93b8" stroke="#2b1650" strokeWidth="2" />
    </>
  ),
  grr: (
    <>
      <circle cx="24" cy="24" r="19" fill="#ff7a59" stroke="#2b1650" strokeWidth="3" />
      <path d="M12 16l9 4M36 16l-9 4" stroke="#2b1650" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="17" cy="23" r="2.4" fill="#2b1650" />
      <circle cx="31" cy="23" r="2.4" fill="#2b1650" />
      <path d="M15 34q9-6 18 0" fill="none" stroke="#2b1650" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  clap: (
    <>
      <path d="M14 30l8-14a3 3 0 015 3l-3 6 8-10a3 3 0 015 3l-9 13a10 10 0 01-14 2z" fill="#ffd25e" stroke="#2b1650" strokeWidth="3" strokeLinejoin="round" />
      <path d="M10 10l3 4M18 6l1 5M4 18l5 2" stroke="#ff6f9f" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
};

export function EmoteIcon({ id }: { id: EmoteId }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {EMOTE_SVG[id]}
    </svg>
  );
}

export function ItemIcon({ item }: { item: number }) {
  const map: Record<number, React.ReactNode> = {
    1: <path d="M27 3L10 27h12l-4 18 20-27H25z" fill="#ffd25e" stroke="#2b1650" strokeWidth="3" strokeLinejoin="round" />,
    2: (
      <path
        d="M24 12c6 0 10 6 10 14 6 4 10 12 6 16-4-4-8-6-12-4-2 6-10 6-12 2 4-2 4-6 2-8-6 2-12 0-12-4 6-2 10-4 10-8 0-5 3-8 8-8z"
        fill="#ffb52e"
        stroke="#2b1650"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    ),
    3: (
      <>
        <path d="M12 32C4 32 4 22 12 22c0-10 14-12 16-4 4-6 16-2 12 6 6 2 4 10-2 10z" fill="#8e98b8" stroke="#2b1650" strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M16 38l-2 6M26 38l-2 6M36 38l-2 6" stroke="#6fc8ff" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    4: (
      <>
        <path d="M24 37C8 26 7 13 17 12c3 0 5 2 7 4 2-2 4-4 7-4 10 1 9 14-7 25z" fill="#ff4f8b" stroke="#2b1650" strokeWidth="2.6" />
        <path d="M15 24q9-6 18 0-9 8-18 0z" fill="#c21f5e" stroke="#2b1650" strokeWidth="2" />
      </>
    ),
    5: (
      <>
        <circle cx="24" cy="24" r="19" fill="#9cefe0" fillOpacity="0.4" stroke="#5ed6c0" strokeWidth="3" />
        <path d="M24 34C13 26 13 17 19 16c2 0 4 1 5 3 1-2 3-3 5-3 6 1 6 10-5 18z" fill="#ff6f9f" stroke="#2b1650" strokeWidth="2.4" />
      </>
    ),
    9: (
      <>
        <rect x="8" y="8" width="32" height="32" rx="8" fill="#ff6f9f" stroke="#2b1650" strokeWidth="3" />
        <path d="M19 19q0-6 5-6 6 0 6 6 0 4-5 6v3" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
        <circle cx="25" cy="34" r="2.4" fill="#fff" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {map[item] ?? map[9]}
    </svg>
  );
}

export const ITEM_NAMES: Record<number, string> = {
  1: 'Turbo',
  2: 'Cáscara de mango',
  3: 'Nube gruñona',
  4: 'Beso volador',
  5: 'Corazón escudo',
  9: 'Caja del Caos',
};
