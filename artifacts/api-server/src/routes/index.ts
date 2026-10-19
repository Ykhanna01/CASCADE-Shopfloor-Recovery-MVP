import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import cascadeRouter from "./cascade";
import { createHealthRouter } from "./health";
import mcpRouter from "./mcp";

const router: IRouter = Router();
const healthRouter = createHealthRouter(async () => {
	await pool.query("SELECT 1");
});

router.use(healthRouter);
router.use(cascadeRouter);
router.use(mcpRouter);

export default router;
