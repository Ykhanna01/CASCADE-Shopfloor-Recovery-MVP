import assert from "node:assert/strict";
import { createServer } from "node:http";
import express, { type Express } from "express";
import { once } from "node:events";
import test from "node:test";
import {
  createInitialState,
  type PersistedShopState,
} from "./domain";
import {
  createApiAuthorizationMiddleware,
  createAuthRouter,
  createOriginGuard,
  FixedWindowRateLimiter,
  type SecurityConfig,
} from "./security";
import { createCascadeRouter } from "../../routes/cascade";
import type { CascadeStateStore } from "./store";

const origin = "https://demo.example";
const config: SecurityConfig = {
  mode: "production",
  demoAuthEnabled: true,
  webPassword: "scenario-test-web-password",
  sessionSecret: "scenario-test-session-secret-longer-than-32-bytes",
  mcpBearerToken: "scenario-test-mcp-token",
  allowedOrigins: new Set([origin]),
  trustProxyHops: 1,
};

function inMemoryStore(): CascadeStateStore & { states: Map<string, PersistedShopState> } {
  const states = new Map<string, PersistedShopState>([
    ["northstar-demo", createInitialState(new Date("2026-10-22T12:00:00.000Z"))],
  ]);
  return {
    states,
    async readShopState(scenarioId = "northstar-demo") {
      const state = states.get(scenarioId);
      if (!state) throw new Error(`Missing scenario ${scenarioId}`);
      return state;
    },
    async mutateShopState(operation, scenarioId = "northstar-demo") {
      const current = states.get(scenarioId);
      if (!current) throw new Error(`Missing scenario ${scenarioId}`);
      const result = operation(current, new Date("2026-10-22T12:00:00.000Z"));
      states.set(scenarioId, result.state);
      return result.result;
    },
    async createDemoScenario(requestId, now = new Date("2026-10-22T12:00:00.000Z")) {
      const scenarioId = `demo-${requestId}`;
      if (!states.has(scenarioId)) states.set(scenarioId, createInitialState(now));
      return { scenarioId, state: states.get(scenarioId)! };
    },
  };
}

async function withServer<T>(
  app: Express,
  action: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    return await action(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function createApp(store: CascadeStateStore): Express {
  const app = express();
  const limiter = new FixedWindowRateLimiter();
  app.use(express.json({ limit: "64kb" }));
  app.use(createOriginGuard(config));
  app.use("/api/auth", createAuthRouter(config, limiter));
  app.use("/api", createApiAuthorizationMiddleware(config, limiter));
  app.use("/api", createCascadeRouter(store));
  return app;
}

async function login(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/auth/session`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ password: config.webPassword }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  const body = await response.json() as { csrfToken: string };
  return { cookie, csrfToken: body.csrfToken };
}

function headers(session?: { cookie: string; csrfToken: string }) {
  return {
    origin,
    ...(session ? { cookie: session.cookie, "x-csrf-token": session.csrfToken } : {}),
  };
}

test("new demo creation is authorized, idempotent, and preserves prior run history", async () => {
  const store = inMemoryStore();
  const app = createApp(store);
  await withServer(app, async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/api/cascade/scenarios`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ requestId: "f101b516-9117-4f1c-a81a-000000000001" }),
    });
    assert.equal(unauthorized.status, 401);
    const unauthorizedMutation = await fetch(`${baseUrl}/api/cascade/disruptions`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ materialId: "plywood", delayDays: 2 }),
    });
    assert.equal(unauthorizedMutation.status, 401);
    assert.equal(store.states.get("northstar-demo")?.disruption, null);

    const session = await login(baseUrl);
    const existing = store.states.get("northstar-demo")!;
    const stateWithHistory = {
      ...existing,
      actionHistory: [{
        id: "action-1",
        action: "disruption_simulated",
        description: "Existing simulated run",
        timestamp: "2026-10-22T12:00:00.000Z",
        planId: null,
        status: "simulated",
      }],
      disruption: {
        id: "old-disruption",
        materialId: "plywood",
        materialName: "Cabinet-grade plywood",
        delayDays: 2,
        originalArrivalDate: "2026-10-21",
        revisedArrivalDate: "2026-10-23",
        reportedAt: "2026-10-22T12:00:00.000Z",
        simulationLabel: "SIMULATED DEMO DATA",
      },
    };
    store.states.set("northstar-demo", stateWithHistory);

    const requestId = "f101b516-9117-4f1c-a81a-000000000002";
    const create = () => fetch(`${baseUrl}/api/cascade/scenarios`, {
      method: "POST",
      headers: { ...headers(session), "content-type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const first = await create();
    const retry = await create();
    const differentlyCasedRetry = await fetch(`${baseUrl}/api/cascade/scenarios`, {
      method: "POST",
      headers: { ...headers(session), "content-type": "application/json" },
      body: JSON.stringify({ requestId: requestId.toUpperCase() }),
    });
    assert.equal(first.status, 201);
    assert.equal(retry.status, 201);
    assert.equal(differentlyCasedRetry.status, 201);
    const firstBody = await first.json() as { scenarioId: string; state: PersistedShopState };
    const retryBody = await retry.json() as { scenarioId: string; state: PersistedShopState };
    const differentlyCasedBody = await differentlyCasedRetry.json() as {
      scenarioId: string;
      state: PersistedShopState;
    };
    assert.equal(firstBody.scenarioId, retryBody.scenarioId);
    assert.equal(firstBody.scenarioId, differentlyCasedBody.scenarioId);
    assert.equal(store.states.size, 2);
    assert.equal(firstBody.state.disruption, null);
    assert.equal(firstBody.state.plans.length, 0);
    assert.equal(store.states.get("northstar-demo")?.actionHistory.length, 1);
    assert.equal(store.states.get(firstBody.scenarioId)?.actionHistory.length, 0);

    const invalid = await fetch(`${baseUrl}/api/cascade/scenarios`, {
      method: "POST",
      headers: { ...headers(session), "content-type": "application/json" },
      body: JSON.stringify({ requestId: "not-a-uuid" }),
    });
    assert.equal(invalid.status, 400);
  });
});

