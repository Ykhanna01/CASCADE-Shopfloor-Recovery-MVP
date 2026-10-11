import { Router, type IRouter } from "express";
import cascadeRouter from "./cascade";
import healthRouter from "./health";
import mcpRouter from "./mcp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cascadeRouter);
router.use(mcpRouter);

export default router;
