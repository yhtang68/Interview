/**
 * Renders the configured Remote Pod endpoint and YAML request body for selected tests.
 */

interface RemoteBodyValues {
  featureGroup: string;
  configName: string;
  jobName: string;
  testCasesBlock: string;
}

export function renderRemoteBody(template: string[], values: RemoteBodyValues): string {
  if (!Array.isArray(template) || template.length === 0) {
    throw new Error(
      'config/defaults.json podRunConfig.body must be a non-empty array of YAML lines.',
    );
  }
  return template
    .join('\n')
    .replaceAll('{{featureGroup}}', values.featureGroup)
    .replaceAll('{{configName}}', values.configName)
    .replaceAll('{{jobName}}', values.jobName)
    .replaceAll('{{testCasesBlock}}', values.testCasesBlock.trimEnd())
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface RemoteUrlValues {
  pathBranch: string;
  testsBranch: string;
  jobName: string;
}

type RemoteUrlParams = Record<string, string | number | boolean>;

export function renderRemoteUrl(
  host: string,
  params: RemoteUrlParams,
  values: RemoteUrlValues,
): string {
  if (!host || typeof host !== 'string') {
    throw new Error('config/defaults.json podRunConfig.host must be a URL.');
  }
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('config/defaults.json podRunConfig.params must be an object.');
  }
  const url = new URL(host);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Remote Pod URL must use HTTP or HTTPS.');
  const replacements: Record<string, string> = {
    '{{path_branch}}': values.pathBranch,
    '{{tests_branch}}': values.testsBranch,
    '{{jobname}}': values.jobName,
  };
  for (const [key, rawValue] of Object.entries(params)) {
    let value = String(rawValue);
    for (const [placeholder, replacement] of Object.entries(replacements)) {
      value = value.replaceAll(placeholder, replacement);
    }
    if (/\{\{[^}]+\}\}/.test(value)) {
      throw new Error(`Unresolved placeholder in podRunConfig.params.${key}: ${value}`);
    }
    url.searchParams.set(key, value);
  }
  return url.toString();
}
