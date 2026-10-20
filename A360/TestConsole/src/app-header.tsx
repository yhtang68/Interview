/**
 * Renders product identity, repository branches, indexing controls, theme, and user identity.
 */

import styles from './app-header.module.css';

export type AppTheme = 'light' | 'dark';

interface AppHeaderProps {
  branches: { path: string; tests: string };
  indexing: boolean;
  lastSyncedAt: string | null;
  theme: AppTheme;
  user: { username: string; identity: string };
  onRefresh: () => void;
  onThemeToggle: () => void;
}

const initials = (username: string) => {
  const parts = username.split(/[._\-\s]+/).filter(Boolean);
  return (parts.length > 1 ? parts.map((part) => part[0]).join('') : username.slice(0, 2))
    .slice(0, 2)
    .toUpperCase();
};

export function AppHeader({
  branches,
  indexing,
  lastSyncedAt,
  theme,
  user,
  onRefresh,
  onThemeToggle,
}: AppHeaderProps) {
  const syncDate = lastSyncedAt ? new Date(lastSyncedAt) : null;
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.mark}>P</div>
        <div className={styles.brandCopy}>
          <b>PATH</b>
          <span>Test Console</span>
        </div>
      </div>
      <div className={styles.actions}>
        <div className={styles.repoBranches}>
          <span className={styles.branch}>
            <i />
            <b>qa-pathtestsuites</b>
            <em>{branches.tests}</em>
          </span>
          <span className={styles.branch}>
            <i />
            <b>qa-path</b>
            <em>{branches.path}</em>
          </span>
        </div>
        <div className={styles.indexControl}>
          <button
            className={styles.indexButton}
            type="button"
            onClick={onRefresh}
            disabled={indexing}
            title="Force a complete test index and repository branch refresh now."
          >
            {indexing ? '◌ Indexing…' : '↻ Force index'}
          </button>
          <small title={syncDate ? syncDate.toLocaleString() : 'Index has not synced yet'}>
            Last synced:{' '}
            {syncDate
              ? syncDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '—'}
          </small>
        </div>
        <button
          className={styles.themeToggle}
          type="button"
          onClick={onThemeToggle}
          aria-label={`Switch to ${nextTheme} theme`}
          title={`Switch to ${nextTheme} theme`}
        >
          {theme === 'light' ? '☾' : '☀'}
        </button>
        <button
          className={styles.avatar}
          type="button"
          title={user.identity}
          aria-label={`Windows user ${user.identity}`}
        >
          {initials(user.username) || 'U'}
        </button>
      </div>
    </header>
  );
}