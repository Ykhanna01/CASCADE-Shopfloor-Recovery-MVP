import assert from "node:assert/strict";
import test from "node:test";
import {
  approveRecovery,
  analyzeImpact,
  createInitialState,
  DomainError,
  executeRecovery,
  getShopView,
  proposeRecovery,
  simulateDisruption,
  verifyRecovery,
} from "./domain";
import { toolInputSchemas } from "./tool-contracts";

const fixedNow = new Date("2026-10-11T12:00:00.000Z");

function disruptedScenario() {
  const initial = createInitialState(fixedNow);
  const disrupted = simulateDisruption(initial, "plywood", 2, fixedNow);
  return { initial, disrupted };
}

function assertIndependentScheduleChecks(
  state: ReturnType<typeof createInitialState>,
) {
  const machineLoads = new Map<string, number>();
  for (const task of state.tasks) {
    if (task.status === "complete") continue;
    const key = `${task.machineId}:${task.scheduledDate}`;
    machineLoads.set(key, (machineLoads.get(key) ?? 0) + task.durationHours);
    for (const dependencyId of task.dependsOn) {
      const dependency = state.tasks.find((item) => item.id === dependencyId);
      assert.ok(dependency, `missing dependency ${dependencyId}`);
      assert.ok(
        dependency.scheduledDate < task.scheduledDate,
        `${task.id} must follow ${dependencyId}`,
      );
    }
  }
  for (const [key, hours] of machineLoads) {
    const machineId = key.slice(0, key.indexOf(":"));
    const machine = state.machines.find((item) => item.id === machineId)!;
    assert.ok(
      hours <= machine.hoursPerDay,
      `${key} has ${hours} hours above the ${machine.hoursPerDay}-hour limit`,
    );
  }

  for (const material of state.materials) {
    let stock = material.available;
    const scheduledDates = [
      ...new Set([
        material.scheduledArrival,
        ...state.tasks
          .filter(
            (task) =>
              task.status !== "complete" &&
              task.materialId === material.id &&
              task.materialQuantity > 0,
          )
          .map((task) => task.scheduledDate),
      ]),
    ].sort();
    for (const date of scheduledDates) {
      if (date === material.scheduledArrival) stock += material.delayedShipment;
      const consumed = state.tasks
        .filter(
          (task) =>
            task.status !== "complete" &&
            task.materialId === material.id &&
            task.materialQuantity > 0 &&
            task.scheduledDate === date,
        )
        .reduce((total, task) => total + task.materialQuantity, 0);
      assert.ok(
        consumed <= stock,
        `${material.id} consumes ${consumed} on ${date} with ${stock} available`,
      );
      stock -= consumed;
    }
  }

  for (const order of state.orders) {
    const finishDate = state.tasks
      .filter((task) => task.orderId === order.id)
      .map((task) => task.scheduledDate)
      .sort()
      .at(-1);
    assert.ok(finishDate);
    const allComplete = order.taskIds.every(
      (taskId) => state.tasks.find((task) => task.id === taskId)?.status === "complete",
    );
    assert.equal(
      order.status,
      allComplete ? "complete" : finishDate! > order.dueDate ? "late" : "on_track",
      `status for ${order.id} must match its actual task dates`,
    );
  }
}

test("demo scenario is internally consistent and contains eight customer orders", () => {
  const state = createInitialState(fixedNow);
  assert.equal(state.orders.length, 8);
  assert.equal(state.orders.find((order) => order.id === "PAL-204")?.dueDate, "2026-10-16");
  assert.ok(state.materials.some((material) => material.id === "plywood"));
  assert.ok(state.machines.length >= 3);
  assert.ok(state.tasks.every((item) => state.orders.some((order) => order.id === item.orderId)));
  const dailyLoad = new Map<string, number>();
  for (const task of state.tasks) {
    const key = `${task.machineId}:${task.scheduledDate}`;
    dailyLoad.set(key, (dailyLoad.get(key) ?? 0) + task.durationHours);
  }
  for (const [key, hours] of dailyLoad) {
    const machineId = key.split(":")[0];
    const machine = state.machines.find((item) => item.id === machineId)!;
    assert.ok(
      hours <= machine.hoursPerDay,
      `${key} has ${hours} scheduled hours above its ${machine.hoursPerDay}-hour capacity`,
    );
  }
  assert.ok(state.tasks.every((item) => item.dependsOn.every((id) => state.tasks.some((task) => task.id === id))));
});

