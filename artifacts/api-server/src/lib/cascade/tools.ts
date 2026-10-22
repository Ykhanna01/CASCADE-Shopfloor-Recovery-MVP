import {
  approveRecovery,
  analyzeImpact,
  DomainError,
  executeRecovery,
  getShopView,
  proposeRecovery,
  simulateDisruption,
  verifyRecovery,
} from "./domain";
import {
  cascadeStateStore,
  type CascadeStateStore,
  DEFAULT_SCENARIO_ID,
} from "./store";
import { toolInputSchemas } from "./tool-contracts";

export const cascadeToolNames = [
  "get_shop_state",
  "simulate_disruption",
  "analyze_impact",
  "propose_recovery",
  "approve_recovery",
  "execute_recovery",
  "verify_recovery",
  "get_action_history",
] as const;

export type CascadeToolName = (typeof cascadeToolNames)[number];

export async function dispatchCascadeTool(
  name: CascadeToolName,
  rawArguments: unknown = {},
  scenarioId = DEFAULT_SCENARIO_ID,
  store: CascadeStateStore = cascadeStateStore,
): Promise<unknown> {
  const state = await store.readShopState(scenarioId);
  switch (name) {
    case "get_shop_state":
      return getShopView(state);
    case "get_action_history":
      return state.actionHistory;
    case "simulate_disruption": {
      const input = toolInputSchemas.simulate_disruption.parse(rawArguments);
      return store.mutateShopState((current, now) => {
        const next = simulateDisruption(
          current,
          input.materialId,
          input.delayDays,
          now,
        );
        return { state: next, result: analyzeImpact(next) };
      }, scenarioId);
    }
    case "analyze_impact":
      return analyzeImpact(state);
    case "propose_recovery": {
      const input = toolInputSchemas.propose_recovery.parse(rawArguments);
      return store.mutateShopState((current, now) => {
        const proposed = proposeRecovery(current, input.targetOrderId, now);
        return { state: proposed.state, result: proposed.plans };
      }, scenarioId);
    }
    case "approve_recovery": {
      const input = toolInputSchemas.approve_recovery.parse(rawArguments);
      return store.mutateShopState((current, now) => {
        const next = approveRecovery(current, input.planId, now);
        const plan = next.plans.find((item) => item.id === input.planId);
        if (!plan) throw new DomainError(`Recovery plan '${input.planId}' was not found.`, 404);
        return { state: next, result: plan };
      }, scenarioId);
    }
    case "execute_recovery": {
      const input = toolInputSchemas.execute_recovery.parse(rawArguments);
      return store.mutateShopState((current, now) => {
        const next = executeRecovery(
          current,
          input.planId,
          input.requestId,
          now,
        );
        return { state: next, result: getShopView(next) };
      }, scenarioId);
    }
    case "verify_recovery": {
      const input = toolInputSchemas.verify_recovery.parse(rawArguments);
      return store.mutateShopState(
        (current, now) => verifyRecovery(current, input.planId, now),
        scenarioId,
      );
    }
  }
}
