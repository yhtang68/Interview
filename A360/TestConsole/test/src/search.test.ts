/**
 * Verifies test/config search matching, path validation, and display-path formatting.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterConfigEntries,
  filterTestEntries,
  searchNotFound,
  searchPathError,
  shortPath,
} from '../../src/search.js';

const moduleFile =
  'C:\\PATH_Project\\qa-pathtestsuites\\tests\\trading\\ui\\P360\\models_new\\equivalencies_tab\\p360_equivalencies.py';
const suiteFile =
  'C:\\PATH_Project\\qa-pathtestsuites\\tests\\trading\\ui\\P360\\models_new\\equivalencies_tab\\config\\p360_equivalencies_config_gwn_qa_web.yaml';
const siblingFallbackFile =
  'C:\\PATH_Project\\qa-pathtestsuites\\tests\\trading\\ui\\P360\\models_new\\equivalencies_tab\\config\\p360_equivalencies_config_cfn_qa_web.yaml';
const unrelatedFile =
  'C:\\PATH_Project\\qa-pathtestsuites\\tests\\trading\\ui\\C360\\other\\config\\other_gwn_qa_web.yaml';

const tests = [
  {
    name: 'TradingEquivalenciesTabVerification',
    file: moduleFile,
    relativeFile: 'trading\\ui\\P360\\models_new\\equivalencies_tab\\p360_equivalencies.py',
    configIds: [suiteFile],
  },
  {
    name: 'EquivalencyIsNotDeletingFromEquivalencyTabAndAccountWhenDeleteEquivalencyFromTheModel',
    file: moduleFile,
    relativeFile: 'trading\\ui\\P360\\models_new\\equivalencies_tab\\p360_equivalencies.py',
    configIds: [suiteFile],
  },
  {
    name: 'UnrelatedCase',
    file: 'C:\\PATH_Project\\qa-pathtestsuites\\tests\\trading\\ui\\C360\\other\\other.py',
    relativeFile: 'trading\\ui\\C360\\other\\other.py',
    configIds: [unrelatedFile],
  },
];

const configs = [
  {
    name: 'P360_EQUIVALENCIES_UI_GWN_QA_{browser_name}',
    suiteClass: 'P360ModelsEquivalenciesUI',
    file: suiteFile,
    relativeFile:
      'trading\\ui\\P360\\models_new\\equivalencies_tab\\config\\p360_equivalencies_config_gwn_qa_web.yaml',
  },
  {
    name: 'P360_EQUIVALENCIES_UI_CFN_QA_{browser_name}',
    suiteClass: 'P360ModelsEquivalenciesUI',
    file: siblingFallbackFile,
    relativeFile:
      'trading\\ui\\P360\\models_new\\equivalencies_tab\\config\\p360_equivalencies_config_cfn_qa_web.yaml',
  },
  {
    name: 'OTHER_UI_GWN_QA_{browser_name}',
    suiteClass: 'OtherUI',
    file: unrelatedFile,
    relativeFile: 'trading\\ui\\C360\\other\\config\\other_gwn_qa_web.yaml',
  },
];

test('a Python absolute path resolves its test cases and sibling configs', () => {
  assert.deepEqual(
    filterTestEntries(tests, configs, moduleFile).map((item) => item.name),
    [
      'TradingEquivalenciesTabVerification',
      'EquivalencyIsNotDeletingFromEquivalencyTabAndAccountWhenDeleteEquivalencyFromTheModel',
    ],
  );
  assert.deepEqual(
    filterConfigEntries(configs, tests, moduleFile).map((item) => item.name),
    ['P360_EQUIVALENCIES_UI_GWN_QA_{browser_name}', 'P360_EQUIVALENCIES_UI_CFN_QA_{browser_name}'],
  );
});

test('forward-slash paths match the indexed Windows path', () => {
  assert.equal(filterTestEntries(tests, configs, moduleFile.replaceAll('\\', '/')).length, 2);
  assert.equal(filterConfigEntries(configs, tests, moduleFile.replaceAll('\\', '/')).length, 2);
});

test('a test-case name resolves the case and its configs interchangeably', () => {
  const query =
    'EquivalencyIsNotDeletingFromEquivalencyTabAndAccountWhenDeleteEquivalencyFromTheModel';
  assert.deepEqual(
    filterTestEntries(tests, configs, query).map((item) => item.name),
    [query],
  );
  assert.deepEqual(
    filterConfigEntries(configs, tests, query).map((item) => item.name),
    ['P360_EQUIVALENCIES_UI_GWN_QA_{browser_name}', 'P360_EQUIVALENCIES_UI_CFN_QA_{browser_name}'],
  );
});

test('a config name resolves the config and compatible module test cases', () => {
  const query = 'P360_EQUIVALENCIES_UI_GWN_QA';
  assert.equal(filterConfigEntries(configs, tests, query).length, 1);
  assert.equal(filterTestEntries(tests, configs, query).length, 2);
});

test('an unknown absolute path produces no matches in either tab', () => {
  const query = 'C:\\outside\\missing.py';
  assert.equal(filterTestEntries(tests, configs, query).length, 0);
  assert.equal(filterConfigEntries(configs, tests, query).length, 0);
});

test('an empty search returns complete tab counts', () => {
  assert.equal(filterTestEntries(tests, configs, '').length, tests.length);
  assert.equal(filterConfigEntries(configs, tests, '').length, configs.length);
});

test('absolute-path errors distinguish outside and missing indexed files', () => {
  const root = 'c:\\path_project\\qa-pathtestsuites\\tests';
  assert.equal(
    searchPathError('C:\\outside\\missing.py', false, 0, root),
    `That path is outside the indexed test directory: ${root}`,
  );
  assert.equal(
    searchPathError(`${root}\\missing.py`, false, 0, root),
    'No indexed test or config was found at that path. It may have moved, been deleted, or require Force index.',
  );
  assert.equal(searchPathError('missing.py', false, 0, root), '');
  assert.equal(searchPathError('C:\\outside\\missing.py', true, 0, root), '');
  assert.equal(searchPathError('C:\\outside\\found.py', false, 1, root), '');
});

test('not-found feedback waits for search and catalog updates to settle', () => {
  assert.equal(searchNotFound('MissingCase', false, false, 0), true);
  assert.equal(searchNotFound('MissingCase', true, false, 0), false);
  assert.equal(searchNotFound('MissingCase', false, true, 0), false);
  assert.equal(searchNotFound('ExistingCase', false, false, 1), false);
  assert.equal(searchNotFound('', false, false, 0), false);
});

test('display paths remain relative to the tests directory', () => {
  assert.equal(shortPath(moduleFile), 'trading\\ui\\P360\\models_new\\equivalencies_tab\\p360_equivalencies.py');
  assert.equal(shortPath('trading\\ui\\case.py'), 'trading\\ui\\case.py');
  assert.equal(shortPath(), '');
});
