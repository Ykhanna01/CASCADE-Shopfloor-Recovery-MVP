import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import type { Request, Response } from "express";
import { logger } from "../logger";
import {
  dispatchCascadeTool,
} from "./tools";
import { toolInputSchemas } from "./tool-contracts";

export const CASCADE_MCP_PROTOCOL_VERSION = "2025-11-25";

if (LATEST_PROTOCOL_VERSION !== CASCADE_MCP_PROTOCOL_VERSION) {
  throw new Error(
    `CASCADE requires MCP protocol ${CASCADE_MCP_PROTOCOL_VERSION}; SDK default is ${LATEST_PROTOCOL_VERSION}.`,
  );
}

function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "cascade-shopfloor-recovery", version: "1.0.0" },
    { capabilities: { tools: { listChanged: false } } },
  );

  server.registerTool(
    "get_shop_state",
    {
      title: "Get workshop state",
      description:
        "Read the current fictional workshop orders, inventory, machines, schedule, and recovery plans. Data is simulated.",
    },
    async () =>
      runTool("get_shop_state", () => dispatchCascadeTool("get_shop_state")),
  );
  server.registerTool(
    "simulate_disruption",
    {
      title: "Simulate a supplier disruption",
      description:
        "Apply a simulated supplier delivery delay and return the deterministic impact graph. Does not contact a real supplier.",
      inputSchema: {
        materialId: toolInputSchemas.simulate_disruption.shape.materialId,
        delayDays: toolInputSchemas.simulate_disruption.shape.delayDays,
      },
    },
    async (args) =>
      runTool("simulate_disruption", () =>
        dispatchCascadeTool("simulate_disruption", args),
      ),
  );
  server.registerTool(
    "analyze_impact",
    {
      title: "Analyze production impact",
      description:
        "Analyze orders and dependent production tasks exposed to the active simulated supplier delay.",
    },
    async () =>
      runTool("analyze_impact", () => dispatchCascadeTool("analyze_impact")),
  );
  server.registerTool(
    "propose_recovery",
    {
      title: "Propose recovery plans",
      description:
        "Compare deterministic recovery options by cost, on-time orders, late orders, feasibility, and risk.",
      inputSchema: {
        targetOrderId: toolInputSchemas.propose_recovery.shape.targetOrderId,
      },
    },
    async (args) =>
      runTool("propose_recovery", () =>
        dispatchCascadeTool("propose_recovery", args),
      ),
  );
  server.registerTool(
    "approve_recovery",
    {
      title: "Approve a recovery plan",
      description:
        "Record explicit approval of a feasible plan. Approval does not execute any change.",
      inputSchema: {
        planId: toolInputSchemas.approve_recovery.shape.planId,
      },
    },
    async (args) =>
      runTool("approve_recovery", () =>
        dispatchCascadeTool("approve_recovery", args),
      ),
  );
  server.registerTool(
    "execute_recovery",
    {
      title: "Execute an approved recovery plan",
      description:
        "Apply one approved plan to the simulated shop state. Repeated execution is safe and does not duplicate changes.",
      inputSchema: {
        planId: toolInputSchemas.execute_recovery.shape.planId,
        requestId: toolInputSchemas.execute_recovery.shape.requestId,
      },
    },
    async (args) =>
      runTool("execute_recovery", () =>
        dispatchCascadeTool("execute_recovery", args),
      ),
  );
  server.registerTool(
    "verify_recovery",
    {
      title: "Verify recovery",
      description:
        "Check whether the current simulated order statuses match the executed recovery plan.",
      inputSchema: {
        planId: toolInputSchemas.verify_recovery.shape.planId,
      },
    },
    async (args) =>
      runTool("verify_recovery", () =>
        dispatchCascadeTool("verify_recovery", args),
      ),
  );
  server.registerTool(
    "get_action_history",
    {
      title: "Get action history",
      description:
        "Read the audit trail for simulated disruptions, proposed plans, approvals, executions, and verification.",
    },
    async () => {
      return runTool("get_action_history", async () => {
        const actions = await dispatchCascadeTool("get_action_history");
        return { actions };
      });
    },
  );

  return server;
}

function result(value: unknown) {
  const text = JSON.stringify(value, null, 2);
  const structuredContent =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { items: value };
  return {
    content: [{ type: "text" as const, text }],
    structuredContent,
  };
}

function errorResult(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown CASCADE tool error.";
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

async function runTool(
  name: string,
  operation: () => Promise<unknown>,
) {
  try {
    return result(await operation());
  } catch (error) {
    logger.warn({ tool: name, err: error }, "CASCADE MCP tool failed");
    return errorResult(error);
  }
}

export async function handleMcpRequest(
  req: Request,
  res: Response,
): Promise<void> {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    req.log.error({ err: error }, "CASCADE MCP request failed");
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal MCP server error." },
        id: null,
      });
    }
  }
}
