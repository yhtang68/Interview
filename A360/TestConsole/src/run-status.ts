/**
 * Formats local and remote run state into concise status labels for History and live views.
 */

export interface StatusRun {
  kind: 'local' | 'remote';
  status: string;
  exitCode: number | null;
  httpStatus?: number;
}

export const runStatusLabel = (run: StatusRun, output = '') => {
  const label = run.status.charAt(0).toUpperCase() + run.status.slice(1);
  if (run.status === 'running') return 'Running';
  if (run.status === 'incomplete') return 'Incomplete';
  if (run.kind === 'remote') {
    const responseCode = run.httpStatus ?? run.exitCode;
    return `${label} - Response${responseCode != null ? ` (${responseCode})` : ''}`;
  }
  const plainOutput = output.replace(/\u001b\[[0-9;]*m/g, '');
  const summaryName = run.status === 'passed' ? 'Passed' : run.status === 'failed' ? 'Failed' : '';
  const count = summaryName
    ? [...plainOutput.matchAll(new RegExp(`\\b${summaryName}\\s*:\\s*(\\d+)`, 'gi'))].at(-1)?.[1]
    : undefined;
  return `${label} - Test${count !== undefined ? ` (${count})` : ''}`;
};
