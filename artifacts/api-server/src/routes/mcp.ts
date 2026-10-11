import { Router, type IRouter } from "express";
import { handleMcpRequest } from "../lib/cascade/mcp";

const router: IRouter = Router();

router.all("/mcp", async (req, res): Promise<void> => {
  await handleMcpRequest(req, res);
});

export default router;
