/**
 * Resolves and watches Git HEAD metadata without performing recurring repository reads.
 */

import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';

export const resolveGitHeadPath = (repo: string, gitPath: string): string =>
  path.isAbsolute(gitPath) ? gitPath : path.resolve(repo, gitPath);

export const watchGitHead = (headPath: string, onChange: () => void): FSWatcher => {
  const headName = path.basename(headPath);
  return watch(path.dirname(headPath), (_eventType, filename) => {
    if (!filename || path.basename(filename.toString()) === headName) onChange();
  });
};