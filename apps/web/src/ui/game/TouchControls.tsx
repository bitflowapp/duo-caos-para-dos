import { useEffect, useRef, useState } from 'react';
import { BTN_ACTION, BTN_DOWN, BTN_ITEM, BTN_JUMP, BTN_LEFT, BTN_RIGHT, ITEM } from '@duo/shared';
import { input } from '../../input/InputState';
import { useHud } from '../../state/hud';
import { useStore } from '../../state/store';
import { IconHand, IconJump, IconLeft, IconRight, IconSlide, ItemIcon, ITEM_NAMES } from '../icons';

/** Botón táctil multitouch: presiona mientras haya un dedo encima. */
function HoldButton({
  bit,
  label,
  className,
  children,
  testId,
}: {
  bit: number;
  label: string;
  className?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  const pointers = useRef(new Set<number>());
  const [pressed, setPressed] = useState(false);
  const release = (id: number): void => {
    pointers.current.delete(id);
    if (pointers.current.size === 0) {
      input.release(bit);
      setPressed(false);
    }
  };
  useEffect(
    () => () => {
      input.release(bit);
    },
    [bit],
  );
  return (
    <button
      className={`tbtn ${className ?? ''}${pressed ? ' pressed' : ''}`}
      aria-label={label}
      data-testid={testId}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        pointers.current.add(e.pointerId);
        input.press(bit);
        setPressed(true);
      }}
      onPointerUp={(e) => release(e.pointerId)}
      onPointerCancel={(e) => release(e.pointerId)}
      onLostPointerCapture={(e) => release(e.pointerId)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

function useShowControls(): boolean {
  const pref = useStore((s) => s.settings.touchControls);
  const [coarse] = useState(() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    } catch {
      return true;
    }
  });
  return pref === 'on' || (pref === 'auto' && coarse);
}

export function RaceControls() {
  const show = useShowControls();
  const item = useHud((h) => h.item);
  const rolling = useHud((h) => h.itemRolling);
  const finished = useHud((h) => h.finished);
  const hasItem = item !== ITEM.None;
  if (finished) return null;
  return (
    <div className="controls" aria-label="Controles">
      {show ? (
        <div className="pad left">
          <HoldButton bit={BTN_DOWN} label="Deslizar" className="big" testId="btn-slide">
            <IconSlide />
            Deslizar
          </HoldButton>
        </div>
      ) : null}
      <div className="pad right">
        {hasItem ? (
          <HoldButton bit={BTN_ITEM} label={`Usar ${ITEM_NAMES[item] ?? 'ítem'}`} className={`item${rolling ? ' rolling' : ''}`} testId="btn-item">
            <ItemIcon item={rolling ? 9 : item} />
          </HoldButton>
        ) : null}
        {show ? (
          <HoldButton bit={BTN_JUMP} label="Saltar" className="big" testId="btn-jump">
            <IconJump />
            Saltar
          </HoldButton>
        ) : null}
      </div>
    </div>
  );
}

export function CoopControls() {
  const show = useShowControls();
  const action = useHud((h) => h.action);
  return (
    <div className="controls" aria-label="Controles">
      {show ? (
        <div className="pad left">
          <HoldButton bit={BTN_LEFT} label="Izquierda" testId="btn-left">
            <IconLeft />
          </HoldButton>
          <HoldButton bit={BTN_RIGHT} label="Derecha" testId="btn-right">
            <IconRight />
          </HoldButton>
        </div>
      ) : null}
      <div className="pad right">
        <HoldButton bit={BTN_ACTION} label="Acción" className={action ? 'highlight' : ''} testId="btn-action">
          <IconHand />
          {action === 'lever' ? 'Palanca' : action === 'console' ? 'Consola' : 'Acción'}
        </HoldButton>
        {show ? (
          <HoldButton bit={BTN_JUMP} label="Saltar" className="big" testId="btn-jump">
            <IconJump />
            Saltar
          </HoldButton>
        ) : null}
      </div>
    </div>
  );
}
