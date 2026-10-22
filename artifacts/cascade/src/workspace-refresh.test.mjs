import assert from "node:assert/strict";
import test from "node:test";
import { refetchAll, refreshWorkspaceState } from "./workspace-refresh.mjs";

test("workspace refresh waits for all refetched sections before clearing loading", async () => {
  const inFlight = { current: false };
  const calls = [];
  const displayed = { shop: null, history: null, health: null };
  const loading = [];
  const errors = [];
  const refreshed = await refreshWorkspaceState({
    inFlight,
    setLoading: (value) => loading.push(value),
    setError: (value) => errors.push(value),
    refetch: async () => {
      await Promise.all([
        Promise.resolve().then(() => {
          displayed.shop = { scenarioName: "Fresh scenario" };
          calls.push("shop");
        }),
        Promise.resolve().then(() => {
          displayed.history = [];
          calls.push("history");
        }),
        Promise.resolve().then(() => {
          displayed.health = { status: "ok" };
          calls.push("health");
        }),
      ]);
    },
  });

  assert.equal(refreshed, true);
  assert.deepEqual(calls.sort(), ["health", "history", "shop"]);
  assert.deepEqual(displayed, {
    shop: { scenarioName: "Fresh scenario" },
    history: [],
    health: { status: "ok" },
  });
  assert.deepEqual(loading, [true, false]);
  assert.deepEqual(errors, [""]);
  assert.equal(inFlight.current, false);
});

test("workspace refresh exposes request errors and always clears loading", async () => {
  const loading = [];
  const errors = [];
  let siblingFinished = false;
  const refreshed = await refreshWorkspaceState({
    inFlight: { current: false },
    setLoading: (value) => loading.push(value),
    setError: (value) => errors.push(value),
    refetch: async () => refetchAll([
      () => Promise.reject(new Error("HTTP 503: service unavailable")),
      () => new Promise((resolve) => setTimeout(() => {
        siblingFinished = true;
        resolve();
      }, 20)),
    ]),
  });

  assert.equal(refreshed, false);
  assert.equal(siblingFinished, true);
  assert.deepEqual(loading, [true, false]);
  assert.deepEqual(errors, ["", "HTTP 503: service unavailable"]);
});

test("refresh only re-fetches existing state and does not create or reset a demo", async () => {
  let fetched = 0;
  const refreshed = await refreshWorkspaceState({
    inFlight: { current: false },
    setLoading() {},
    setError() {},
    refetch: async () => {
      fetched += 1;
    },
  });

  assert.equal(refreshed, true);
  assert.equal(fetched, 1);
});

test("workspace refresh prevents overlapping requests", async () => {
  const inFlight = { current: false };
  let resolveFirst;
  let calls = 0;
  const refetch = () => {
    calls += 1;
    return new Promise((resolve) => {
      resolveFirst = resolve;
    });
  };
  const options = {
    inFlight,
    setLoading() {},
    setError() {},
    refetch,
  };

  const first = refreshWorkspaceState(options);
  const duplicate = await refreshWorkspaceState(options);
  assert.equal(duplicate, false);
  assert.equal(calls, 1);
  resolveFirst();
  assert.equal(await first, true);
});
