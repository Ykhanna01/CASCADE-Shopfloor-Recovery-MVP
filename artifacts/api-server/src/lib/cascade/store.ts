import { cascadeStateTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createInitialState,
  DomainError,
  type PersistedShopState,
} from "./domain";

export const DEFAULT_SCENARIO_ID = "northstar-demo";
let defaultInitialized = false;
let defaultInitialization: Promise<void> | undefined;

export interface CascadeStateStore {
  readShopState(scenarioId?: string): Promise<PersistedShopState>;
  mutateShopState<T>(
    operation: (
      state: PersistedShopState,
      now: Date,
    ) => { state: PersistedShopState; result: T },
    scenarioId?: string,
  ): Promise<T>;
  createDemoScenario(
    requestId: string,
    now?: Date,
  ): Promise<{ scenarioId: string; state: PersistedShopState }>;
}

function parseStoredState(value: unknown): PersistedShopState {
  if (
    value === null ||
    typeof value !== "object" ||
    !Array.isArray((value as PersistedShopState).orders) ||
    !Array.isArray((value as PersistedShopState).materials) ||
    !Array.isArray((value as PersistedShopState).tasks) ||
    !Array.isArray((value as PersistedShopState).plans) ||
    !Array.isArray((value as PersistedShopState).actionHistory) ||
    !Array.isArray((value as PersistedShopState).executedRequestIds)
  ) {
    throw new Error(
      "The persisted CASCADE scenario is invalid. The simulated state was not reset automatically.",
    );
  }
  return value as PersistedShopState;
}

export function normalizeScenarioId(scenarioId?: string): string {
  if (scenarioId === undefined || scenarioId === "") return DEFAULT_SCENARIO_ID;
  if (
    scenarioId !== DEFAULT_SCENARIO_ID &&
    !/^demo-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(scenarioId)
  ) {
    throw new DomainError("Invalid CASCADE scenario ID.");
  }
  return scenarioId.toLowerCase();
}

async function ensureDefaultScenario(): Promise<void> {
  if (defaultInitialized) return;
  defaultInitialization ??= (async () => {
    const initial = createInitialState();
    await db
      .insert(cascadeStateTable)
      .values({
        id: DEFAULT_SCENARIO_ID,
        data: initial as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing();
    defaultInitialized = true;
  })();
  try {
    await defaultInitialization;
  } catch (error) {
    defaultInitialization = undefined;
    throw error;
  }
}

export async function createDemoScenario(
  requestId: string,
  now = new Date(),
): Promise<{ scenarioId: string; state: PersistedShopState }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error("A valid UUID requestId is required to create a demo scenario.");
  }
  requestId = requestId.toLowerCase();
  const scenarioId = `demo-${requestId}`;
  const initial = createInitialState(now);
  await db
    .insert(cascadeStateTable)
    .values({
      id: scenarioId,
      data: initial as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing();
  return { scenarioId, state: await readShopState(scenarioId) };
}

export async function readShopState(
  scenarioId = DEFAULT_SCENARIO_ID,
): Promise<PersistedShopState> {
  scenarioId = normalizeScenarioId(scenarioId);
  if (scenarioId === DEFAULT_SCENARIO_ID) await ensureDefaultScenario();
  const [row] = await db
    .select()
    .from(cascadeStateTable)
    .where(eq(cascadeStateTable.id, scenarioId))
    .limit(1);
  if (!row) throw new DomainError(`The CASCADE scenario '${scenarioId}' was not found.`, 404);
  return parseStoredState(row.data);
}

export async function mutateShopState<T>(
  operation: (
    state: PersistedShopState,
    now: Date,
  ) => { state: PersistedShopState; result: T },
  scenarioId = DEFAULT_SCENARIO_ID,
): Promise<T> {
  scenarioId = normalizeScenarioId(scenarioId);
  if (scenarioId === DEFAULT_SCENARIO_ID) await ensureDefaultScenario();
  return db.transaction(async (transaction) => {
    const [row] = await transaction
      .select()
      .from(cascadeStateTable)
      .where(eq(cascadeStateTable.id, scenarioId))
      .for("update")
      .limit(1);
    if (!row) throw new DomainError(`The CASCADE scenario '${scenarioId}' was not found.`, 404);

    const current = parseStoredState(row.data);
    const { state: next, result } = operation(current, new Date());
    if (next !== current) {
      await transaction
        .update(cascadeStateTable)
        .set({
          data: next as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(cascadeStateTable.id, scenarioId));
    }
    return result;
  });
}

export const cascadeStateStore: CascadeStateStore = {
  readShopState,
  mutateShopState,
  createDemoScenario,
};
