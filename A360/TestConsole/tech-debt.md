# Test Console technical debt

**Last reviewed (Eastern Time):** August 18, 2026 11:14 PM Eastern Time

This register records worthwhile structural improvements that are intentionally deferred. It is a planning aid, not a commitment to redesign working behavior.

## Refactoring principles

- Preserve behavior first; investigate behavioral changes separately.
- Prefer small, independently validated extractions over a large rewrite.
- Keep deterministic transformations in named, pure functions.
- Use classes where state ownership, lifecycle, or interchangeable implementations become clearer.
- Prefer composition and interfaces; use inheritance only when implementations share a genuine contract and substantial behavior.
- Add characterization coverage before moving coupled state or effects.
- Do not add test or architecture dependencies without explicit approval.

## Risk tiers

| Tier | Typical change | Expected risk |
| --- | --- | --- |
| Low | Move stable JSX and its styles behind typed props | Primarily visual or wiring regressions |
| Medium | Move related state transitions into a reducer or custom hook | Stale state, effect ordering, or selection regressions |
| High | Redesign run streaming, persistence, cancellation, or server lifecycle | Concurrency, recovery, and historical-data regressions |

Refactoring can expose suspicious patterns—duplicated state, stale closures, inconsistent branches, or unclear ownership—but an observed issue should become a separate bug fix rather than being silently changed during extraction.

## 1. Continue decomposing `src/main.tsx`

### Current concern

`main.tsx` remains the primary composition root, but it also owns most Test Config selection, local/remote settings, run execution, live output, trace paging, History coordination, and a large central JSX tree. The extracted Header, Navigation Rail, Side Panel, Search, and History boundaries have reduced its size, but the remaining responsibilities are still tightly coupled.

### Candidate sequence

1. **Extract the execution trace panel — low risk**
   - Move the trace heading, pager, clear actions, local text output, and remote transaction display into a typed presentation component.
   - Keep run/output state and callbacks in `App` during the first extraction.
2. **Extract Test Config and run controls — low to medium risk**
   - Separate selected suite/cases, collapsible configuration sections, local settings, Remote Pod settings, and run/stop controls into focused components.
   - Continue passing values and callbacks explicitly before moving state ownership.
3. **Consolidate selection transitions — medium risk**
   - Model related test, config, suite, and compatibility updates as pure transition functions or a reducer.
   - Characterize invalidation behavior before changing the current nested state updates.
4. **Introduce domain hooks only where useful — medium to high risk**
   - Candidate boundaries are bootstrap/catalog synchronization, run execution and streaming, trace archives, and History coordination.
   - Avoid a single oversized `useRunState`; keep each hook responsible for one lifecycle.
5. **Finish style isolation — low risk**
   - Move styles with each extracted component and leave only application-wide tokens and layout rules in `styles.css`.

### Validation expectations

- Preserve active-run output when previewing another History entry.
- Preserve local and Remote Pod trace archives and paging.
- Preserve suite/test/config compatibility and whole-suite semantics.
- Preserve cancellation, rerun, Azure-session, and branch-mismatch behavior.
- Run focused domain tests and `npm run check` after every checkpoint.
- Add component interaction or browser smoke tests before moving the most coupled run-state effects; this requires approval for new test dependencies.

## 2. Decompose `server/index.ts`

### Current concern

`index.ts` is a flat Express composition module containing process-wide state, catalog lifecycle, Azure-session orchestration, run lifecycle, local and remote execution, route registration, middleware, and startup. It is valid TypeScript, but its state ownership and architectural relationships are difficult to see at a glance.

### Candidate hybrid design

Keep stateless behavior functional:

- Selection validation and request normalization
- PowerShell quoting and safe job-name generation
- Local argument and Remote Pod request construction
- Public run projection and result interpretation

Use classes for stateful lifecycle boundaries when they improve clarity:

- `CatalogService` for cached catalog state, build progress, refresh, and invalidation
- `RunManager` for run registration, status transitions, listeners, output, and cancellation
- `AzureSessionService` for token validation and login/logout orchestration
- `LocalRunExecutor` and `RemoteRunExecutor` as implementations of a shared execution contract

Route modules should remain thin registration functions that receive these dependencies. An abstract executor base class is justified only if both executors eventually share meaningful lifecycle behavior; otherwise, an interface plus composition is simpler.

### Candidate sequence

1. Add route and lifecycle characterization tests around current behavior.
2. Extract remaining pure transformations without changing API responses.
3. Introduce typed service boundaries around existing state.
4. Move route groups into catalog, run-query, local-run, and remote-run modules.
5. Leave `index.ts` responsible for dependency composition, middleware order, and server startup.

### Validation expectations

- Preserve endpoint paths, payloads, status codes, and Server-Sent Event ordering.
- Preserve eager, memory-only catalog indexing and watcher invalidation.
- Preserve process-tree cancellation and terminal run-state transitions.
- Preserve direct argument-array execution and avoid shell interpolation.
- Keep route registration order and final static/error middleware behavior explicit.

## Deferred decisions

- Choose component and hook names when each extraction begins rather than treating candidates above as fixed design.
- Decide whether UI component tests justify Vitest, React Testing Library, and a DOM implementation before adding dependencies.
- Revisit the server class boundaries only after `main.tsx` reaches a clearer composition shape.
- Migrate `padding-line-between-statements` to the ESLint Stylistic plugin before an eventual ESLint 11 upgrade.

## Completion criteria

The debt is resolved when `main.tsx` and `server/index.ts` primarily compose clearly named modules, state ownership is evident, pure logic remains independently testable, and the full regression suite plus agreed interaction checks pass without intentional behavior changes.