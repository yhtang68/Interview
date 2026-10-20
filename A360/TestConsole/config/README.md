# Test Console configuration

The source-controlled runtime defaults are stored in [`defaults.json`](defaults.json). The example below mirrors the current file and uses JSONC comments to explain each setting beside its value. Keep `defaults.json` as valid JSON without comments.

The proposed environment-backed path design and its unresolved decisions are tracked separately in
[`WORK.md`](WORK.md). That document is planning material; the configuration below remains the current behavior.

```jsonc
{
  "testSource": {
    "testsRoot": "C:\\PATH_Project\\qa-pathtestsuites\\tests",               // Root indexed for feature groups, test cases, and suite configs.
    "frameworkRepo": "C:\\PATH_Project\\qa-path",                            // QA-PATH checkout used for branch discovery.
    "testsRepo": "C:\\PATH_Project\\qa-pathtestsuites",                      // Test-suite checkout and local PATHCLI working directory.
    "featureGroup": "trading"                                                // Feature group selected when the app first loads.
  },
  "podRunConfig": {
    "host": "https://qa-automation.advisor360.com/pathapi/builds/debugpod",  // Remote Pod REST endpoint without query parameters.
    "params": {
      "path_branch": "{{path_branch}}",                                      // Replaced with the selected qa-path branch.
      "tests_branch": "{{tests_branch}}",                                    // Replaced with the selected qa-pathtestsuites branch.
      "jobname": "{{jobname}}",                                              // Replaced with the generated or manually edited job name.
      "publish": false,                                                      // Debug-pod publish option.
      "cache": false,                                                        // Debug-pod cache option.
      "numprocesses": 1                                                      // Number of remote test processes.
    },
    "body": [
      "NAME: {{featureGroup}}-mdl",                                          // Remote job model name.
      "SCHEDULED: true",
      "TESTJOBS:",
      "  - CONFIG: {{configName}}",                                          // Selected test-suite config.
      "    NAME: {{jobName}}",                                               // Resolved remote job name.
      "{{testCasesBlock}}",                                                  // Optional TESTCASES/INCLUDE block; empty for a full-suite run.
      "",
      "TEAMS:",
      "  - {{featureGroup}}"
    ],
    "userSuffix": "$WINDOWS_USER"                                            // Resolves to the signed-in operating-system username.
  },
  "historyConfig": {
    "retentionDays": 7                                                       // Keep browser History for 1–14 days; default is one week.
  },
  "developmentConfig": {
    "terminalSpinnerStyle": "classic"                                       // Terminal catalog spinner: "classic" (default) or "braille".
  },
  "localRunConfig": {
    "venvPath": "C:\\PATH_Project\\venv",                                    // Virtual environment containing pathcli.
    "browser": "chrome",                                                     // Default local browser override; use "config" for the browser in YAML.
    "allure": false,                                                         // Generate and serve an Allure report after a local run.
    "logDir": "C:\\PATH_Project\\qa-pathtestsuites\\logs"                    // PATHCLI log destination used with --log-env.
  }
}
```

Personal choices made in the UI currently reset when the app restarts. Do not add credentials, API tokens, or test-user secrets to `defaults.json`; local secrets continue to flow through Azure CLI and Key Vault.
