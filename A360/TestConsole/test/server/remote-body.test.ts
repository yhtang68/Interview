/**
 * Verifies rendering and encoding of Remote Pod request URLs and YAML bodies.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { renderRemoteBody, renderRemoteUrl } from '../../server/remote-body.js';

const template = [
  'NAME: {{featureGroup}}-mdl',
  'TESTJOBS:',
  '  - CONFIG: {{configName}}',
  '    NAME: {{jobName}}',
  '{{testCasesBlock}}',
  '',
  'TEAMS:',
  '  - {{featureGroup}}',
];

test('renders the configured remote body with selected test cases', () => {
  const body = renderRemoteBody(template, {
    featureGroup: 'trading',
    configName: 'SUITE_QA',
    jobName: 'job-name',
    testCasesBlock: '    TESTCASES:\n      INCLUDE:\n        - CaseOne\n',
  });
  assert.match(body, /CONFIG: SUITE_QA/);
  assert.match(body, /- CaseOne/);
  assert.match(body, /TEAMS:\n {2}- trading$/);
});

test('renders a suite-only body without TESTCASES', () => {
  const body = renderRemoteBody(template, {
    featureGroup: 'trading',
    configName: 'SUITE_QA',
    jobName: 'job-name',
    testCasesBlock: '',
  });
  assert.doesNotMatch(body, /TESTCASES/);
});
test('renders and URL-encodes the configured Remote Pod URL', () => {
  const url = renderRemoteUrl(
    'https://example.test/debugpod',
    {
      path_branch: '{{path_branch}}',
      tests_branch: '{{tests_branch}}',
      jobname: '{{jobname}}',
      publish: false,
    },
    { pathBranch: 'ATANG/feature one', testsBranch: 'develop', jobName: 'trading-test-atang' },
  );
  assert.equal(
    url,
    'https://example.test/debugpod?path_branch=ATANG%2Ffeature+one&tests_branch=develop&jobname=trading-test-atang&publish=false',
  );
});
