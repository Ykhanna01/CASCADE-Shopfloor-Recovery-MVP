import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const cascadeStateTable = pgTable("cascade_state", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