test("tool input schemas accept a valid delay and reject invalid values", () => {
  assert.equal(
    toolInputSchemas.simulate_disruption.safeParse({
      materialId: "plywood",
      delayDays: 2,
    }).success,
    true,
  );
  assert.equal(
    toolInputSchemas.simulate_disruption.safeParse({
      materialId: "",
      delayDays: 2.5,
    }).success,
    false,
  );
  assert.equal(
    toolInputSchemas.simulate_disruption.safeParse({
      materialId: "plywood",
      delayDays: 0,
    }).success,
    false,
  );
  assert.equal(
    toolInputSchemas.execute_recovery.safeParse({
      planId: "plan-a",
      requestId: "",
    }).success,
    false,
  );
});

test("simulating the same disruption twice is safe and does not duplicate the audit entry", () => {
  const { initial, disrupted } = disruptedScenario();
  const repeated = simulateDisruption(disrupted, "plywood", 2, fixedNow);

  assert.strictEqual(repeated, disrupted);
  assert.equal(repeated.actionHistory.length, 1);
  assert.equal(repeated.disruption?.originalArrivalDate, "2026-10-14");
  assert.equal(repeated.disruption?.revisedArrivalDate, "2026-10-16");
  assert.equal(initial.actionHistory.length, 0);
});

test("impact analysis traces plywood through dependent tasks to every exposed order", () => {
  const { disrupted } = disruptedScenario();
  const impact = analyzeImpact(disrupted);

  assert.equal(impact.affectedOrderIds.length, 5);
  assert.ok(impact.affectedOrderIds.includes("PAL-204"));
  assert.ok(impact.affectedTaskIds.includes("pal-finish"));
  assert.ok(impact.graphEdges.some((edge) => edge.from === "task:pal-assemble" && edge.to === "task:pal-finish"));
  assert.ok(impact.graphEdges.some((edge) => edge.from === "task:pal-finish" && edge.to === "order:PAL-204"));
});

test("recovery alternatives are ranked from the computed schedule and explicit trade-offs", () => {
  const { disrupted } = disruptedScenario();
  const { state, plans } = proposeRecovery(disrupted, "PAL-204", fixedNow);
  const feasible = plans.filter((plan) => plan.feasible);

  assert.equal(plans.length, 3);
  assert.equal(feasible.length, 2);
  assert.equal(feasible[0]?.cost, 520);
  assert.equal(feasible[0]?.onTimeOrders, 8);
  assert.equal(feasible[0]?.lateOrders, 0);
  assert.match(feasible[0]?.rationale ?? "", /^Recommended by policy/);
  const localBuy = plans.find((plan) => plan.id.endsWith("-protect-target"))!;
  assert.equal(localBuy.feasible, true);
  assert.equal(localBuy.cost, 310);
  assert.equal(localBuy.onTimeOrders, 6);
  assert.equal(localBuy.lateOrders, 2);
  assert.deepEqual(localBuy.affectedOrders, [
    "BRK-118",
    "MOR-031",
    "NG-007",
    "RIV-052",
  ]);
  assert.match(localBuy.rationale, /Non-target due dates remain visible/);
  assert.ok(
    localBuy.actions.some((action) =>
      action.includes("BRK-118 (Brookside): Cut cabinet panels 2026-10-16"),
    ),
  );
  assert.equal(plans[2]?.feasible, false);
  assert.match(plans[2]?.rationale ?? "", /Hard target deadline missed/);
  assert.equal(
    Object.keys(state.recoveryProjections).length,
    3,
    "each alternative keeps its exact private schedule projection",
  );
  assert.equal("recoveryProjections" in getShopView(state), false);
});

test("plan proposal is idempotent and invalid order IDs fail explicitly", () => {
  const { disrupted } = disruptedScenario();
  const first = proposeRecovery(disrupted, "PAL-204", fixedNow);
  const repeated = proposeRecovery(first.state, "PAL-204", fixedNow);
  assert.strictEqual(repeated.state, first.state);
  assert.equal(repeated.state.actionHistory.length, 2);
  assert.throws(
    () => proposeRecovery(disrupted, "NO-SUCH-ORDER", fixedNow),
    (error: unknown) =>
      error instanceof DomainError &&
      error.statusCode === 404 &&
      error.message.includes("was not found"),
  );
  assert.throws(
    () => proposeRecovery(disrupted, "LEE-043", fixedNow),
    /not exposed to the active material delay/,
  );
});

