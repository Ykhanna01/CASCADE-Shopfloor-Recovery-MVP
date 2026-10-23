# Deployment Guide

## Recommended Topology

Use one Node web service and one managed PostgreSQL database, for example a Render web service plus Render PostgreSQL. The API serves the production-built CASCADE frontend from the same HTTPS origin and continues to handle `/api/*`. This keeps browser cookies, CSRF checks, and relative frontend API URLs same-origin without a separate CORS or rewrite layer.

Start with one API instance. The rate limiter is process-local and is not shared across replicas. See [Scaling](#scaling).

## Build And Start

Run these commands from the repository root. Use Node `24.21.0` and the repository's pnpm version (`12.3.4`); do not install a different global pnpm.

Build command:

```sh
pnpm install --frozen-lockfile
PORT=4173 BASE_PATH=/ pnpm --filter @workspace/cascade build
pnpm --filter @workspace/api-server build
```

Start command:

```sh
pnpm --filter @workspace/api-server start
```

The hosting platform must provide `PORT`. The API build bundles the backend; the frontend build output must remain at `artifacts/cascade/dist/public` next to the API workspace so the production server can serve it. Do not deploy only the API build output.

Configure the platform health check as `/api/readyz`. `/api/healthz` is liveness-only; readiness also runs `SELECT 1` against PostgreSQL.

## Environment Variables

Set secrets in the web service's secret manager. Never define backend secrets as frontend build variables.

| Variable | Required use |
| --- | --- |
| `NODE_ENV` | Set to `production`. |
| `CASCADE_AUTH_MODE` | Set to `production`; startup fails if production auth is not selected. |
| `PORT` | Supplied by the hosting platform. |
| `DATABASE_URL` | Managed PostgreSQL connection string. Use the provider's TLS-enabled connection string and verify its certificate behavior. |
| `CASCADE_WEB_PASSWORD` | Browser login password; at least 16 characters. |
| `CASCADE_SESSION_SECRET` | Session-signing secret; at least 32 bytes. |
| `CASCADE_MCP_BEARER_TOKEN` | MCP bearer credential; at least 32 bytes. |
| `CASCADE_ALLOWED_ORIGINS` | Exact comma-separated HTTPS origins only, with no path; for the recommended topology, the canonical web origin. |
| `CASCADE_TRUST_PROXY_HOPS` | Integer from 1 to 5 matching the number of trusted proxies in front of the service. Do not guess this value. |
| `LOG_LEVEL` | Optional Pino level; defaults to `info`. |

The three authentication secrets must be distinct. Generate them outside the repository and enter them directly in the provider's secret manager. The frontend build requires `PORT` and `BASE_PATH`; `API_PROXY_TARGET` is only used by the Vite development proxy and is not needed for this same-origin production topology.

## Database Initialization

The repository has no checked-in versioned SQL migration set. `pnpm --filter @workspace/db run push` runs Drizzle Kit schema push against `DATABASE_URL`; the API also idempotently inserts its initial simulated state when the CASCADE row is absent. It does not reset an existing row.

For deployment testing, create an empty, isolated staging database and run:

```sh
pnpm --filter @workspace/db run push
```

Do not run schema push automatically on every deploy or against an existing production database without a reviewed schema plan, backup, and explicit approval. The managed PostgreSQL URL must enable TLS; the application currently relies on the driver/connection URL for database TLS and does not explicitly configure an SSL policy in its pool.

## First Deployment

1. Create an empty staging PostgreSQL database and a single Node web service from the private repository.
2. Select Node `24.21.0`; set the build and start commands above.
3. Enter the required variables in the service's secret/environment settings. Use staging-only credentials and database access for the first deployment.
4. Confirm the service's external TLS certificate is active and determine the actual trusted proxy hop count from the host's documented request path. Set `CASCADE_TRUST_PROXY_HOPS` accordingly.
5. Run the schema push against the empty staging database, then start the service.
6. Confirm `/api/healthz` returns `200` and `/api/readyz` returns `200`.
7. Open the service's HTTPS origin in a browser. Log in, verify a `Secure`, `HttpOnly`, `SameSite=Strict` session cookie, then exercise a disruption, plan approval, execution, verification, and reload.
8. Confirm invalid origins, missing CSRF, unauthenticated mutations, and invalid MCP bearer credentials are rejected. Test MCP only with its separately configured bearer credential.

Do not treat passing builds or a staging workflow as proof that production secrets, backups, database access controls, proxy configuration, or operational monitoring are correct.

## Scaling

The login and API rate limits are stored in a process-local `Map`. A restart clears the buckets; multiple instances maintain independent counts, so requests distributed among instances can exceed the intended per-client limit. Keep one API instance for the initial deployment. Before horizontal scaling, move rate-limit state to a shared store or enforce equivalent limits at a trusted edge. Do not assume sticky sessions make this security control distributed.

Production logs are structured JSON. Request serialization omits query strings and Pino redacts authorization, cookie, and set-cookie headers. Keep logs access-controlled and avoid adding request bodies or secret environment values to log statements.