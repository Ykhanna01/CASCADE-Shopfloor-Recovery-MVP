import { z } from "zod/v4";

export const toolInputSchemas = {
  simulate_disruption: z.object({
    materialId: z.string().min(1),
    delayDays: z.number().int().min(1).max(14),
  }),
  propose_recovery: z.object({
    targetOrderId: z.string().min(1),
  }),
  approve_recovery: z.object({
    planId: z.string().min(1),
  }),
  execute_recovery: z.object({
    planId: z.string().min(1),
    requestId: z.string().min(1),
  }),
  verify_recovery: z.object({
    planId: z.string().min(1),
  }),
};
