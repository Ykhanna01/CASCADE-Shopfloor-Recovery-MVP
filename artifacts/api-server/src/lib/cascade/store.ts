import { cascadeStateTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createInitialState,
  type PersistedShopState,
} from "./domain";

const SHOP_STATE_ID = "northstar-demo";
let initialized = false;
let initialization: Promise<void> | undefined;

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

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  initialization ??= (async () => {
    const initial = createInitialState();
    await db
      .insert(cascadeStateTable)
      .values({
        id: SHOP_STATE_ID,
        data: initial as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing();
    initialized = true;
  })();
  await initialization;
}

export async function readShopState(): Promise<PersistedShopState> {
  await ensureInitialized();
  const [row] = await db
    .select()
    .from(cascadeStateTable)
    .where(eq(cascadeStateTable.id, SHOP_STATE_ID))
    .limit(1);
  if (!row) throw new Error("The CASCADE scenario row was not found after initialization.");
  return parseStoredState(row.data);
}

export async function mutateShopState<T>(
  operation: (
    state: PersistedShopState,
    now: Date,
  ) => { state: PersistedShopState; result: T },
): Promise<T> {
  await ensureInitialized();
  return db.transaction(async (transaction) => {
    const [row] = await transaction
      .select()
      .from(cascadeStateTable)
      .where(eq(cascadeStateTable.id, SHOP_STATE_ID))
      .for("update")
      .limit(1);
    if (!row) throw new Error("The CASCADE scenario row was not found.");

    const current = parseStoredState(row.data);
    const { state: next, result } = operation(current, new Date());
    if (next !== current) {
      await transaction
        .update(cascadeStateTable)
        .set({
          data: next as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(cascadeStateTable.id, SHOP_STATE_ID));
    }
    return result;
  });
}
