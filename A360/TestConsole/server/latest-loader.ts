/**
 * Coalesces expensive loads while retrying when their source changes during a build.
 */

interface LatestLoaderOptions<T> {
  build: () => Promise<T>;
  revision: () => number;
}

export interface LatestLoader<T> {
  invalidate: () => void;
  load: (force?: boolean) => Promise<T>;
}

export function createLatestLoader<T>({ build, revision }: LatestLoaderOptions<T>): LatestLoader<T> {
  let cached: T | undefined;
  let activeLoad: Promise<T> | undefined;

  const buildLatest = async () => {
    while (true) {
      const startedRevision = revision();
      const result = await build();
      if (startedRevision !== revision()) continue;
      cached = result;
      return result;
    }
  };

  return {
    invalidate: () => {
      cached = undefined;
    },
    load: (force = false) => {
      if (cached !== undefined && !force) return Promise.resolve(cached);
      if (!activeLoad)
        activeLoad = buildLatest().finally(() => {
          activeLoad = undefined;
        });
      return activeLoad;
    },
  };
}