import { Router, type IRouter } from "express";
import { handleMcpRequest } from "../lib/cascade/mcp";
import {
  cascadeStateStore,
  type CascadeStateStore,
} from "../lib/cascade/store";

export function createMcpRouter(
  store: CascadeStateStore = cascadeStateStore,
): IRouter {
  const router: IRouter = Router();

  router.all("/mcp", async (req, res): Promise<void> => {
    await handleMcpRequest(req, res, store);
  });
  return router;
}

export default createMcpRouter();
