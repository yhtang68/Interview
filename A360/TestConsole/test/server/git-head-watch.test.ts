/**
 * Verifies Git HEAD path resolution and event-driven checkout detection.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveGitHeadPath, watchGitHead } from '../../server/git-head-watch.js';

test('resolves repository-relative and absolute Git HEAD paths', () => {
  const repo = path.resolve('example-repo');
  const absolute = path.resolve('linked-worktree', 'HEAD');

  assert.equal(resolveGitHeadPath(repo, path.join('.git', 'HEAD')), path.join(repo, '.git', 'HEAD'));
  assert.equal(resolveGitHeadPath(repo, absolute), absolute);
});

test('reports an operating-system event when Git HEAD changes', async (context) => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'test-console-git-head-'));
  const gitDir = path.join(repo, '.git');
  const headPath = path.join(gitDir, 'HEAD');
  await fs.mkdir(gitDir);
  await fs.writeFile(headPath, 'ref: refs/heads/feature/old\n');

  let resolveChange!: () => void;
  const changed = new Promise<void>((resolve) => {
    resolveChange = resolve;
  });
  const watcher = watchGitHead(headPath, resolveChange);
  context.after(async () => {
    watcher.close();
    await fs.rm(repo, { recursive: true, force: true });
  });

  await fs.writeFile(headPath, 'ref: refs/heads/develop\n');
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Git HEAD watcher did not report the checkout.')),
      2_000,
    );
    void changed.then(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
});