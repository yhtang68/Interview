/**
 * Covers catalog parsing, inheritance discovery, progress reporting, and performance summaries.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildCatalog,
  formatCatalogBuildSummary,
  parseConfig,
  parsePython,
  type CatalogBuildProgress,
} from '../../server/catalog.js';

test('formats catalog build performance for terminal output', () => {
  assert.equal(formatCatalogBuildSummary(18_505, 218.7), 'Catalog indexed 18,505 files in 219ms.');
  assert.equal(formatCatalogBuildSummary(18_505, 8_750), 'Catalog indexed 18,505 files in 8.8s.');
});

test('discovers indirect TestCase descendants', () => {
  const result = parsePython(
    'class Suite(TestSuite):\n pass\nclass Base(TestCase):\n pass\nclass VerifyThing(Base):\n pass\n',
    'a.py',
  );
  assert.deepEqual(result.suites, ['Suite']);
  assert.deepEqual(
    result.tests.map((x) => x.name),
    ['Base', 'VerifyThing'],
  );
});

test('does not expose internal base cases as runnable tests', () => {
  const source =
    'class Setup(TestCase):\n run_level = RunLevel.internal\nclass Verify(Setup):\n run_level = RunLevel.run\n';
  assert.deepEqual(
    parsePython(source, 'a.py').tests.map((x) => x.name),
    ['Verify'],
  );
});

test('reads environment name and suite class', () => {
  const result = parseConfig(
    'environment:\n  name: C360_UI_CFN_QA_{browser_name}\n  testsuite: MySuite\n',
    'a.yaml',
  );
  assert.equal(result.name, 'C360_UI_CFN_QA_{browser_name}');
  assert.equal(result.suiteClass, 'MySuite');
});

test('reports measured catalog build progress', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'test-console-catalog-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const group = path.join(root, 'trading');
  const config = path.join(group, 'config');
  await fs.mkdir(config, { recursive: true });
  await fs.writeFile(
    path.join(group, 'tests.py'),
    'class Suite(TestSuite):\n pass\nclass Verify(TestCase):\n pass\n',
  );
  await fs.writeFile(path.join(config, 'suite.yaml'), 'name: Demo\ntestsuite: Suite\n');
  const updates: CatalogBuildProgress[] = [];

  await buildCatalog(root, (progress) => updates.push(progress));

  assert.equal(updates[0].phase, 'discovering');
  assert.deepEqual(
    updates.filter((update) => update.phase === 'indexing').map((update) => update.percentage),
    [0, 50, 99],
  );
  assert.deepEqual(updates.at(-1), {
    phase: 'complete',
    processedFiles: 2,
    totalFiles: 2,
    percentage: 100,
  });
});
