import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";

export type AuthMode = "development" | "test" | "production";

export interface SecurityConfig {
  mode: AuthMode;
  webPassword?: string;
  sessionSecret?: string;
  mcpBearerToken?: string;
  allowedOrigins: Set<string>;
  trustProxyHops: number;
}

interface BrowserSession {
  csrfToken: string;
  expiresAt: number;
}

const SESSION_COOKIE = "cascade_session";
const SESSION_TTL_SECONDS = 6 * 60 * 60;
const MAX_RATE_LIMIT_BUCKETS = 10_000;
const MAX_REQUESTS_PER_MINUTE = 60;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();
  private nextCleanupAt = 0;

  consume(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    if (this.buckets.size >= MAX_RATE_LIMIT_BUCKETS && now >= this.nextCleanupAt) {
      for (const [bucketKey, bucket] of this.buckets) {
        if (bucket.expiresAt <= now) this.buckets.delete(bucketKey);
      }
      this.nextCleanupAt = now + 1_000;
    }

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      if (this.buckets.size >= MAX_RATE_LIMIT_BUCKETS) return false;
      this.buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return true;
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  }
}

function parseAllowedOrigins(value: string | undefined, production: boolean): Set<string> {
  const origins = new Set<string>();
  for (const entry of (value ?? "").split(",").map((part) => part.trim()).filter(Boolean)) {
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new Error("CASCADE_ALLOWED_ORIGINS must contain valid origins.");
    }
    if (url.origin !== entry || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("CASCADE_ALLOWED_ORIGINS must contain origin values only.");
    }
    if (production && url.protocol !== "https:") {
      throw new Error("Production CASCADE_ALLOWED_ORIGINS entries must use HTTPS.");
    }
    origins.add(url.origin);
  }
  if (production && origins.size === 0) {
    throw new Error("CASCADE_ALLOWED_ORIGINS is required in production.");
  }
  return origins;
}

export function loadSecurityConfig(env: NodeJS.ProcessEnv = process.env): SecurityConfig {
  const modeValue = env.CASCADE_AUTH_MODE;
  const nodeMode = env.NODE_ENV;
  const mode = modeValue ?? (nodeMode === "production" ? "production" : undefined);
  if (mode !== "development" && mode !== "test" && mode !== "production") {
    throw new Error("Set CASCADE_AUTH_MODE to development, test, or production.");
  }
  if (nodeMode === "production" && mode !== "production") {
    throw new Error("Production requires CASCADE_AUTH_MODE=production.");
  }
  if (mode === "development" && nodeMode !== "development") {
    throw new Error("CASCADE_AUTH_MODE=development requires NODE_ENV=development.");
  }
  if (mode === "test" && nodeMode !== "test") {
    throw new Error("CASCADE_AUTH_MODE=test requires NODE_ENV=test.");
  }

  const production = mode === "production";
  const webPassword = env.CASCADE_WEB_PASSWORD;
  const sessionSecret = env.CASCADE_SESSION_SECRET;
  const mcpBearerToken = env.CASCADE_MCP_BEARER_TOKEN;
  const trustProxyHops = Number(env.CASCADE_TRUST_PROXY_HOPS ?? "0");
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) {
    throw new Error("CASCADE_TRUST_PROXY_HOPS must be an integer from 0 to 5.");
  }
  if (production) {
    if (!webPassword || webPassword.length < 16) {
      throw new Error("CASCADE_WEB_PASSWORD must be at least 16 characters in production.");
    }
    if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
      throw new Error("CASCADE_SESSION_SECRET must be at least 32 bytes in production.");
    }
    if (!mcpBearerToken || Buffer.byteLength(mcpBearerToken) < 32) {
      throw new Error("CASCADE_MCP_BEARER_TOKEN must be at least 32 bytes in production.");
    }
    if (webPassword === sessionSecret || webPassword === mcpBearerToken || sessionSecret === mcpBearerToken) {
      throw new Error("Production authentication secrets must be distinct.");
    }
    if (trustProxyHops < 1) {
      throw new Error("CASCADE_TRUST_PROXY_HOPS must identify the trusted HTTPS proxy in production.");
    }
  }

  return {
    mode,
    webPassword,
    sessionSecret,
    mcpBearerToken,
    allowedOrigins: parseAllowedOrigins(env.CASCADE_ALLOWED_ORIGINS, production),
    trustProxyHops,
  };
}

export function isAllowedOrigin(origin: string, config: SecurityConfig): boolean {
  if (config.allowedOrigins.has(origin)) return true;
  if (config.mode !== "development" && config.mode !== "test") return false;

  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function readCookie(request: Request, name: string): string | undefined {
  for (const entry of (request.headers.cookie ?? "").split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    return entry.slice(separator + 1).trim();
  }
  return undefined;
}

function signSession(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function readBrowserSession(request: Request, config: SecurityConfig): BrowserSession | undefined {
  if (!config.sessionSecret) return undefined;
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return undefined;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return undefined;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!constantTimeEqual(signature, signSession(payload, config.sessionSecret))) return undefined;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as BrowserSession;
    if (
      typeof session.csrfToken !== "string" ||
      session.csrfToken.length < 32 ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) return undefined;
    return session;
  } catch {
    return undefined;
  }
}

