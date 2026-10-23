# CASCADE — Shopfloor Recovery Agent

CASCADE is a hackathon MVP for small custom-production workshops. It models a supplier delay against shared inventory, production dependencies, machine capacity, and customer deadlines, then compares deterministic recovery options.

**All workshop, supplier, customer, schedule, and cost information is fictional simulated data. CASCADE does not contact suppliers or update a real production system.**

## Architecture

- `artifacts/cascade/` contains the React/Vite dashboard. It calls typed REST routes; browser speech capture, when supported, only fills the scenario note.
- `artifacts/api-server/src/routes/cascade.ts` exposes the browser API, while `src/routes/mcp.ts` mounts the MCP endpoint at `/api/mcp`.
- `artifacts/api-server/src/lib/cascade/tools.ts` dispatches MCP and REST operations to shared domain logic in `domain.ts`.
- `artifacts/api-server/src/lib/cascade/store.ts` persists simulated workshop state and action history in PostgreSQL `cascade_state` JSONB rows. The legacy `northstar-demo` row remains readable; each explicit New demo creates a separate `demo-<request-UUID>` row.
- The MCP server uses the official TypeScript SDK and stateless Streamable HTTP. It is an MCP interface, not an Alexa+ skill or Alexa+ account/device integration.

All names, orders, suppliers, inventory, schedules, costs, and events are fictional. Supplier names and availability are scenario inputs, not live quotes or supplier connections. No supplier, customer, Alexa service, or production system is contacted.

## Local setup and development

Use Node `24.21.0` and pnpm `12.3.4`. Install dependencies from the repository root:

```sh
pnpm install --frozen-lockfile
```

For the recommended production topology, production environment-variable names, and deployment preflight, see [DEPLOYMENT.md](./DEPLOYMENT.md).

The API needs `DATABASE_URL`. For local work, use a dedicated, disposable PostgreSQL database; never point schema setup at production. Schema push changes its target database and should only be run for a fresh isolated local/staging database:

```sh
DATABASE_URL="$CASCADE_DEV_DATABASE_URL" pnpm --filter @workspace/db run push
```

Run the API and dashboard in separate terminals from the repository root:

```sh
DATABASE_URL="$CASCADE_DEV_DATABASE_URL" PORT=5000 pnpm --filter @workspace/api-server run dev
```

```sh
PORT=5173 BASE_PATH=/ API_PROXY_TARGET=http://127.0.0.1:5000 pnpm --filter @workspace/cascade run dev
```

The API `dev` script sets development auth mode, builds the API, then starts it. Vite requires both `PORT` and `BASE_PATH`; its API proxy defaults to `http://127.0.0.1:5000`.

Refresh data re-fetches the currently selected server state, action history, and health status; it does not reset or create a demo. New demo is a separate authenticated action that creates a fresh, isolated scenario with dates based on the current workweek. Scenario creation is idempotent for retries of the same request ID. Existing `northstar-demo` and earlier demo rows are not overwritten or deleted, and their audit history remains stored. Scenario selection is kept in the current browser tab's session storage. The existing text-key/JSONB table supports scenario rows without a schema migration.

An existing deployment may still open the legacy `northstar-demo` row with stale dates until an authorized user explicitly starts a New demo. That action adds a fresh row; it does not repair or erase old state.

The scenario API and stateless MCP endpoint accept `X-Cascade-Scenario-ID` to scope reads and workflow mutations to a demo row. Missing headers continue to use `northstar-demo` for backward compatibility. Browser state-changing calls, including New demo creation, retain the production session and CSRF checks; MCP mutations retain bearer-token authorization.

## MCP endpoint

The server implements the official TypeScript MCP SDK over Streamable HTTP:

- Endpoint: `/api/mcp`
- Protocol version: `2025-11-25`
- Server name: `cascade-shopfloor-recovery`
- Transport is stateless; simulated state and action history are stored in PostgreSQL.

Tools:

