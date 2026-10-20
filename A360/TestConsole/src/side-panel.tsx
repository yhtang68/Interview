/**
 * Provides the shared resizable/collapsible shell used by Runner Search and History panels.
 */

import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import styles from './side-panel.module.css';

interface SidePanelProps {
  open: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  children: ReactNode;
}

export function SidePanel({ open, width, onWidthChange, children }: SidePanelProps) {
  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    document.body.classList.add('resizing-side-panel');
    const move = (pointerEvent: PointerEvent) => {
      const maximum = Math.min(680, Math.floor(window.innerWidth * 0.55));
      onWidthChange(Math.max(300, Math.min(maximum, startWidth + pointerEvent.clientX - startX)));
    };
    const stop = () => {
      document.body.classList.remove('resizing-side-panel');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  };

  return (
    <section id="side-panel" className={`${styles.panel} ${open ? '' : styles.collapsed}`}>
      <div
        className={styles.resizeHandle}
        role="separator"
        aria-label="Resize side panel"
        aria-orientation="vertical"
        onPointerDown={beginResize}
      />
      {children}
    </section>
  );
}
