/**
 * Defines search entry types and pure filtering/path-validation logic without React UI.
 */

export interface SearchTestEntry {
  name: string;
  file: string;
  relativeFile?: string;
  configIds: string[];
}

export interface SearchConfigEntry {
  name: string;
  suiteClass: string;
  file: string;
  relativeFile?: string;
}

const includes = (value: unknown, query: string) =>
  String(value || '')
    .toLowerCase()
    .includes(query.toLowerCase());

export const normalizeFilePath = (value: string) =>
  value.trim().replace(/\//g, '\\').replace(/\\+/g, '\\').toLowerCase();

export const shortPath = (value?: string) => value?.replace(/^.*?tests[\\/]/i, '') || '';

export const searchNotFound = (
  query: string,
  isSearching: boolean,
  catalogUpdating: boolean,
  resultCount: number,
) => Boolean(query.trim()) && !isSearching && !catalogUpdating && resultCount === 0;

export const searchPathError = (
  query: string,
  isSearching: boolean,
  resultCount: number,
  indexedTestsRoot: string,
) => {
  if (isSearching || !/^[a-z]:[\\/]/i.test(query.trim()) || resultCount > 0) return '';
  return indexedTestsRoot && !normalizeFilePath(query).startsWith(`${indexedTestsRoot}\\`)
    ? `That path is outside the indexed test directory: ${indexedTestsRoot}`
    : 'No indexed test or config was found at that path. It may have moved, been deleted, or require Force index.';
};

const pathIncludes = (value: string | undefined, query: string) =>
  includes(value, query) ||
  (Boolean(value) && normalizeFilePath(value!).includes(normalizeFilePath(query)));

const directTestMatch = (test: SearchTestEntry, query: string) =>
  includes(test.name, query) ||
  pathIncludes(test.relativeFile, query) ||
  pathIncludes(test.file, query);

const directConfigMatch = (config: SearchConfigEntry, query: string) =>
  includes(config.name, query) ||
  includes(config.suiteClass, query) ||
  pathIncludes(config.relativeFile, query) ||
  pathIncludes(config.file, query);

const siblingConfigDirectory = (testFile: string) => {
  const normalized = normalizeFilePath(testFile);
  return `${normalized.slice(0, normalized.lastIndexOf('\\'))}\\config\\`;
};

const configMatchesTest = (config: SearchConfigEntry, test: SearchTestEntry) =>
  test.configIds.includes(config.file) ||
  normalizeFilePath(config.file).startsWith(siblingConfigDirectory(test.file));

export function filterTestEntries<T extends SearchTestEntry, C extends SearchConfigEntry>(
  tests: T[],
  configs: C[],
  query: string,
): T[] {
  if (!query) return tests;
  const matchingConfigs = configs.filter((config) => directConfigMatch(config, query));
  return tests.filter(
    (test) =>
      directTestMatch(test, query) ||
      matchingConfigs.some((config) => configMatchesTest(config, test)),
  );
}

export function filterConfigEntries<C extends SearchConfigEntry, T extends SearchTestEntry>(
  configs: C[],
  tests: T[],
  query: string,
): C[] {
  if (!query) return configs;
  const matchingTests = tests.filter((test) => directTestMatch(test, query));
  return configs.filter(
    (config) =>
      directConfigMatch(config, query) ||
      matchingTests.some((test) => configMatchesTest(config, test)),
  );
}
