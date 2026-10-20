/**
 * Verifies the Azure login decision rules used before remote runs.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { needsAzureLogin } from '../../server/azure-session.js';

test('smart mode reuses an active Azure session', () => {
  assert.equal(needsAzureLogin(true), false);
});

test('smart mode requires az login when the session is unavailable', () => {
  assert.equal(needsAzureLogin(false), true);
});

test('logout mode always requires a fresh login', () => {
  assert.equal(needsAzureLogin(true, true), true);
});
