# LF vs CRLF Review

## 1. Git Source Normalization

The project uses `.gitattributes` with:

```gitattributes
* text=auto eol=lf
```

Git normalizes text files in the index and checks text files out as LF in the
working tree to comply with Codex's LF editing default. This prevents Windows
and Linux/macOS users from bouncing files back and forth just because of line
endings.

## 2. Workspace Manual Editing

VS Code is configured with:

```json
"files.eol": "\n"
```

This setting exists in both:

- `.vscode/settings.json`
- `CRD-PORTFOLIO-REBALANCING-QA.code-workspace`

Manual edits in VS Code should save as LF, even on Windows.

## 3. Codex Behavior

Codex editing through `apply_patch` tends to write LF by default.

That was why newly created or edited files from Codex appeared as LF even when
the project was temporarily configured for CRLF. Using Git-normalized text plus
VS Code LF saves makes Codex edits align with the project workflow.

## 4. Original Lint Concern

The line-ending review started because we previously saw or suspected
LF/CRLF-related lint friction.

After setting Git checkout normalization and VS Code saves to LF, the project
was verified with:

- `npm run build`
- `npm run lint`
- `npm run test:local`

All passed.

## 5. Binary Files

`.docx` and `.pdf` files are explicitly binary:

```gitattributes
*.docx binary
*.pdf binary
```

Git should not try to normalize line endings inside them.

## 6. Checking EOL State

`git diff` is not the right way to prove working-tree line endings changed,
because Git compares normalized text.

Use this instead:

```powershell
git ls-files --eol
```

That shows index and working-tree EOL state.

## 7. Final Policy

- Git normalizes text files and checks them out as LF.
- VS Code saves project files as LF.
- Codex writes LF by default.
- Build, lint, and local tests pass.
