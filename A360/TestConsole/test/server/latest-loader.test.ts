/**
 * Verifies expensive loads are coalesced and invalidated mid-build results are retried.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLatestLoader } from '../../server/latest-loader.js';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

test('coalesces concurrent loads and caches the completed value', async () => {
  let builds = 0;
  const loader = createLatestLoader({
    revision: () => 1,
    build: async () => ++builds,
  });

  assert.deepEqual(await Promise.all([loader.load(), loader.load()]), [1, 1]);
  assert.equal(await loader.load(), 1);
  assert.equal(builds, 1);
});

test('rebuilds when invalidated while a load is in progress', async () => {
  let revision = 1;
  const builds = [deferred<string>(), deferred<string>()];
  let buildIndex = 0;
  const loader = createLatestLoader({
    revision: () => revision,
    build: () => builds[buildIndex++].promise,
  });

  const result = loader.load();
  loader.invalidate();
  revision = 2;
  builds[0].resolve('stale');
  await new Promise((resolve) => setImmediate(resolve));
  builds[1].resolve('latest');

  assert.equal(await result, 'latest');
  assert.equal(await loader.load(), 'latest');
  assert.equal(buildIndex, 2);
});