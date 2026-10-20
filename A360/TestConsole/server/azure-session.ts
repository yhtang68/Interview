/**
 * Decides whether a remote run must establish a new Azure CLI session.
 */

export const needsAzureLogin = (sessionActive: boolean, flushSession = false): boolean =>
  flushSession || !sessionActive;
