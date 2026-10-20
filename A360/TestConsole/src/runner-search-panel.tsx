/**
 * Renders Runner search UI and delegates pure matching to search.ts and selections to the app.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  filterConfigEntries,
  filterTestEntries,
  searchNotFound,
  searchPathError,
  shortPath,
  type SearchConfigEntry,
  type SearchTestEntry,
} from './search';
import styles from './runner-search-panel.module.css';

interface RunnerSearchTest extends SearchTestEntry {
  line: number;
}

interface RunnerSearchPanelProps<T extends RunnerSearchTest, C extends SearchConfigEntry> {
  groups: string[];
  group: string;
  feature: { tests: T[]; configs: C[] };
  indexedTestsRoot: string;
  selectedTests: T[];
  selectedConfig: C | null;
  suiteIncluded: boolean;
  catalogUpdating: boolean;
  onGroupChange: (group: string) => void;
  onToggleTest: (test: T) => void;
  onSelectConfig: (config: C, collapseTestSuite?: boolean) => void;
  onSuiteIncludedChange: (included: boolean) => void;
}

type SearchMode = 'tests' | 'configs';
const RESULT_LIMIT = 300;

export function RunnerSearchPanel<T extends RunnerSearchTest, C extends SearchConfigEntry>({
  groups,
  group,
  feature,
  indexedTestsRoot,
  selectedTests,
  selectedConfig,
  suiteIncluded,
  catalogUpdating,
  onGroupChange,
  onToggleTest,
  onSelectConfig,
  onSuiteIncludedChange,
}: RunnerSearchPanelProps<T, C>) {
  const [featureGroupOpen, setFeatureGroupOpen] = useState(false);
  const [mode, setMode] = useState<SearchMode>('tests');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filteredTests = useMemo(
    () => filterTestEntries(feature.tests, feature.configs, debouncedQuery),
    [feature, debouncedQuery],
  );
  const filteredConfigs = useMemo(
    () => filterConfigEntries(feature.configs, feature.tests, debouncedQuery),
    [feature, debouncedQuery],
  );
  const filtered = mode === 'tests' ? filteredTests : filteredConfigs;
  const isSearching = query.trim() !== debouncedQuery;
  const notFound = searchNotFound(debouncedQuery, isSearching, catalogUpdating, filtered.length);
  const pathError = searchPathError(
    debouncedQuery,
    isSearching,
    filtered.length,
    indexedTestsRoot,
  );
  const primaryGroup = groups.includes('trading') ? 'trading' : groups[0];

  return (
    <section className={styles.panel} data-side-panel-content>
      <div className={styles.featureHeader}>
        <button
          className={styles.featureFold}
          type="button"
          aria-expanded={featureGroupOpen}
          onClick={() => setFeatureGroupOpen((open) => !open)}
        >
          <span>
            <em className="fold-symbol">{featureGroupOpen ? '−' : '+'}</em> FEATURE GROUP —{' '}
            <strong>{group.charAt(0).toUpperCase() + group.slice(1)}</strong>
          </span>
        </button>
        {featureGroupOpen && (
          <label className={styles.featurePicker}>
            <select value={group} onChange={(event) => onGroupChange(event.target.value)}>
              <option>{primaryGroup}</option>
              {groups
                .filter((item) => item !== 'trading')
                .map((item) => (
                  <option key={item}>{item}</option>
                ))}
            </select>
          </label>
        )}
      </div>
      <div className={styles.modes} aria-live="polite">
        <button className={mode === 'tests' ? styles.active : ''} onClick={() => setMode('tests')}>
          Test Cases <span>{filteredTests.length}</span>
        </button>
        <button
          className={mode === 'configs' ? styles.active : ''}
          onClick={() => setMode('configs')}
        >
          Test Suites <span>{filteredConfigs.length}</span>
        </button>
      </div>
      <div
        className={`${styles.search} ${isSearching || catalogUpdating ? styles.pending : ''} ${notFound ? styles.notFound : ''}`}
      >
        <span className={styles.searchIcon} aria-hidden="true">
          ⌕
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={notFound}
          placeholder={`Search ${mode === 'tests' ? 'test name or .py file' : 'config name or .yaml file'}…`}
        />
        {(isSearching || catalogUpdating) && (
          <span className={styles.spinner} aria-label={catalogUpdating ? 'Updating test index' : 'Searching'} />
        )}
        {query && (
          <button onClick={() => setQuery('')} aria-label="Clear search">
            ×
          </button>
        )}
      </div>
      <div className={styles.searchSummary} aria-live="polite">
        {catalogUpdating ? (
          'Updating test index…'
        ) : isSearching ? (
          'Searching…'
        ) : filtered.length > RESULT_LIMIT ? (
          <span>Showing first {RESULT_LIMIT} of {filtered.length}</span>
        ) : null}
      </div>
      <div className={styles.results}>
        {mode === 'tests'
          ? filteredTests.slice(0, RESULT_LIMIT).map((test) => {
              const checked = selectedTests.some(
                (item) => item.name === test.name && item.file === test.file,
              );
              return (
                <button
                  key={test.name + test.file}
                  className={`${styles.result} ${checked ? styles.selected : ''}`}
                  onClick={() => onToggleTest(test)}
                >
                  <span className={styles.check}>{checked ? '✓' : ''}</span>
                  <span className={styles.resultContent}>
                    <b className={styles.resultName}>{test.name}</b>
                    <small
                      className={styles.filePath}
                      title={test.file}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {shortPath(test.relativeFile)}:{test.line}
                    </small>
                    {test.configIds.length > 0 && (
                      <em className={styles.metadata}>
                        {test.configIds.length} compatible config
                        {test.configIds.length !== 1 && 's'}
                      </em>
                    )}
                  </span>
                </button>
              );
            })
          : filteredConfigs.slice(0, RESULT_LIMIT).map((item) => {
              const selected = selectedConfig?.file === item.file;
              const checked = selected && suiteIncluded;
              return (
                <div
                  key={item.file}
                  className={`${styles.result} ${styles.configResult} ${selected ? styles.selected : ''}`}
                >
                  <label
                    className={styles.configCheck}
                    title={
                      checked
                        ? 'Exclude this Test Suite from the next run'
                        : 'Select and include this Test Suite in the next run'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        selected
                          ? onSuiteIncludedChange(!suiteIncluded)
                          : onSelectConfig(item, false)
                      }
                    />
                    <span>✓</span>
                  </label>
                  <button type="button" onClick={() => onSelectConfig(item)} title={item.file}>
                    <span className={styles.resultContent}>
                      <b className={`${styles.resultName} ${styles.configName}`}>{item.name}</b>
                      <small className={styles.filePath}>{shortPath(item.relativeFile)}</small>
                      <em className={styles.metadata}>{item.suiteClass}</em>
                    </span>
                  </button>
                </div>
              );
            })}
        {!filtered.length && !catalogUpdating && (
          <div className={`${styles.empty} ${pathError ? styles.pathError : ''}`}>
            {pathError || `No matching ${mode}.`}
          </div>
        )}
      </div>
    </section>
  );
}