| Tool | Responsibility |
| --- | --- |
| `get_shop_state` | Read orders, inventory, machines, tasks, and plans |
| `simulate_disruption` | Apply a simulated supplier delay |
| `analyze_impact` | Trace affected tasks and orders through dependencies |
| `propose_recovery` | Compare expedite, partial-buy/re-sequence, and wait options |
| `approve_recovery` | Record explicit approval without execution |
| `execute_recovery` | Execute only an approved plan; accepts an idempotency `requestId` |
| `verify_recovery` | Compare the updated orders with the selected plan |
| `get_action_history` | Read the audit trail |

The browser simulator and MCP endpoint call the same domain operations through separate typed REST and MCP adapters. Production MCP requests require a separately configured bearer credential. Do not put that credential in the browser or frontend build.

### Recovery workflow and safeguards

1. Simulate a disruption for a selected material and delay. This changes fictional state only.
2. Trace affected production tasks and orders through inventory and task dependencies.
3. Compare deterministic expedite, partial-local-buy/re-sequence, and wait plans. Costs and late-order penalties are modeled assumptions, not vendor quotes.
4. The selected target order’s due date is a hard constraint; other due dates remain visible as trade-offs. Infeasible options are not recommended.
5. A user must explicitly approve a feasible plan. Approval alone does not execute it.
6. Execution is separately confirmed, applies only to simulated shop state, and uses a request ID for idempotency.
7. Verification checks persisted state against the plan projection. Action history records simulated disruption, proposal, approval, execution, and verification events.

The fictional Palmer example has these modeled outcomes for a fresh scenario and two-day plywood delay: expedite $520 / 8 on time / 0 late; partial buy $310 / 6 on time / 2 late; wait $300 / 5 on time / 3 late and infeasible because Palmer misses the hard deadline. These are model outputs, not real costs or commitments. For a timed walkthrough, see [DEMO_SCRIPT.md](./DEMO_SCRIPT.md).

## Alexa+ scope

This repository contains a Streamable HTTP MCP server and a browser dashboard. It does not contain evidence of a registered Alexa skill, Alexa+ account/device integration, an Alexa-hosted MCP connection, or end-to-end Alexa+ invocation. The dashboard’s optional browser speech recognition only inserts text into the scenario-note field; it does not invoke Alexa+ or interpret text as tool input. Describe this project as MCP-enabled and Alexa+ track-targeted, not as a completed Alexa+ integration.

## Test and typecheck

```sh
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/cascade run typecheck
pnpm --filter @workspace/cascade run test
pnpm run typecheck
```

The frontend production build uses the deployment-documented build arguments:

```sh
PORT=4173 BASE_PATH=/ pnpm --filter @workspace/cascade run build
pnpm --filter @workspace/api-server run build
```

The API tests cover domain and security safeguards plus actual MCP transport authentication, initialization, tool discovery, and invalid tool arguments. Database-backed MCP tool execution is not covered by the MCP transport test because no isolated test database is configured.

## Scenario

The sample workshop has eight fictional customer orders, four materials, four machines, and a deterministic production schedule anchored to the current workweek (or the next Monday on weekends). The built-in demonstration models a two-calendar-day cabinet-grade plywood delay: its Wednesday arrival moves to Friday, the Palmer hard deadline. Recovery options compare modeled costs and customer deadlines; approval is required before simulated execution, and verification checks the resulting state. No supplier is contacted or real production action taken.

## Submission readiness

The repository currently contains application source and a favicon, but no checked-in product screenshots, recorded walkthrough video, or submission-specific package. Before submitting, confirm the current hackathon portal requirements and prepare:

- A final video recording under three minutes (suggested shot list: [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)).
- Reviewer-ready screenshots captured from a fresh isolated scenario, if requested.
- A concise architecture diagram and project description if required by the portal.
- The repository URL and reviewer access method, with private credentials shared only through the approved submission mechanism.
- Evidence of Alexa+ track eligibility/integration only to the extent actually completed; do not imply Alexa+ invocation based on the MCP endpoint alone.

No submission URL, registration, reviewer account, or Alexa+ access is confirmed by this repository. Before recording from any deployed environment, verify displayed scenario dates and plans. Existing deployed `northstar-demo` data may be older than the current seed; do not reset production to make a recording.

## License

MIT. See [`LICENSE`](LICENSE).
