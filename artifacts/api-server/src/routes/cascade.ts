import { Router, type IRouter, type Request, type Response } from "express";
import {
  ApproveRecoveryParams,
  ApproveRecoveryResponse,
  AnalyzeImpactResponse,
  ExecuteRecoveryBody,
  ExecuteRecoveryParams,
  ExecuteRecoveryResponse,
  GetActionHistoryResponse,
  GetShopStateResponse,
  ProposeRecoveryBody,
  ProposeRecoveryResponse,
  SimulateDisruptionBody,
  SimulateDisruptionResponse,
  VerifyRecoveryParams,
  VerifyRecoveryResponse,
} from "@workspace/api-zod";
import { DomainError, getShopView } from "../lib/cascade/domain";
import { dispatchCascadeTool } from "../lib/cascade/tools";
import { readShopState } from "../lib/cascade/store";

const router: IRouter = Router();
const INVALID_REQUEST_MESSAGE = "Invalid request input.";

function reportError(
  req: Request,
  res: Response,
  error: unknown,
): void {
  if (error instanceof DomainError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof Error && error.name === "ZodError") {
    res.status(400).json({ error: "Request validation failed." });
    return;
  }
  req.log.error({ err: error }, "CASCADE API request failed");
  res.status(500).json({ error: "CASCADE request failed." });
}

router.get("/cascade/state", async (req, res): Promise<void> => {
  try {
    const state = await readShopState();
    res.json(GetShopStateResponse.parse(getShopView(state)));
  } catch (error) {
    reportError(req, res, error);
  }
});

router.get("/cascade/actions", async (req, res): Promise<void> => {
  try {
    const state = await readShopState();
    res.json(GetActionHistoryResponse.parse(state.actionHistory));
  } catch (error) {
    reportError(req, res, error);
  }
});

router.post("/cascade/disruptions", async (req, res): Promise<void> => {
  const input = SimulateDisruptionBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: INVALID_REQUEST_MESSAGE });
    return;
  }
  try {
    const impact = await dispatchCascadeTool("simulate_disruption", input.data);
    res.json(SimulateDisruptionResponse.parse(impact));
  } catch (error) {
    reportError(req, res, error);
  }
});

router.post("/cascade/impact", async (req, res): Promise<void> => {
  try {
    const impact = await dispatchCascadeTool("analyze_impact");
    res.json(AnalyzeImpactResponse.parse(impact));
  } catch (error) {
    reportError(req, res, error);
  }
});

router.post("/cascade/recovery-plans", async (req, res): Promise<void> => {
  const input = ProposeRecoveryBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: INVALID_REQUEST_MESSAGE });
    return;
  }
  try {
    const plans = await dispatchCascadeTool("propose_recovery", input.data);
    res.json(ProposeRecoveryResponse.parse(plans));
  } catch (error) {
    reportError(req, res, error);
  }
});

router.post(
  "/cascade/recovery-plans/:planId/approve",
  async (req, res): Promise<void> => {
    const params = ApproveRecoveryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: INVALID_REQUEST_MESSAGE });
      return;
    }
    try {
      const plan = await dispatchCascadeTool("approve_recovery", params.data);
      res.json(ApproveRecoveryResponse.parse(plan));
    } catch (error) {
      reportError(req, res, error);
    }
  },
);

router.post(
  "/cascade/recovery-plans/:planId/execute",
  async (req, res): Promise<void> => {
    const params = ExecuteRecoveryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: INVALID_REQUEST_MESSAGE });
      return;
    }
    const input = ExecuteRecoveryBody.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: INVALID_REQUEST_MESSAGE });
      return;
    }
    try {
      const state = await dispatchCascadeTool("execute_recovery", {
        ...params.data,
        ...input.data,
      });
      res.json(ExecuteRecoveryResponse.parse(state));
    } catch (error) {
      reportError(req, res, error);
    }
  },
);

router.post(
  "/cascade/recovery-plans/:planId/verify",
  async (req, res): Promise<void> => {
    const params = VerifyRecoveryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: INVALID_REQUEST_MESSAGE });
      return;
    }
    try {
      const result = await dispatchCascadeTool("verify_recovery", params.data);
      res.json(VerifyRecoveryResponse.parse(result));
    } catch (error) {
      reportError(req, res, error);
    }
  },
);

export default router;
