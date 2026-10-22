import assert from "node:assert/strict";
import { createServer } from "node:http";
import express, { type Express } from "express";
import { once } from "node:events";
import test from "node:test";
import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import mcpRouter from "../../routes/mcp";
import {
  CASCADE_MCP_PROTOCOL_VERSION,
} from "./mcp";
import {
  createApiAuthorizationMiddleware,
  FixedWindowRateLimiter,
  type SecurityConfig,
} from "./security";

const bearerToken = "mcp-integration-test-token";
const testConfig: SecurityConfig = {
  mode: "production",
  mcpBearerToken: bearerToken,
  allowedOrigins: new Set(),
  trustProxyHops: 0,
};

async function withMcpServer<T>(
  action: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app: Express = express();
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", createApiAuthorizationMiddleware(
    testConfig,
    new FixedWindowRateLimiter(),
  ));
  app.use("/api", mcpRouter);

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
