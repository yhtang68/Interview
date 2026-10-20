/**
 * Interprets local process output and exit codes as the final TestConsole run result.
 */

export type LocalRunResult = {
  status: 'passed' | 'failed' | 'cancelled';
  exitCode: number | null;
};

const stripAnsi = (value: string): string => value.replace(/\u001b\[[0-9;]*m/g, '');

export function localRunResult(
  output: string,
  processExitCode: number | null,
  cancellationRequested = false,
): LocalRunResult {
  if (cancellationRequested) return { status: 'cancelled', exitCode: null };
  const text = stripAnsi(output);
  const failedCount = [...text.matchAll(/\bFailed\s*:\s*(\d+)\b/gi)].at(-1);
  const runStatus = [...text.matchAll(/\bRun Status\s*:\s*([^\r\n*]+)/gi)]
    .at(-1)?.[1]
    ?.trim()
    .toLowerCase();
  const summaryFailed =
    (failedCount && Number(failedCount[1]) > 0) ||
    (runStatus && /failure|failed|error/.test(runStatus));
  if (summaryFailed)
    return { status: 'failed', exitCode: processExitCode === 0 ? 1 : processExitCode };
  return { status: processExitCode === 0 ? 'passed' : 'failed', exitCode: processExitCode };
}
