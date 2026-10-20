/**
 * Verifies suite identity parsing, compact labels, and browser document titles.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { testSuiteDocumentTitle, testSuiteIdentity } from '../../src/title.js';

test('separates the environment from the compact Test Suite label', () => {
  const suiteName = 'C360_GROUP_BY_ASSET_CATEGORY_UI_GWN_QA_{browser_name}';
  assert.deepEqual(testSuiteIdentity(suiteName), {
    fullName: suiteName,
    displayName: 'C360_GROUP_BY_ASSET_CATEGORY_UI',
    tenant: 'GWN',
    stage: 'QA',
  });
});

test('shows the environment first and preserves the complete Test Suite name', () => {
  const suiteName = 'C360_GROUP_BY_ASSET_CATEGORY_UI_GWN_QA_{browser_name}';
  assert.equal(testSuiteDocumentTitle(suiteName), `GWN-QA · ${suiteName}`);
});

test('finds the environment in the config path when it is absent from the name', () => {
  const identity = testSuiteIdentity('AccountTests', 'config/account_tests_cfn_dev_web.yaml');
  assert.deepEqual(identity, {
    fullName: 'AccountTests',
    displayName: 'AccountTests',
    tenant: 'CFN',
    stage: 'DEV',
  });
  assert.equal(
    testSuiteDocumentTitle('AccountTests', 'config/account_tests_cfn_dev_web.yaml'),
    'CFN-DEV · AccountTests',
  );
});

test('uses the product title until a Test Suite is selected', () => {
  assert.equal(testSuiteDocumentTitle(), 'PATH Test Console');
});