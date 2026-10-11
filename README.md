# CASCADE — Shopfloor Recovery Agent

CASCADE is a hackathon MVP for small custom-production workshops. It models a supplier delay against shared inventory, production dependencies, machine capacity, and customer deadlines, then compares deterministic recovery options.

**All workshop, supplier, customer, schedule, and cost information is fictional simulated data. CASCADE does not contact suppliers or update a real production system.**

## Run in Replit

The project workflows start the web simulator and API server. The API uses the workspace PostgreSQL database.

For a fresh local environment:

```sh
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/cascade run dev
```

Required environment variable:

- `DATABASE_URL` — PostgreSQL connection string. Replit provides this to the API workflow.

See [`.env.example`](.env.example) for the local configuration shape.

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

The browser simulator uses the same tool operations as the MCP server test client through typed HTTP routes.

## Test and typecheck

```sh
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/cascade run typecheck
pnpm run typecheck
```

The tests cover the fixed scenario, valid and invalid inputs, dependency impact, alternative costs, approval gating, duplicate execution, and post-execution verification.

## Scenario

The sample workshop has eight fictional customer orders, four materials, four machines, and a Monday–Friday schedule for the week of October 12, 2026. The built-in demonstration delays cabinet-grade plywood by two days and asks whether the Palmer order can still ship Friday without making another customer late.

## License

MIT. See [`LICENSE`](LICENSE).
