# CASCADE — Shopfloor Recovery Agent

CASCADE is a voice-first simulator that models supplier disruptions in a fictional custom-production workshop and compares deterministic recovery plans.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/api-server run test` — test deterministic recovery logic
- `pnpm --filter @workspace/cascade run dev` — run the browser simulator
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- MCP: `POST /api/mcp` using Streamable HTTP, protocol version `2025-11-25`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- MCP: official `@modelcontextprotocol/sdk`, Streamable HTTP
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/cascade` — React/Vite operations simulator
- `artifacts/api-server/src/lib/cascade` — deterministic scenario, impact, recovery, persistence, and MCP tools
- `lib/api-spec/openapi.yaml` — REST contract used by generated hooks and validation
- `lib/db/src/schema/cascade-state.ts` — persistent simulated state row
- `README.md` — run steps, MCP tools, test commands, and scenario

## Architecture decisions

- The API's REST routes and MCP tools dispatch through the same deterministic domain functions.
- One PostgreSQL row stores the demo state, plans, idempotency records, and audit history; mutations lock that row in a transaction.
- The MCP endpoint is stateless between HTTP requests; shop state itself is persisted.
- Simulated data and mutations never contact real suppliers or production systems.

## Product

- Inspect eight customer orders, four shared materials, machine capacity, and dependent production tasks.
- Simulate a two-day supplier delay, review its production graph, compare recovery alternatives, approve and execute a plan, verify the resulting order statuses, and inspect the action history.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run codegen before building against generated schemas or hooks.
- Push new development schema changes with `pnpm --filter @workspace/db run push`.
- Do not present the fictional shop, customers, supplier names, or recovery costs as real.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
