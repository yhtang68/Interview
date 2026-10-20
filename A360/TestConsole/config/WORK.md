# Workspace-aware configuration work

**Status:** Design discussion only; no runtime behavior has been changed.

This note captures the configuration direction discussed before implementation. It is intentionally separate from
[`README.md`](README.md), which documents the configuration that works today.

## 1. Config Type

1. Use static, declarative `.json` configuration files.
2. Do not use executable `.js` or `.ts` configuration.

## 2. Default Config

1. Use source-controlled [`defaults.json`](defaults.json) as the shared baseline.
2. Default `${A360_PATH_WORKSPACE_ROOT}` to the parent directory of this `TRAD-Test-Automation` repository.
3. Expect `qa-path` and `qa-pathtestsuites` to be sibling repositories next to `TRAD-Test-Automation`.
4. At startup, check `A360_PATH_WORKSPACE_ROOT` first; use it when set, otherwise derive the default above.
5. Validate the resolved workspace before loading the catalog or starting the server.
6. Expand `${A360_PATH_WORKSPACE_ROOT}` in `defaults.json` instead of hard-coding `C:\PATH_Project`.

### Example directory tree

```text
C:/PATH_Project/                 [A360_PATH_WORKSPACE_ROOT]
|-- qa-path/
|-- qa-pathtestsuites/
|-- TRAD-Test-Automation/
|   +-- TestConsole/
+-- venv/
```

### Example configuration

Keep every resolved path visible where it is used:

```json
{
  "testSource": {
    "testsRoot": "${A360_PATH_WORKSPACE_ROOT}/qa-pathtestsuites/tests",
    "frameworkRepo": "${A360_PATH_WORKSPACE_ROOT}/qa-path",
    "testsRepo": "${A360_PATH_WORKSPACE_ROOT}/qa-pathtestsuites"
  },
  "localRunConfig": {
    "venvPath": "${A360_PATH_WORKSPACE_ROOT}/venv",
    "logDir": "${A360_PATH_WORKSPACE_ROOT}/qa-pathtestsuites/logs"
  }
}
```

## 3. Personal Config

1. Use only `defaults.json` unless Personal Config is enabled.
2. Add a Personal Config option under TestConsole Settings.
3. When enabled, use this default location:

   ```text
   %LOCALAPPDATA%\A360\PATH\TestConsole\config.override.json
   ```

4. Allow Settings to use another location, including a user-owned source-controlled path.
5. When `A360_PATH_OVERRIDE_FILE` exists and is non-empty, enable Personal Config at that path; otherwise ignore it.
6. Allow users to create or update the file through Settings or manually.
7. If the file exists, merge it over `defaults.json`; otherwise continue with defaults only.
8. Validate the merged configuration before use.

### Example personal config

```json
{
  "testSource": {
    "featureGroup": "document_management"
  }
}
```

## 4. Resolution Order

1. Resolve `A360_PATH_WORKSPACE_ROOT` from the environment or TestConsole's source directory.
2. Validate the workspace and its expected sibling directories.
3. Parse `defaults.json` and expand `${ENVIRONMENT_VARIABLE}` placeholders.
4. When Personal Config is enabled and its file exists, deep-merge it; objects merge while arrays and scalar values replace.
5. Reject unknown keys, type mismatches, unresolved placeholders, and invalid values.
6. Normalize paths and start services only after validation succeeds.

## 5. Implementation checklist

1. Add a typed loader and focused tests for discovery, interpolation, merge, and validation.
2. Add Settings controls to enable Personal Config, choose its location, and create or update the file.
3. Replace repeated `C:\PATH_Project` values with explicit workspace placeholders.
4. Preserve Remote Pod `{{runtimeValue}}` templates and `$WINDOWS_USER` behavior.
5. Document setup and actionable startup errors in `README.md`.
6. Run `npm run check` and smoke-test standard and nonstandard workspace layouts.
