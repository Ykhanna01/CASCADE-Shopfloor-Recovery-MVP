import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import test from "node:test";

test("Vite forwards frontend API requests to the configured API server", async () => {
  const apiServer = createHttpServer((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ path: request.url }));
  });
  apiServer.listen(0, "127.0.0.1");
  await once(apiServer, "listening");

  const apiAddress = apiServer.address();
  assert.ok(apiAddress && typeof apiAddress !== "string");

  const environment = new Map(
    ["PORT", "BASE_PATH", "API_PROXY_TARGET"].map((key) => [
      key,
      process.env[key],
    ]),
  );
  const portServer = createHttpServer();
  portServer.listen(0, "127.0.0.1");
  await once(portServer, "listening");
  const portAddress = portServer.address();
  assert.ok(portAddress && typeof portAddress !== "string");
  await new Promise((resolve, reject) => {
    portServer.close((error) => (error ? reject(error) : resolve()));
  });

  process.env.PORT = String(portAddress.port);
  process.env.BASE_PATH = "/";
  process.env.API_PROXY_TARGET = `http://127.0.0.1:${apiAddress.port}`;

  let viteServer;
  try {
    viteServer = await createViteServer({
      configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
    });
    await viteServer.listen();

    const viteAddress = viteServer.httpServer?.address();
    assert.ok(viteAddress && typeof viteAddress !== "string");
    const response = await fetch(
      `http://127.0.0.1:${viteAddress.port}/api/cascade/state`,
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await response.json(), { path: "/api/cascade/state" });
  } finally {
    await viteServer?.close();
    await new Promise((resolve, reject) => {
      apiServer.close((error) => (error ? reject(error) : resolve()));
    });
    for (const [key, value] of environment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
