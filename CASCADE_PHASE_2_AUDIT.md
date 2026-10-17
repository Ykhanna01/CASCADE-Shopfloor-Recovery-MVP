# CASCADE Recovery Engine and Dashboard Validation

## Scope and current verification

Reviewed the current branch's domain evaluator and tests, Postgres JSONB state store, REST routes, MCP adapter/tool registrations, React/Vite workflow, workspace configuration, and the older Replit audit attachment. The current implementation is not the same version described by that attachment or by the earlier audit text below it.

This Codespace has Node `v24.21.0`, pnpm `12.3.4`, workspace dependencies, and the committed pnpm lockfile. The sample environment file contains only a placeholder; no Replit production connection was attempted. A disposable PostgreSQL 16 container named `cascade-phase3-postgres` was created with port 5432 bound to `127.0.0.1`; its generated credentials were not printed or stored in the repository. The existing Drizzle `push` command created the table in the clean database, and the first API state request seeded the eight-order demo scenario.

## Differences from the older export notes

- The attached Replit brief describes `$520` expedite, `$470` local buy, and `$500` wait outcomes. Current deterministic code computes `$520` / 8 on-time / 0 late for expedite, `$310` / 6 on-time / 2 late for a Palmer local buy, and `$300` / 5 on-time / 3 late for wait. The last plan is infeasible because Palmer misses the hard Friday deadline. Brookside and Moreno are late under the local-buy projection.
- The current planner does not always prefer the local buy: its explicit policy ranks feasible plans by fewest late orders, then modeled cost, schedule changes, and stable plan ID. For Palmer, it recommends expedite (zero late orders). Non-target deadlines are preferences with a visible modeled `$100` per-late-order penalty; the selected target deadline is a hard constraint.
- Unlike the older findings, plans now use a deterministic dependency-ordered schedule, reserve unchanged machine commitments, check daily machine capacity and material inventory, and store an exact projection. Execution applies that projection, checks its input fingerprint, and requires approval. Verification independently recomputes order statuses and checks task dates, material inventory, machine capacity, dependencies, and forecast agreement.
- Impact is recomputed when a persisted disruption is loaded, and the UI can select persisted plans after refresh. At the Phase 3 checkpoint, no host browser was available; Phase 5 later completed interactive Chromium validation in a disposable browser container.
- The existing MCP route remains `POST /api/mcp`, uses Streamable HTTP and protocol version `2025-11-25`, and registers eight existing tools. The actual endpoint was exercised with the installed official MCP SDK. No ArmorIQ references were found in tracked source.

## Phase 3 integration results

- `pnpm --filter @workspace/db run push` succeeded against a clean disposable database. `GET /api/healthz` returned `{"status":"ok"}`. The first `GET /api/cascade/state` returned the seeded 8 orders, 4 materials, 4 machines, and 24 tasks.
- The API source was started with `PORT=5000 pnpm --filter @workspace/api-server exec tsx src/index.ts`, supplying the local `DATABASE_URL` only to that process. This deliberately avoided `@workspace/api-server`'s `dev` script, which rebuilds the bundled server. The frontend started with `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/cascade run dev`.
- An actual MCP SDK client initialized `/api/mcp`, negotiated `2025-11-25`, and listed the eight existing tools. The two-day plywood delay reported October 16 arrival and five exposed orders. Recovery proposal returned the three deterministic plans; the policy recommended expedite at `$520`, with 8 on-time and 0 late.
- Executing before approval returned an MCP tool error and left the plan proposed and plywood stock unchanged. Approval then execution succeeded. A same-request-ID retry left task dates unchanged, and action history contains exactly one `recovery_executed` event. Verification returned `verified: true`, 8 on-time, and 0 late. Independent checks passed for material inventory, machine capacity, task dependencies, order deadlines/statuses, and projected versus persisted task dates.
- Before correction, Vite returned the SPA HTML for `/api/cascade/state` with HTTP 200 because it had no API proxy. Added a development proxy to `http://127.0.0.1:5000`, overridable through `API_PROXY_TARGET`. The same Vite path now returns Express JSON. A Node built-in integration test verifies this forwarding.

## Confirmed defect and correction

Verification previously checked persisted inventory, capacity, dependencies, task-date/forecast agreement, and derived order-status counts, but did not independently enforce the selected plan's hard target deadline. A regression test altered Palmer's persisted finish date and forecast consistently; verification incorrectly succeeded. Verification now reports a hard-deadline violation when the selected order's independently derived persisted status is late. The regression confirms the altered state is rejected.

The local purchase unit estimate (`$110`) and late-order penalty (`$100`) remain explicit modeled assumptions in the domain code, not supplier quotes or observed production costs. Expedite cost is read from the scenario's material data. Result totals and deadline counts are computed from each evaluated plan; no vendor or customer is contacted.

## Baseline and final checks

- `pnpm --filter @workspace/api-server run test`: 14 passed, 0 failed.
- `pnpm --filter @workspace/cascade test`: 1 proxy integration test passed, 0 failed.
- `pnpm run typecheck`: passed across workspace libraries and artifact/script packages.
- `git diff --check`: passed.
- Live PostgreSQL REST/MCP workflow passed. Interactive browser validation was completed in Phase 5 using an isolated database and the preview on port 5174.

## Phase 4 dashboard update

- Reworked the existing React screen into a workshop overview with backend-derived active/risk counts, nearest active due date, booked hours, workflow stages, shipment dates, and current impact consequence.
- Recovery alternatives now appear side-by-side with actual cost, on-time/late counts, feasibility, status, recommendation marker, re-sequenced customer count, and risks. The UI states that Palmer's deadline is hard while other customer deadlines are trade-offs.
- The selected-plan view shows the engine rationale/actions, explicit approval and simulated-execution confirmation, persisted task/material results after execution, and the backend verification response. Failed verification is not displayed as a success state; verified plan details are re-requested when restoring a persisted verified scenario.
- Execution state mirrors superseded alternatives from the backend. The chronological customer order table, material arrival position, machine load, dependency sequence, and audit drawer remain in the existing dashboard.
- The local UI proxy regression passes. Full backend tests (14), proxy test (1), workspace typecheck, and frontend build pass. The frontend build emits a non-fatal sourcemap warning from `src/components/ui/tooltip.tsx`.
- Phase 5 browser replay confirmed desktop/mobile rendering, no page errors or horizontal overflow, restored plan/verification after refresh, and honest loading/error states.

## Phase 5 browser validation

- Preserved the original verified database and created a separate fresh database, `cascade_phase5_1792256847`, in the disposable local PostgreSQL container. The replay used API port 5001 and Vite preview port 5174.
- Chromium replayed the two-day plywood delay from a clean scenario. Impact reported 5 exposed orders, with nonempty affected tasks and dependency links. The generated plans matched backend data: expedite `$520` / 8 on-time / 0 late (recommended), local buy `$310` / 6 on-time / 2 late, and wait `$300` / infeasible / 5 on-time / 3 late.
- A direct pre-approval API request returned HTTP 400 without changing inventory, plan status, or task dates. The UI approval and confirmation gate then executed the selected plan; persisted schedule dates matched the projection and verification returned 8 on-time / 0 late.
- Retrying with the same request ID left schedule dates unchanged. Refresh restored the verified plan and verification panel; action history contained exactly one execution and one verification event.
- Chromium also rendered the loading state and an intercepted HTTP 503 error state, reported no page errors, and found no horizontal overflow at 390px width. The original verified database retained its plan throughout.
