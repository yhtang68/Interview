/**
 * Builds the in-memory test/config catalog by parsing Python tests and YAML configuration files.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const CLASS_RE = /^class\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/gm;
const NAME_RE = /^\s*name:\s*["']?([^#\r\n"']+)/m;
const SUITE_RE = /^\s*testsuite:\s*["']?([^#\r\n"']+)/m;

export interface TestCaseEntry {
  name: string;
  file: string;
  base: string;
  line: number;
  relativeFile?: string;
  featureGroup?: string;
  configIds: string[];
}

export interface ConfigEntry {
  name: string;
  suiteClass: string;
  file: string;
  relativeFile?: string;
  featureGroup?: string;
}

export interface FeatureCatalog {
  configs: ConfigEntry[];
  tests: TestCaseEntry[];
}

export interface Catalog {
  generatedAt: string;
  groups: string[];
  features: Record<string, FeatureCatalog>;
}

export interface CatalogBuildProgress {
  phase: 'discovering' | 'indexing' | 'complete';
  processedFiles: number;
  totalFiles: number;
  percentage: number;
}

export type CatalogProgressReporter = (progress: CatalogBuildProgress) => void;

export function formatCatalogBuildSummary(totalFiles: number, durationMs: number) {
  const duration =
    durationMs < 1000 ? `${Math.round(durationMs)}ms` : `${(durationMs / 1000).toFixed(1)}s`;
  return `Catalog indexed ${totalFiles.toLocaleString('en-US')} files in ${duration}.`;
}

interface PythonClass {
  name: string;
  bases: string[];
  offset: number;
  body: string;
  internal: boolean;
}

async function walk(dir: string, output: string[] = []): Promise<string[]> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '__pycache__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, output);
    else output.push(full);
  }
  return output;
}

export function parsePython(
  source: string,
  file: string,
): { suites: string[]; tests: TestCaseEntry[] } {
  const classes: PythonClass[] = [];
  for (const match of source.matchAll(CLASS_RE)) {
    classes.push({
      name: match[1],
      bases: match[2].split(',').map((base) => base.trim().split('.').at(-1) ?? ''),
      offset: match.index,
      body: '',
      internal: false,
    });
  }
  classes.forEach((item, index) => {
    item.body = source.slice(item.offset, classes[index + 1]?.offset ?? source.length);
    item.internal = /run_level\s*=\s*RunLevel\.internal\b/.test(item.body);
  });
  const knownTests = new Set(['TestCase']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of classes) {
      if (!knownTests.has(item.name) && item.bases.some((base) => knownTests.has(base))) {
        knownTests.add(item.name);
        changed = true;
      }
    }
  }
  return {
    suites: classes.filter((item) => item.bases.includes('TestSuite')).map((item) => item.name),
    tests: classes
      .filter(
        (item) =>
          knownTests.has(item.name) &&
          item.name !== 'TestCase' &&
          !item.bases.includes('TestSuite') &&
          !item.internal,
      )
      .map((item) => ({
        name: item.name,
        file,
        base: item.bases[0] ?? '',
        line: source.slice(0, item.offset).split('\n').length,
        configIds: [],
      })),
  };
}

export function parseConfig(source: string, file: string): ConfigEntry {
  return {
    name: source.match(NAME_RE)?.[1]?.trim() || path.basename(file),
    suiteClass: source.match(SUITE_RE)?.[1]?.trim() || '',
    file,
  };
}

export async function buildCatalog(
  testsRoot: string,
  reportProgress?: CatalogProgressReporter,
): Promise<Catalog> {
  const report = (
    phase: CatalogBuildProgress['phase'],
    processedFiles: number,
    totalFiles: number,
  ) =>
    reportProgress?.({
      phase,
      processedFiles,
      totalFiles,
      percentage:
        phase === 'complete'
          ? 100
          : totalFiles > 0
            ? Math.min(99, Math.floor((processedFiles / totalFiles) * 100))
            : 0,
    });
  report('discovering', 0, 0);
  const groups = (await fs.readdir(testsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
  const filesByGroup = new Map<string, string[]>();
  for (const group of groups) filesByGroup.set(group, await walk(path.join(testsRoot, group)));
  const isConfig = (file: string) => /[/\\]config[/\\].+\.ya?ml$/i.test(file);
  const totalFiles = [...filesByGroup.values()].flat().filter(
    (file) => file.endsWith('.py') || isConfig(file),
  ).length;
  let processedFiles = 0;
  report('indexing', processedFiles, totalFiles);
  const features: Record<string, FeatureCatalog> = {};

  for (const group of groups) {
    const files = filesByGroup.get(group) ?? [];
    const suiteFiles = new Map<string, string>();
    const tests: TestCaseEntry[] = [];

    for (const file of files.filter((candidate) => candidate.endsWith('.py'))) {
      const parsed = parsePython(await fs.readFile(file, 'utf8'), file);
      report('indexing', ++processedFiles, totalFiles);
      parsed.suites.forEach((name) => suiteFiles.set(name, file));
      tests.push(
        ...parsed.tests.map((test) => ({
          ...test,
          relativeFile: path.relative(testsRoot, file),
          featureGroup: group,
        })),
      );
    }

    const configs: ConfigEntry[] = [];
    for (const file of files.filter(isConfig)) {
      configs.push({
        ...parseConfig(await fs.readFile(file, 'utf8'), file),
        relativeFile: path.relative(testsRoot, file),
        featureGroup: group,
      });
      report('indexing', ++processedFiles, totalFiles);
    }

    const configsBySuite: Record<string, ConfigEntry[]> = Object.groupBy(
      configs,
      (config) => config.suiteClass,
    ) as Record<string, ConfigEntry[]>;

    for (const test of tests) {
      const candidates = new Set<string>();
      if (suiteFiles.has(test.base)) candidates.add(test.base);
      for (const [suite, file] of suiteFiles) if (file === test.file) candidates.add(suite);
      test.configIds = [...candidates].flatMap((suite) =>
        (configsBySuite[suite] ?? []).map((config) => config.file),
      );
    }
    features[group] = { configs, tests };
  }
  report('complete', totalFiles, totalFiles);
  return { generatedAt: new Date().toISOString(), groups, features };
}