function createSessionToken(config: SecurityConfig, now = Date.now()): { token: string; session: BrowserSession } {
  if (!config.sessionSecret) throw new Error("Browser session signing is not configured.");
  const session = {
    csrfToken: randomBytes(32).toString("base64url"),
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return { token: `${payload}.${signSession(payload, config.sessionSecret)}`, session };
}

function setSessionCookie(response: Response, token: string, secure: boolean): void {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/api; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`,
  );
}

function clearSessionCookie(response: Response, secure: boolean): void {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/api; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`,
  );
}

function requestKey(request: Request): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}

export function createAuthRouter(
  config: SecurityConfig,
  limiter = new FixedWindowRateLimiter(),
  now: () => number = Date.now,
) {
  const router = Router();
  router.get("/session", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (config.mode !== "production") {
      response.json({ authRequired: false, authenticated: true, csrfToken: null });
      return;
    }
    const session = readBrowserSession(request, config);
    response.json(session
      ? { authRequired: true, authenticated: true, csrfToken: session.csrfToken }
      : { authRequired: true, authenticated: false, csrfToken: null });
  });

  router.post("/session", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (config.mode === "production") {
      const origin = request.get("origin");
      if (!origin || !isAllowedOrigin(origin, config)) {
        response.status(403).json({ error: "Origin is not allowed." });
        return;
      }
    }
    if (!limiter.consume(`login:${requestKey(request)}`, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS, now())) {
      response.setHeader("Retry-After", String(Math.ceil(LOGIN_WINDOW_MS / 1000)));
      response.status(429).json({ error: "Too many login attempts. Try again later." });
      return;
    }
    if (config.mode !== "production") {
      response.status(404).json({ error: "Browser authentication is disabled in this mode." });
      return;
    }
    const password = request.body?.password;
    if (typeof password !== "string" || password.length > 256 || !config.webPassword || !constantTimeEqual(password, config.webPassword)) {
      response.status(401).json({ error: "Invalid credentials." });
      return;
    }
    const { token, session } = createSessionToken(config, now());
    setSessionCookie(response, token, true);
    response.json({ authenticated: true, csrfToken: session.csrfToken });
  });

  router.delete("/session", (request, response) => {
    if (config.mode === "production") {
      const session = readBrowserSession(request, config);
      if (!session) {
        response.status(401).json({ error: "Authentication required." });
        return;
      }
      const origin = request.get("origin");
      const csrfToken = request.get("x-csrf-token") ?? "";
      if (!origin || !isAllowedOrigin(origin, config) || !constantTimeEqual(session.csrfToken, csrfToken)) {
        response.status(403).json({ error: "Request could not be verified." });
        return;
      }
    }
    clearSessionCookie(response, config.mode === "production");
    response.status(204).end();
  });

  return router;
}

export function createOriginGuard(config: SecurityConfig) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.get("origin");
    if (origin && !isAllowedOrigin(origin, config)) {
      response.status(403).json({ error: "Origin is not allowed." });
      return;
    }
    next();
  };
}

function isStateChangingRestRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  return request.path === "/cascade/disruptions" ||
    request.path === "/cascade/recovery-plans" ||
    /^\/cascade\/recovery-plans\/[^/]+\/(?:approve|execute|verify)$/.test(request.path);
}

export function createApiAuthorizationMiddleware(
  config: SecurityConfig,
  limiter = new FixedWindowRateLimiter(),
  now: () => number = Date.now,
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (request.method === "OPTIONS") {
      next();
      return;
    }

    const isMcpRequest = request.path === "/mcp";
    const isMutation = isStateChangingRestRequest(request);
    const shouldRateLimit = isMcpRequest || request.method === "POST";
    if (!isMcpRequest && !isMutation && !shouldRateLimit) {
      next();
      return;
    }

    if (!limiter.consume(`${isMcpRequest ? "mcp" : "post"}:${requestKey(request)}`, MAX_REQUESTS_PER_MINUTE, 60_000, now())) {
      response.setHeader("Retry-After", "60");
      response.status(429).json({ error: "Too many requests. Try again later." });
      return;
    }

    if (!isMcpRequest && !isMutation) {
      next();
      return;
    }

    if (config.mode !== "production") {
      next();
      return;
    }

    if (isMcpRequest) {
      const authorization = request.get("authorization") ?? "";
      const match = authorization.match(/^Bearer\s+(.+)$/i);
      if (!match || !config.mcpBearerToken || !constantTimeEqual(match[1], config.mcpBearerToken)) {
        response.status(401).json({ error: "Authentication required." });
        return;
      }
      next();
      return;
    }

    const session = readBrowserSession(request, config);
    if (!session) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    const origin = request.get("origin");
    const csrfToken = request.get("x-csrf-token") ?? "";
    if (!origin || !isAllowedOrigin(origin, config) || !constantTimeEqual(session.csrfToken, csrfToken)) {
      response.status(403).json({ error: "Request could not be verified." });
      return;
    }
    next();
  };
}

export function createRateLimitMiddleware(
  limiter: FixedWindowRateLimiter,
  keyPrefix: string,
  limit: number,
  windowMs: number,
  now: () => number = Date.now,
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!limiter.consume(`${keyPrefix}:${requestKey(request)}`, limit, windowMs, now())) {
      response.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
      response.status(429).json({ error: "Too many requests. Try again later." });
      return;
    }
    next();
  };
}

export function allowedCorsOrigin(config: SecurityConfig, origin: string | undefined): boolean {
  return origin === undefined || isAllowedOrigin(origin, config);
}