test("scenario workflows are isolated and disruption impact matches recovery verification", async () => {
  const store = inMemoryStore();
  await withServer(createApp(store), async (baseUrl) => {
    const session = await login(baseUrl);
    const createScenario = async (requestId: string) => {
      const response = await fetch(`${baseUrl}/api/cascade/scenarios`, {
        method: "POST",
        headers: { ...headers(session), "content-type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      assert.equal(response.status, 201);
      return (await response.json() as { scenarioId: string }).scenarioId;
    };

    const firstId = await createScenario("f101b516-9117-4f1c-a81a-000000000003");
    const secondId = await createScenario("f101b516-9117-4f1c-a81a-000000000004");
    assert.notEqual(firstId, secondId);
    for (const scenarioId of [firstId, secondId]) {
      const fresh = store.states.get(scenarioId);
      assert.ok(fresh);
      assert.equal(fresh.disruption, null);
      assert.equal(fresh.plans.length, 0);
      assert.equal(fresh.actionHistory.length, 0);
    }
    const scenarioHeaders = (scenarioId: string) => ({
      ...headers(session),
      "x-cascade-scenario-id": scenarioId,
      "content-type": "application/json",
    });

    const simulate = await fetch(`${baseUrl}/api/cascade/disruptions`, {
      method: "POST",
      headers: scenarioHeaders(firstId),
      body: JSON.stringify({ materialId: "plywood", delayDays: 2 }),
    });
    assert.equal(simulate.status, 200);
    const impact = await simulate.json() as { affectedOrderIds: string[]; affectedTaskIds: string[] };
    assert.ok(impact.affectedOrderIds.length > 0);
    assert.ok(impact.affectedTaskIds.length > 0);

    const unaffectedStateResponse = await fetch(`${baseUrl}/api/cascade/state`, {
      headers: { "x-cascade-scenario-id": secondId },
    });
    const unaffectedState = await unaffectedStateResponse.json() as { disruption: unknown };
    assert.equal(unaffectedState.disruption, null);

    const plansResponse = await fetch(`${baseUrl}/api/cascade/recovery-plans`, {
      method: "POST",
      headers: scenarioHeaders(firstId),
      body: JSON.stringify({ targetOrderId: "PAL-204" }),
    });
    assert.equal(plansResponse.status, 200);
    const plans = await plansResponse.json() as Array<{
      id: string;
      feasible: boolean;
      onTimeOrders: number;
      lateOrders: number;
      status: string;
    }>;
    assert.equal(plans.length, 3);
    const recommended = plans.find((plan) => plan.feasible)!;
    assert.ok(recommended);

    const execute = (requestId: string) => fetch(
      `${baseUrl}/api/cascade/recovery-plans/${recommended.id}/execute`,
      {
        method: "POST",
        headers: scenarioHeaders(firstId),
        body: JSON.stringify({ requestId }),
      },
    );
    assert.equal((await execute("run-before-approval")).status, 400);

    const approve = await fetch(
      `${baseUrl}/api/cascade/recovery-plans/${recommended.id}/approve`,
      {
        method: "POST",
        headers: scenarioHeaders(firstId),
        body: "{}",
      },
    );
    assert.equal(approve.status, 200);
    assert.equal((await execute("idempotent-run-request")).status, 200);
    assert.equal((await execute("idempotent-run-request")).status, 200);
    assert.equal((await execute("different-retry-id")).status, 200);
    const verify = await fetch(
      `${baseUrl}/api/cascade/recovery-plans/${recommended.id}/verify`,
      {
        method: "POST",
        headers: scenarioHeaders(firstId),
        body: "{}",
      },
    );
    assert.equal(verify.status, 200);
    const verification = await verify.json() as {
      verified: boolean;
      onTimeOrders: number;
      lateOrders: number;
    };
    assert.equal(verification.verified, true);
    assert.equal(verification.onTimeOrders, recommended.onTimeOrders);
    assert.equal(verification.lateOrders, recommended.lateOrders);

    const secondSimulate = await fetch(`${baseUrl}/api/cascade/disruptions`, {
      method: "POST",
      headers: scenarioHeaders(secondId),
      body: JSON.stringify({ materialId: "plywood", delayDays: 2 }),
    });
    assert.equal(secondSimulate.status, 200);
    const secondPlansResponse = await fetch(`${baseUrl}/api/cascade/recovery-plans`, {
      method: "POST",
      headers: scenarioHeaders(secondId),
      body: JSON.stringify({ targetOrderId: "PAL-204" }),
    });
    assert.equal(secondPlansResponse.status, 200);
    const secondPlans = await secondPlansResponse.json() as typeof plans;
    const secondRecommended = secondPlans.find((plan) => plan.feasible)!;
    assert.ok(secondRecommended);
    const secondApprove = await fetch(
      `${baseUrl}/api/cascade/recovery-plans/${secondRecommended.id}/approve`,
      {
        method: "POST",
        headers: scenarioHeaders(secondId),
        body: "{}",
      },
    );
    assert.equal(secondApprove.status, 200);
    const secondExecute = await fetch(
      `${baseUrl}/api/cascade/recovery-plans/${secondRecommended.id}/execute`,
      {
        method: "POST",
        headers: scenarioHeaders(secondId),
        body: JSON.stringify({ requestId: "second-isolated-run" }),
      },
    );
    assert.equal(secondExecute.status, 200);
    const secondVerify = await fetch(
      `${baseUrl}/api/cascade/recovery-plans/${secondRecommended.id}/verify`,
      {
        method: "POST",
        headers: scenarioHeaders(secondId),
        body: "{}",
      },
    );
    assert.equal(secondVerify.status, 200);
    const secondVerification = await secondVerify.json() as typeof verification;
    assert.equal(secondVerification.verified, true);
    assert.equal(store.states.get(firstId)?.disruption?.materialId, "plywood");
    assert.equal(store.states.get(secondId)?.disruption?.materialId, "plywood");
    assert.equal(
      store.states.get(firstId)?.plans.find((plan) => plan.id === recommended.id)?.status,
      "verified",
    );
    assert.equal(
      store.states.get(secondId)?.plans.find((plan) => plan.id === secondRecommended.id)?.status,
      "verified",
    );

    const historyResponse = await fetch(`${baseUrl}/api/cascade/actions`, {
      headers: { "x-cascade-scenario-id": firstId },
    });
    const history = await historyResponse.json() as Array<{ action: string }>;
    assert.equal(history.filter((event) => event.action === "recovery_executed").length, 1);
    const secondHistoryResponse = await fetch(`${baseUrl}/api/cascade/actions`, {
      headers: { "x-cascade-scenario-id": secondId },
    });
    const secondHistory = await secondHistoryResponse.json() as Array<{ action: string }>;
    assert.equal(secondHistory.filter((event) => event.action === "recovery_executed").length, 1);
    assert.deepEqual(
      history.map((event) => event.action),
      ["disruption_simulated", "recovery_proposed", "recovery_approved", "recovery_executed", "recovery_verified"],
    );
  });
});

test("scenario headers reject malformed identifiers without touching state", async () => {
  const store = inMemoryStore();
  await withServer(createApp(store), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/cascade/state`, {
      headers: { "x-cascade-scenario-id": "northstar-demo/../../other" },
    });
    assert.equal(response.status, 400);
    assert.equal(store.states.size, 1);
  });
});

test("requests without a scenario header keep using the legacy default scenario", async () => {
  const store = inMemoryStore();
  await withServer(createApp(store), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/cascade/state`);
    assert.equal(response.status, 200);
    const state = await response.json() as { orders: Array<{ id: string }> };
    assert.equal(state.orders.length, store.states.get("northstar-demo")?.orders.length);
    assert.equal(store.states.size, 1);
  });
});

test("action history reads the selected scenario without mutating either scenario", async () => {
  const store = inMemoryStore();
  const selectedScenarioId = "demo-f101b516-9117-4f1c-a81a-000000000005";
  const defaultState = store.states.get("northstar-demo")!;
  const selectedState = createInitialState(new Date("2026-10-22T12:00:00.000Z"));
  const event = {
    id: "action-selected",
    action: "recovery_verified",
    description: "Selected demo history",
    timestamp: "2026-10-22T12:00:00.000Z",
    planId: "plan-selected",
    status: "verified",
  };
  store.states.set("northstar-demo", {
    ...defaultState,
    actionHistory: [{ ...event, id: "action-default", description: "Default history" }],
  });
  store.states.set(selectedScenarioId, {
    ...selectedState,
    actionHistory: [event],
  });
  const stateBefore = new Map(
    [...store.states].map(([id, state]) => [id, JSON.stringify(state)]),
  );

  await withServer(createApp(store), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/cascade/actions`, {
      headers: { "x-cascade-scenario-id": selectedScenarioId },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [event]);
    assert.deepEqual(
      [...store.states].map(([id, state]) => [id, JSON.stringify(state)]),
      [...stateBefore],
    );
  });
});
