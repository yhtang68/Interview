/**
 * Converts selected tests and browser mode into local CLI arguments or Remote Pod YAML.
 */

export const testCaseArgs = (testNames: string[]): string[] =>
  testNames.length ? ['--test-cases', ...testNames] : [];

export const testCasesYaml = (testNames: string[]): string =>
  testNames.length
    ? `    TESTCASES:\n      INCLUDE:\n${testNames.map((name) => `        - ${name}`).join('\n')}\n`
    : '';

export const localDriverArgs = (browser: string | undefined): string[] =>
  browser && browser !== 'config' ? ['--localdriver', browser] : [];
