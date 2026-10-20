/**
 * Extracts suite tenant/stage identity for compact labels and browser document titles.
 */

export type TestSuiteStage = 'DEV' | 'QA' | 'UAT' | 'PROD' | 'STAGE';

const ENVIRONMENT_RE =
  /(?:^|[_\\/-])([a-z0-9]+)[_-](dev|qa|uat|prod|stage|stg)(?:[_\\/.-]|$)/i;

export const testSuiteIdentity = (suiteName?: string, relativeFile?: string) => {
  const fullName = suiteName?.trim() || '';
  const nameMatch = fullName.match(ENVIRONMENT_RE);
  const match = nameMatch || `${fullName} ${relativeFile || ''}`.match(ENVIRONMENT_RE);
  const stage = match?.[2].toUpperCase().replace('STG', 'STAGE') as TestSuiteStage | undefined;
  const displayName = nameMatch
    ? `${fullName.slice(0, nameMatch.index)}${fullName.slice((nameMatch.index || 0) + nameMatch[0].length)}`
        .replace(/[_-]?\{browser_name\}/gi, '')
        .replace(/^[_-]+|[_-]+$/g, '')
    : fullName;
  return { fullName, displayName, tenant: match?.[1].toUpperCase() || '', stage };
};

export const testSuiteDocumentTitle = (suiteName?: string, relativeFile?: string): string => {
  const identity = testSuiteIdentity(suiteName, relativeFile);
  if (!identity.fullName) return 'PATH Test Console';
  const environment = identity.tenant ? `${identity.tenant}-${identity.stage}` : '';
  return `${environment ? `${environment} · ` : ''}${identity.fullName}`;
};