test("execution requires approval, is idempotent, and verification matches persisted outcomes", () => {
  const { disrupted } = disruptedScenario();
  const { state: proposedState, plans } = proposeRecovery(disrupted, "PAL-204", fixedNow);
  const plan = plans[0]!;

  assert.throws(
    () => executeRecovery(proposedState, plan.id, "request-1", fixedNow),
    /Approval is required/,
  );
  assert.throws(
    () => approveRecovery(proposedState, plans[2]!.id, fixedNow),
    /infeasible/,
  );

  const approved = approveRecovery(proposedState, plan.id, fixedNow);
  const executed = executeRecovery(approved, plan.id, "request-1", fixedNow);
  const duplicate = executeRecovery(executed, plan.id, "request-1", fixedNow);
  assert.strictEqual(duplicate, executed);
  assert.equal(
    executed.actionHistory.filter((action) => action.action === "recovery_executed").length,
    1,
  );
  assert.ok(
    executed.plans
      .filter((item) => item.id !== plan.id)
      .every((item) => item.status === "superseded"),
  );

  const verification = verifyRecovery(executed, plan.id, fixedNow);
  assert.equal(verification.result.verified, true);
  assert.equal(verification.result.stateMatches, true);
  assert.equal(verification.result.onTimeOrders, 8);
  assert.equal(verification.result.lateOrders, 0);
  assertIndependentScheduleChecks(verification.state);
  assert.equal(
    verification.state.plans.find((item) => item.id === plan.id)?.status,
    "verified",
  );
  assert.throws(
    () => proposeRecovery(verification.state, "PAL-204", fixedNow),
    /already been executed/,
  );
});

test("target-protection plan records the modeled late order and verifies honestly", () => {
  const { disrupted } = disruptedScenario();
  const { state: proposedState, plans } = proposeRecovery(disrupted, "PAL-204", fixedNow);
  const plan = plans.find((item) => item.id.endsWith("-protect-target"))!;
  const approved = approveRecovery(proposedState, plan.id, fixedNow);
  const executed = executeRecovery(approved, plan.id, "request-target", fixedNow);
  const verification = verifyRecovery(executed, plan.id, fixedNow);

  assert.equal(verification.result.verified, true);
  assert.equal(verification.result.onTimeOrders, 5);
  assert.equal(verification.result.lateOrders, 3);
  assert.equal(
    verification.state.orders.find((order) => order.id === "PAL-204")?.status,
    "on_track",
  );
  assert.equal(
    verification.state.orders.find((order) => order.id === "BRK-118")?.status,
    "late",
  );
  assert.equal(
    verification.state.orders.find((order) => order.id === "MOR-031")?.status,
    "late",
  );
  assert.equal(
    verification.state.orders.find((order) => order.id === "NG-007")?.status,
    "late",
  );
  assert.equal(
    verification.state.orders.find((order) => order.id === "RIV-052")?.status,
    "on_track",
  );
  assert.equal(
    verification.state.tasks.find((task) => task.id === "brk-cut")?.scheduledDate,
    "2026-10-16",
  );
  assert.equal(
    verification.state.tasks.find((task) => task.id === "brk-assemble")?.scheduledDate,
    "2026-10-19",
  );
  assert.equal(
    verification.state.tasks.find((task) => task.id === "brk-finish")?.scheduledDate,
    "2026-10-20",
  );
  assert.equal(
    verification.state.tasks.find((task) => task.id === "riv-finish")?.scheduledDate,
    "2026-10-21",
  );
});

test("partial local buy reserves enough stock for the chosen order", () => {
  const { disrupted } = disruptedScenario();
  const { state: proposedState, plans } = proposeRecovery(disrupted, "BRK-118", fixedNow);
  const plan = plans.find((item) => item.id.endsWith("-protect-target"))!;
  assert.equal(plan.targetOrderId, "BRK-118");
  assert.equal(plan.actions[0], "Reserve 2 sheets from Summit Materials for Brookside: $220.");

  const approved = approveRecovery(proposedState, plan.id, fixedNow);
  const executed = executeRecovery(approved, plan.id, "request-brookside", fixedNow);
  assert.equal(
    executed.materials.find((material) => material.id === "plywood")?.available,
    5,
  );
  assert.equal(
    executed.orders.find((order) => order.id === "BRK-118")?.status,
    "on_track",
  );
});

test("invalid disruption inputs and out-of-order verification are rejected", () => {
  const initial = createInitialState(fixedNow);
  assert.throws(() => simulateDisruption(initial, "plywood", 0, fixedNow), /whole number/);
  assert.throws(() => simulateDisruption(initial, "unknown", 2, fixedNow), /not found/);
  assert.throws(() => verifyRecovery(initial, "missing-plan", fixedNow), /not found/);
});
