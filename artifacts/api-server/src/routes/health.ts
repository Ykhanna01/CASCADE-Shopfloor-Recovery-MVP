import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

export function createHealthRouter(checkDatabase: () => Promise<void>): IRouter {
  const router: IRouter = Router();

  router.get("/healthz", (_req, res) => {
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  });

  router.get("/readyz", async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not_ready" });
    }
  });

  return router;
}
