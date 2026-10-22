import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  allowedCorsOrigin,
  createApiAuthorizationMiddleware,
  createAuthRouter,
  createOriginGuard,
  FixedWindowRateLimiter,
  loadSecurityConfig,
} from "./lib/cascade/security";

const app: Express = express();
const securityConfig = loadSecurityConfig();
const rateLimiter = new FixedWindowRateLimiter();

app.disable("x-powered-by");
app.set("trust proxy", securityConfig.trustProxyHops);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(createOriginGuard(securityConfig));
app.use(cors({
  origin(origin, callback) {
    callback(null, allowedCorsOrigin(securityConfig, origin));
  },
  credentials: true,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Cascade-Scenario-ID", "MCP-Protocol-Version", "Accept", "Last-Event-ID"],
  exposedHeaders: ["MCP-Protocol-Version", "Mcp-Session-Id"],
}));
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

app.use("/api/auth", createAuthRouter(securityConfig, rateLimiter));
app.use("/api", createApiAuthorizationMiddleware(securityConfig, rateLimiter));
app.use("/api", router);

if (securityConfig.mode === "production") {
  const frontendRoot = fileURLToPath(new URL("../../cascade/dist/public/", import.meta.url));
  app.use(express.static(frontendRoot, { index: false }));
  app.get("/{*path}", (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile("index.html", { root: frontendRoot }, (error) => {
      if (error) next(error);
    });
  });
}

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 500;
  if (status >= 500) req.log.error({ err: error }, "Unhandled CASCADE request error");
  const safeStatus = status === 413 ? 413 : status === 400 ? 400 : 500;
  const message = safeStatus === 413
    ? "Request body exceeds the allowed size."
    : safeStatus === 400
      ? "Invalid request body."
      : "CASCADE request failed.";
  res.status(safeStatus).json({ error: message });
});

export default app;
