import assert from "node:assert/strict";
import test from "node:test";
import {
  refetchAll,
  refreshActionHistory,
  refetchHistoryForWorkspace,
  refreshWorkspaceState,
  scenarioQueryKey,
  scenarioRequestHeaders,
} from "./workspace-refresh.mjs";

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

test("scenario query keys and request headers isolate the selected demo", () => {
  const baseKey = ["/api/cascade/actions"];
  assert.notDeepEqual(
    scenarioQueryKey(baseKey, "demo-first"),
    scenarioQueryKey(baseKey, "demo-second"),
  );
  assert.deepEqual(scenarioQueryKey(baseKey, null), [
    "/api/cascade/actions",
    "northstar-demo",
  ]);
  assert.deepEqual(scenarioRequestHeaders("demo-first"), {
    "x-cascade-scenario-id": "demo-first",
  });
  assert.deepEqual(scenarioRequestHeaders(null), {});
});

test("action history refresh exposes loading and success even when the history is unchanged", async () => {
  const statuses = [];
  const result = await refreshActionHistory({
    scenarioId: "demo-current",
    inFlight: { current: new Set() },
    isCurrentScenario: () => true,
    setStatus: (status) => statuses.push(status),
    refetch: async (scenarioId) => {
      assert.equal(scenarioId, "demo-current");
      return [];
    },
  });

  assert.equal(result, true);
  assert.deepEqual(statuses, [
    { scenarioId: "demo-current", pending: true, error: "", message: "" },
    {
      scenarioId: "demo-current",
      pending: false,
      error: "",
      message: "Action history refreshed.",
    },
  ]);
});

test("action history refresh reports failure and supports retry", async () => {
  const statuses = [];
  const inFlight = { current: new Set() };
  let calls = 0;
  const options = {
    scenarioId: "demo-current",
    inFlight,
    isCurrentScenario: () => true,
    setStatus: (status) => statuses.push(status),
    refetch: async () => {
      calls += 1;
      if (calls === 1) throw new Error("sensitive server detail");
      return [{ id: "latest-event" }];
    },
  };

  assert.equal(await refreshActionHistory(options), false);
  assert.equal(statuses.at(-1).error, "Could not reload action history. Check the connection and try again.");
  assert.doesNotMatch(statuses.at(-1).error, /sensitive server detail/);
  assert.equal(await refreshActionHistory(options), true);
  assert.equal(calls, 2);
  assert.equal(statuses.at(-1).message, "Action history refreshed.");
});

test("dashboard refresh clears history errors only after the current scenario history reloads", async () => {
  const scenarioId = "demo-current";
  let status = {
    scenarioId,
    pending: false,
    error: "",
    message: "",
  };
  const inFlight = { current: new Set() };
  const failHistoryRefresh = () => refreshActionHistory({
    scenarioId,
    inFlight,
    isCurrentScenario: () => true,
    setStatus: (next) => { status = next; },
    refetch: async () => {
      throw new Error("history unavailable");
    },
  });

  assert.equal(await failHistoryRefresh(), false);
  assert.equal(status.error, "Could not reload action history. Check the connection and try again.");

  const updateStatus = (update) => { status = update(status); };
  await refetchHistoryForWorkspace({
    scenarioId,
    isCurrentScenario: () => true,
    setStatus: updateStatus,
    refetch: async () => [{ id: "persisted-event" }],
  });
  assert.equal(status.error, "");
  assert.equal(status.message, "Action history refreshed.");

  await failHistoryRefresh();
  const errorAfterFailure = status.error;
  await assert.rejects(refetchHistoryForWorkspace({
    scenarioId,
    isCurrentScenario: () => true,
    setStatus: updateStatus,
    refetch: async () => {
      throw new Error("history still unavailable");
    },
  }), /history still unavailable/);
  assert.equal(status.error, errorAfterFailure);
});

test("a scenario switch does not show old history refresh state in the new demo", async () => {
  const statuses = [];
  const inFlight = { current: new Set() };
  let selectedScenario = "demo-old";
  let finishOldRefresh;
  const oldRefresh = refreshActionHistory({
    scenarioId: selectedScenario,
    inFlight,
    isCurrentScenario: () => selectedScenario === "demo-old",
    setStatus: (status) => statuses.push(status),
    refetch: () => new Promise((resolve) => {
      finishOldRefresh = resolve;
    }),
  });

  selectedScenario = "demo-new";
  assert.equal(await refreshActionHistory({
    scenarioId: selectedScenario,
    inFlight,
    isCurrentScenario: () => selectedScenario === "demo-new",
    setStatus: (status) => statuses.push(status),
    refetch: async (scenarioId) => assert.equal(scenarioId, "demo-new"),
  }), true);
  const currentStatus = statuses.at(-1);
  finishOldRefresh();
  assert.equal(await oldRefresh, true);
  assert.equal(statuses.at(-1), currentStatus);
  assert.equal(statuses.at(-1).scenarioId, "demo-new");
});

test("action history refresh prevents duplicate requests for one scenario", async () => {
  const inFlight = { current: new Set() };
  let resolveRefresh;
  let calls = 0;
  const options = {
    scenarioId: "demo-current",
    inFlight,
    isCurrentScenario: () => true,
    setStatus() {},
    refetch: () => {
      calls += 1;
      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    },
  };

  const first = refreshActionHistory(options);
  assert.equal(await refreshActionHistory(options), false);
  assert.equal(calls, 1);
  resolveRefresh();
  assert.equal(await first, true);
});
