/**
 * Renders primary navigation for switching and collapsing the Runner and History side panels.
 */

import styles from './navigation-rail.module.css';

export type ActivePanel = 'runner' | 'history';

interface NavigationRailProps {
  activePanel: ActivePanel;
  panelOpen: boolean;
  onSelect: (panel: ActivePanel) => void;
}

const Icon = ({ children }: { children: string }) => (
  <span className={styles.icon} aria-hidden="true">
    {children}
  </span>
);

export function NavigationRail({ activePanel, panelOpen, onSelect }: NavigationRailProps) {
  const runnerOpen = activePanel === 'runner' && panelOpen;
  const historyOpen = activePanel === 'history' && panelOpen;
  return (
    <aside className={styles.rail} aria-label="Primary navigation">
      <button
        className={activePanel === 'runner' ? styles.active : undefined}
        type="button"
        onClick={() => onSelect('runner')}
        aria-expanded={runnerOpen}
        aria-controls="side-panel"
        title={runnerOpen ? 'Close Runner Search Panel' : 'Open Runner'}
      >
        <Icon>⌕</Icon>
        <span>Runner</span>
      </button>
      <button
        className={activePanel === 'history' ? styles.active : undefined}
        type="button"
        onClick={() => onSelect('history')}
        aria-expanded={historyOpen}
        aria-controls="side-panel"
        title={historyOpen ? 'Close History Panel' : 'Open History'}
      >
        <Icon>◫</Icon>
        <span>History</span>
      </button>
      <button type="button" title="Settings is planned for a later release">
        <Icon>⚙</Icon>
        <span>Settings</span>
      </button>
    </aside>
  );
}