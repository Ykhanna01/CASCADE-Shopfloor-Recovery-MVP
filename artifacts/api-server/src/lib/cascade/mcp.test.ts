import assert from "node:assert/strict";
import { createServer } from "node:http";
import express, { type Express, type IRouter } from "express";
import { once } from "node:events";
import test from "node:test";
import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import mcpRouter, { createMcpRouter } from "../../routes/mcp";
import { createInitialState, type PersistedShopState } from "./domain";
import {
  CASCADE_MCP_PROTOCOL_VERSION,
} from "./mcp";
import {
  createApiAuthorizationMiddleware,
  FixedWindowRateLimiter,
  type SecurityConfig,
} from "./security";
import type { CascadeStateStore } from "./store";

const bearerToken = "mcp-integration-test-token";
const testConfig: SecurityConfig = {
  mode: "production",
  demoAuthEnabled: true,
  mcpBearerToken: bearerToken,
  allowedOrigins: new Set(),
  trustProxyHops: 0,
};

async function withMcpServer<T>(
  action: (baseUrl: string) => Promise<T>,
  route: IRouter = mcpRouter,
): Promise<T> {
  const app: Express = express();
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", createApiAuthorizationMiddleware(
    testConfig,
    new FixedWindowRateLimiter(),
  ));
  app.use("/api", route);

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

function rpcRequest(
  baseUrl: string,
  id: number,
  method: string,
  params: Record<string, unknown> = {},
): Promise<Response> {
  return fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${bearerToken}`,
      "content-type": "application/json",
      "mcp-protocol-version": CASCADE_MCP_PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });
}

test("actual MCP endpoint authenticates and exposes the registered tools", async () => {
  await withMcpServer(async (baseUrl) => {
    const unauthenticated = await fetch(`${baseUrl}/api/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: CASCADE_MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "cascade-mcp-test", version: "1.0.0" },
        },
      }),
    });

    assert.equal(unauthenticated.status, 401);

    assert.ok(SUPPORTED_PROTOCOL_VERSIONS.includes(CASCADE_MCP_PROTOCOL_VERSION));
    const initialization = await rpcRequest(baseUrl, 2, "initialize", {
      protocolVersion: CASCADE_MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "cascade-mcp-test", version: "1.0.0" },
    });
    assert.equal(initialization.status, 200);
    const initialized = await initialization.json() as {
      result?: { protocolVersion?: string; capabilities?: unknown };
    };
    assert.equal(
      initialized.result?.protocolVersion,
      CASCADE_MCP_PROTOCOL_VERSION,
    );
    assert.ok(initialized.result?.capabilities);

    const toolsResponse = await rpcRequest(baseUrl, 3, "tools/list");
    assert.equal(toolsResponse.status, 200);
    const listed = await toolsResponse.json() as {
      result?: { tools?: Array<{ name: string }> };
    };
    assert.deepEqual(
      listed.result?.tools?.map((tool) => tool.name).sort(),
      [
        "analyze_impact",
        "approve_recovery",
        "execute_recovery",
        "get_action_history",
        "get_shop_state",
        "propose_recovery",
        "simulate_disruption",
        "verify_recovery",
      ],
    );

    const invalidCall = await rpcRequest(baseUrl, 4, "tools/call", {
      name: "simulate_disruption",
      arguments: { materialId: "plywood", delayDays: 0 },
    });
    assert.equal(invalidCall.status, 200);
    const rejected = await invalidCall.json() as {
      result?: { isError?: boolean; content?: Array<{ text?: string }> };
    };
    assert.equal(rejected.result?.isError, true);
    assert.match(
      rejected.result?.content?.[0]?.text ?? "",
      /invalid arguments/i,
    );
  });
});

test("MCP tools use an explicit scenario header and default to the legacy scenario", async () => {
  const states = new Map<string, PersistedShopState>([
    ["northstar-demo", createInitialState(new Date("2026-10-22T12:00:00.000Z"))],
    [
      "demo-f101b516-9117-4f1c-a81a-000000000001",
      createInitialState(new Date("2026-10-22T12:00:00.000Z")),
    ],
  ]);
  const readScenarioIds: string[] = [];
  const store: CascadeStateStore = {
    async readShopState(scenarioId = "northstar-demo") {
      readScenarioIds.push(scenarioId);
      const state = states.get(scenarioId);
      assert.ok(state);
      return state;
    },
    async mutateShopState(operation, scenarioId = "northstar-demo") {
      const state = states.get(scenarioId);
      assert.ok(state);
      const { state: next, result } = operation(
        state,
        new Date("2026-10-22T12:00:00.000Z"),
      );
      states.set(scenarioId, next);
      return result;
    },
    async createDemoScenario(requestId) {
      const scenarioId = `demo-${requestId}`;
      const state = createInitialState(new Date("2026-10-22T12:00:00.000Z"));
      states.set(scenarioId, state);
      return { scenarioId, state };
    },
  };

  await withMcpServer(async (baseUrl) => {
    const callTool = (id: number, scenarioId?: string) =>
      fetch(`${baseUrl}/api/mcp`, {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${bearerToken}`,
          "content-type": "application/json",
          "mcp-protocol-version": CASCADE_MCP_PROTOCOL_VERSION,
          ...(scenarioId ? { "x-cascade-scenario-id": scenarioId } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: "get_shop_state", arguments: {} },
        }),
      });

    const selectedScenario = "demo-f101b516-9117-4f1c-a81a-000000000001";
    const selectedResponse = await callTool(10, selectedScenario);
    assert.equal(selectedResponse.status, 200);
    assert.ok(readScenarioIds.includes(selectedScenario));

    const legacyResponse = await callTool(11);
    assert.equal(legacyResponse.status, 200);
    assert.ok(readScenarioIds.includes("northstar-demo"));

    const invalidResponse = await fetch(`${baseUrl}/api/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${bearerToken}`,
        "content-type": "application/json",
        "mcp-protocol-version": CASCADE_MCP_PROTOCOL_VERSION,
        "x-cascade-scenario-id": "../northstar-demo",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 12,
        method: "tools/call",
        params: { name: "get_shop_state", arguments: {} },
      }),
    });
    assert.equal(invalidResponse.status, 400);
  }, createMcpRouter(store));
});
