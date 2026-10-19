import assert from "node:assert/strict";
import { createServer } from "node:http";
import express, { type Express } from "express";
import { once } from "node:events";
import test from "node:test";
import { createHealthRouter } from "../../routes/health";
import {
  approveRecovery,
  createInitialState,
  DomainError,
  executeRecovery,
  proposeRecovery,
  simulateDisruption,
  verifyRecovery,
  type PersistedShopState,
} from "./domain";
import { toolInputSchemas } from "./tool-contracts";
import {
  createApiAuthorizationMiddleware,
  createAuthRouter,
  createOriginGuard,
  FixedWindowRateLimiter,
  isAllowedOrigin,
  loadSecurityConfig,
  type SecurityConfig,
} from "./security";

const origin = "https://demo.example";
const testConfig: SecurityConfig = {
  mode: "production",
  webPassword: "test-only-web-password",
  sessionSecret: "test-only-session-secret-with-at-least-32-bytes",
  mcpBearerToken: "test-only-mcp-bearer-credential",
  allowedOrigins: new Set([origin]),
  trustProxyHops: 1,
};

async function withServer<T>(app: Express, action: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    return await action(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function securityTestApp(options: { limiter?: FixedWindowRateLimiter; mutationLimit?: boolean } = {}): Express {
  const app = express();
  const limiter = options.limiter ?? new FixedWindowRateLimiter();
  app.use(express.json({ limit: "64kb" }));
  app.use(createOriginGuard(testConfig));
  app.use("/api/auth", createAuthRouter(testConfig, limiter));
  app.use("/api", createApiAuthorizationMiddleware(testConfig, limiter));
  app.post("/api/cascade/disruptions", (request, response) => {
    const parsed = toolInputSchemas.simulate_disruption.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid disruption input." });
      return;
    }
    response.json({ authorized: true, input: parsed.data });
  });
  app.post("/api/cascade/impact", (_request, response) => {
    response.json({ reached: true });
  });
  app.post("/api/mcp", (_request, response) => {
    response.json({ reached: true });
  });
  return app;
}

function authorizedWorkflowTestApp(): Express {
  const app = express();
  const limiter = new FixedWindowRateLimiter();
  let state: PersistedShopState = createInitialState(new Date("2026-10-11T12:00:00.000Z"));
  app.use(express.json({ limit: "64kb" }));
  app.use(createOriginGuard(testConfig));
  app.use("/api/auth", createAuthRouter(testConfig, limiter));
  app.use("/api", createApiAuthorizationMiddleware(testConfig, limiter));
  app.post("/api/cascade/disruptions", (request, response) => {
    try {
      state = simulateDisruption(state, request.body.materialId, request.body.delayDays);
      response.json({ disruption: state.disruption });
    } catch (error) {
      response.status(error instanceof DomainError ? error.statusCode : 500).json({ error: error instanceof Error ? error.message : "Request failed." });
    }
  });
  app.post("/api/cascade/recovery-plans", (request, response) => {
    try {
      const result = proposeRecovery(state, request.body.targetOrderId);
      state = result.state;
      response.json(result.plans);
    } catch (error) {
      response.status(error instanceof DomainError ? error.statusCode : 500).json({ error: error instanceof Error ? error.message : "Request failed." });
    }
  });
  app.post("/api/cascade/recovery-plans/:planId/approve", (request, response) => {
    try {
      state = approveRecovery(state, request.params.planId);
      response.json({ status: state.plans.find((plan) => plan.id === request.params.planId)?.status });
    } catch (error) {
      response.status(error instanceof DomainError ? error.statusCode : 500).json({ error: error instanceof Error ? error.message : "Request failed." });
    }
  });
  app.post("/api/cascade/recovery-plans/:planId/execute", (request, response) => {
    try {
      state = executeRecovery(state, request.params.planId, request.body.requestId);
      response.json({ status: state.plans.find((plan) => plan.id === request.params.planId)?.status });
    } catch (error) {
      response.status(error instanceof DomainError ? error.statusCode : 500).json({ error: error instanceof Error ? error.message : "Request failed." });
    }
  });
  app.post("/api/cascade/recovery-plans/:planId/verify", (request, response) => {
    try {
      const result = verifyRecovery(state, request.params.planId);
      state = result.state;
      response.json(result.result);
    } catch (error) {
      response.status(error instanceof DomainError ? error.statusCode : 500).json({ error: error instanceof Error ? error.message : "Request failed." });
    }
  });
  return app;
}

async function createBrowserSession(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/auth/session`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ password: testConfig.webPassword }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  const session = await response.json() as { authenticated: boolean; csrfToken: string };
  assert.equal(session.authenticated, true);
  return { cookie, csrfToken: session.csrfToken };
}

test("production startup configuration fails closed without distinct required secrets", () => {
  assert.throws(
    () => loadSecurityConfig({ NODE_ENV: "production", CASCADE_AUTH_MODE: "production" }),
    /CASCADE_WEB_PASSWORD/,
  );
  assert.throws(
    () => loadSecurityConfig({
      NODE_ENV: "production",
      CASCADE_AUTH_MODE: "production",
      CASCADE_WEB_PASSWORD: "test-password-long-enough",
      CASCADE_SESSION_SECRET: "test-session-secret-long-enough-to-pass-32-bytes",
      CASCADE_MCP_BEARER_TOKEN: "test-mcp-token-long-enough-to-pass-32-bytes",
      CASCADE_TRUST_PROXY_HOPS: "1",
    }),
    /CASCADE_ALLOWED_ORIGINS/,
  );
  assert.throws(
    () => loadSecurityConfig({
      NODE_ENV: "production",
      CASCADE_AUTH_MODE: "production",
      CASCADE_WEB_PASSWORD: "same-secret-for-everything-long-enough",
      CASCADE_SESSION_SECRET: "same-secret-for-everything-long-enough",
      CASCADE_MCP_BEARER_TOKEN: "another-secret-that-is-at-least-32-bytes",
      CASCADE_ALLOWED_ORIGINS: origin,
      CASCADE_TRUST_PROXY_HOPS: "1",
    }),
    /must be distinct/,
  );
});

test("development permits localhost origins but rejects unconfigured external origins", () => {
  const config = loadSecurityConfig({ NODE_ENV: "development", CASCADE_AUTH_MODE: "development" });
  assert.equal(isAllowedOrigin("http://localhost:5173", config), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:4173", config), true);
  assert.equal(isAllowedOrigin("https://attacker.example", config), false);
});

test("unauthenticated browser mutations are rejected and do not reach handlers", async () => {
  await withServer(securityTestApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/cascade/disruptions`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ materialId: "plywood", delayDays: 2 }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required." });
  });
});

test("authenticated browser mutations require CSRF and then reach the authorized workflow", async () => {
  await withServer(securityTestApp(), async (baseUrl) => {
    const session = await createBrowserSession(baseUrl);
    const headers = {
      origin,
      cookie: session.cookie,
      "content-type": "application/json",
      "x-csrf-token": session.csrfToken,
    };
    const rejected = await fetch(`${baseUrl}/api/cascade/disruptions`, {
      method: "POST",
      headers: { ...headers, "x-csrf-token": "incorrect-csrf-token" },
      body: JSON.stringify({ materialId: "plywood", delayDays: 2 }),
    });
    assert.equal(rejected.status, 403);

    const accepted = await fetch(`${baseUrl}/api/cascade/disruptions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ materialId: "plywood", delayDays: 2 }),
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), {
      authorized: true,
      input: { materialId: "plywood", delayDays: 2 },
    });
  });
});

test("authenticated recovery workflow still enforces approval, verification, and idempotency", async () => {
  await withServer(authorizedWorkflowTestApp(), async (baseUrl) => {
    const session = await createBrowserSession(baseUrl);
    const headers = {
      origin,
      cookie: session.cookie,
      "x-csrf-token": session.csrfToken,
      "content-type": "application/json",
    };
    const call = async (path: string, body: unknown) => fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const impact = await call("/api/cascade/disruptions", { materialId: "plywood", delayDays: 2 });
    assert.equal(impact.status, 200);
    const proposal = await call("/api/cascade/recovery-plans", { targetOrderId: "PAL-204" });
    assert.equal(proposal.status, 200);
    const plans = await proposal.json() as Array<{ id: string; rationale: string; feasible: boolean }>;
    const recommended = plans.find((plan) => plan.rationale.startsWith("Recommended by policy"));
    assert.ok(recommended?.feasible);

    const executePath = `/api/cascade/recovery-plans/${recommended.id}/execute`;
    const unapproved = await call(executePath, { requestId: "test-request-1" });
    assert.equal(unapproved.status, 400);
    assert.match((await unapproved.json() as { error: string }).error, /Approval is required/);

    const approval = await call(`/api/cascade/recovery-plans/${recommended.id}/approve`, {});
    assert.equal(approval.status, 200);
    const firstExecution = await call(executePath, { requestId: "test-request-1" });
    assert.equal(firstExecution.status, 200);
    const retry = await call(executePath, { requestId: "test-request-1" });
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), await firstExecution.json());

    const verification = await call(`/api/cascade/recovery-plans/${recommended.id}/verify`, {});
    assert.equal(verification.status, 200);
    const result = await verification.json() as { verified: boolean; onTimeOrders: number; lateOrders: number };
    assert.equal(result.verified, true);
    assert.equal(result.onTimeOrders, 8);
    assert.equal(result.lateOrders, 0);
  });
});

test("MCP requests require a bearer token in production mode", async () => {
  await withServer(securityTestApp(), async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/api/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/api/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${testConfig.mcpBearerToken}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(authorized.status, 200);
    assert.deepEqual(await authorized.json(), { reached: true });
  });
});

test("invalid browser origins and invalid input are rejected", async () => {
  await withServer(securityTestApp(), async (baseUrl) => {
    const invalidOrigin = await fetch(`${baseUrl}/api/cascade/disruptions`, {
      method: "POST",
      headers: { origin: "https://untrusted.example", "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(invalidOrigin.status, 403);

    const session = await createBrowserSession(baseUrl);
    const invalidInput = await fetch(`${baseUrl}/api/cascade/disruptions`, {
      method: "POST",
      headers: {
        origin,
        cookie: session.cookie,
        "x-csrf-token": session.csrfToken,
        "content-type": "application/json",
      },
      body: JSON.stringify({ materialId: "", delayDays: 0 }),
    });
    assert.equal(invalidInput.status, 400);
    assert.deepEqual(await invalidInput.json(), { error: "Invalid disruption input." });
  });
});

test("API POST requests are rate limited", async () => {
  await withServer(securityTestApp(), async (baseUrl) => {
    for (let index = 0; index < 60; index += 1) {
      const response = await fetch(`${baseUrl}/api/cascade/impact`, { method: "POST" });
      assert.equal(response.status, 200);
    }
    const limited = await fetch(`${baseUrl}/api/cascade/impact`, { method: "POST" });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
  });
});

test("liveness remains available and readiness reflects database availability", async () => {
  const app = express();
  app.use(createHealthRouter(async () => {}));
  await withServer(app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);
    const ready = await fetch(`${baseUrl}/readyz`);
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: "ready" });
  });

  const unavailableApp = express();
  unavailableApp.use(createHealthRouter(async () => { throw new Error("database details must not leak"); }));
  await withServer(unavailableApp, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);
    const unavailable = await fetch(`${baseUrl}/readyz`);
    assert.equal(unavailable.status, 503);
    const body = await unavailable.text();
    assert.deepEqual(JSON.parse(body), { status: "not_ready" });
    assert.doesNotMatch(body, /database details/);
  });
});
