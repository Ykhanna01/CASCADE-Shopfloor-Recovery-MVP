export type Priority = "urgent" | "high" | "standard";
export type OrderStatus = "on_track" | "at_risk" | "late" | "complete";
export type TaskStatus = "queued" | "scheduled" | "complete";
export type PlanStatus =
  | "proposed"
  | "approved"
  | "executed"
  | "verified"
  | "superseded";

export interface ShopOrder {
  id: string;
  customer: string;
  product: string;
  quantity: number;
  dueDate: string;
  priority: Priority;
  status: OrderStatus;
  taskIds: string[];
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  available: number;
  delayedShipment: number;
  supplier: string;
  scheduledArrival: string;
  alternateSupplier: string;
  alternateAvailable: boolean;
  expediteCost: number;
}

export interface Machine {
  id: string;
  name: string;
  hoursPerDay: number;
}

export interface ProductionTask {
  id: string;
  orderId: string;
  name: string;
  machineId: string;
  materialId: string;
  materialQuantity: number;
  durationHours: number;
  dependsOn: string[];
  scheduledDate: string;
  status: TaskStatus;
}

export interface Disruption {
  id: string;
  materialId: string;
  materialName: string;
  delayDays: number;
  originalArrivalDate: string;
  revisedArrivalDate: string;
  reportedAt: string;
  simulationLabel: string;
}

export interface RecoveryPlan {
  id: string;
  name: string;
  strategy: string;
  targetOrderId: string;
  feasible: boolean;
  cost: number;
  onTimeOrders: number;
  lateOrders: number;
  affectedOrders: string[];
  risks: string[];
  rationale: string;
  actions: string[];
  status: PlanStatus;
}

export interface ActionEvent {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  planId: string | null;
  status: string;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: "material" | "task" | "order";
  status: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface ImpactAnalysis {
  disruption: Disruption;
  summary: string;
  affectedOrderIds: string[];
  affectedTaskIds: string[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}

export interface ShopState {
  scenarioName: string;
  simulationLabel: string;
  lastUpdated: string;
  disruption: Disruption | null;
  orders: ShopOrder[];
  materials: Material[];
  machines: Machine[];
  tasks: ProductionTask[];
  plans: RecoveryPlan[];
}

export interface PersistedShopState extends ShopState {
  actionHistory: ActionEvent[];
  executedRequestIds: string[];
}

export class DomainError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

const DEMO_LABEL = "SIMULATED DEMO DATA";

function task(
  id: string,
  orderId: string,
  name: string,
  machineId: string,
  materialId: string,
  materialQuantity: number,
  durationHours: number,
  dependsOn: string[],
  scheduledDate: string,
): ProductionTask {
  return {
    id,
    orderId,
    name,
    machineId,
    materialId,
    materialQuantity,
    durationHours,
    dependsOn,
    scheduledDate,
    status: "scheduled",
  };
}

export function createInitialState(now = new Date()): PersistedShopState {
  return {
    scenarioName: "Northstar Custom Works — Week of October 12",
    simulationLabel: DEMO_LABEL,
    lastUpdated: now.toISOString(),
    disruption: null,
    orders: [
      {
        id: "PAL-204",
        customer: "Palmer",
        product: "Walnut dining table",
        quantity: 1,
        dueDate: "2026-10-16",
        priority: "urgent",
        status: "on_track",
        taskIds: ["pal-cut", "pal-assemble", "pal-finish"],
      },
      {
        id: "BRK-118",
        customer: "Brookside",
        product: "Built-in cabinet set",
        quantity: 2,
        dueDate: "2026-10-16",
        priority: "high",
        status: "on_track",
        taskIds: ["brk-cut", "brk-assemble", "brk-finish"],
      },
      {
        id: "MOR-031",
        customer: "Moreno",
        product: "Wall shelving",
        quantity: 3,
        dueDate: "2026-10-19",
        priority: "standard",
        status: "on_track",
        taskIds: ["mor-cut", "mor-assemble", "mor-finish"],
      },
      {
        id: "NG-007",
        customer: "Ng",
        product: "Workbench",
        quantity: 1,
        dueDate: "2026-10-20",
        priority: "high",
        status: "on_track",
        taskIds: ["ng-cut", "ng-assemble", "ng-finish"],
      },
      {
        id: "RIV-052",
        customer: "Rivera",
        product: "Reception desk",
        quantity: 1,
        dueDate: "2026-10-21",
        priority: "high",
        status: "on_track",
        taskIds: ["riv-cut", "riv-assemble", "riv-finish"],
      },
      {
        id: "LEE-043",
        customer: "Lee",
        product: "Storage credenza",
        quantity: 1,
        dueDate: "2026-10-19",
        priority: "standard",
        status: "on_track",
        taskIds: ["lee-cut", "lee-assemble", "lee-finish"],
      },
      {
        id: "DAS-021",
        customer: "Das",
        product: "Pair of side tables",
        quantity: 2,
        dueDate: "2026-10-20",
        priority: "standard",
        status: "on_track",
        taskIds: ["das-cut", "das-assemble", "das-finish"],
      },
      {
        id: "FIN-009",
        customer: "Finch",
        product: "Retail display stands",
        quantity: 4,
        dueDate: "2026-10-21",
        priority: "standard",
        status: "on_track",
        taskIds: ["fin-cut", "fin-assemble", "fin-finish"],
      },
    ],
    materials: [
      {
        id: "plywood",
        name: "Cabinet-grade plywood",
        unit: "sheets",
        available: 3,
        delayedShipment: 24,
        supplier: "Northline Timber",
        scheduledArrival: "2026-10-14",
        alternateSupplier: "Summit Materials",
        alternateAvailable: true,
        expediteCost: 520,
      },
      {
        id: "walnut",
        name: "Black walnut",
        unit: "board feet",
        available: 52,
        delayedShipment: 0,
        supplier: "Northline Timber",
        scheduledArrival: "2026-10-12",
        alternateSupplier: "Summit Materials",
        alternateAvailable: true,
        expediteCost: 120,
      },
      {
        id: "maple",
        name: "Hard maple",
        unit: "board feet",
        available: 34,
        delayedShipment: 0,
        supplier: "Cedar Ridge Supply",
        scheduledArrival: "2026-10-12",
        alternateSupplier: "Summit Materials",
        alternateAvailable: true,
        expediteCost: 95,
      },
      {
        id: "birch",
        name: "Baltic birch",
        unit: "sheets",
        available: 12,
        delayedShipment: 0,
        supplier: "Cedar Ridge Supply",
        scheduledArrival: "2026-10-12",
        alternateSupplier: "Summit Materials",
        alternateAvailable: true,
        expediteCost: 85,
      },
    ],
    machines: [
      { id: "panel-saw", name: "Panel saw", hoursPerDay: 10 },
      { id: "assembly-bay", name: "Assembly bay", hoursPerDay: 12 },
      { id: "finish-booth", name: "Finish booth", hoursPerDay: 10 },
      { id: "cnc-router", name: "CNC router", hoursPerDay: 8 },
    ],
    tasks: [
      task("pal-cut", "PAL-204", "Cut table panels", "panel-saw", "plywood", 4, 2, [], "2026-10-14"),
      task("pal-assemble", "PAL-204", "Assemble table", "assembly-bay", "plywood", 0, 2.5, ["pal-cut"], "2026-10-15"),
      task("pal-finish", "PAL-204", "Sand and finish", "finish-booth", "plywood", 0, 2, ["pal-assemble"], "2026-10-16"),
      task("brk-cut", "BRK-118", "Cut cabinet panels", "panel-saw", "plywood", 5, 2, [], "2026-10-14"),
      task("brk-assemble", "BRK-118", "Assemble cabinet set", "assembly-bay", "plywood", 0, 2.5, ["brk-cut"], "2026-10-15"),
      task("brk-finish", "BRK-118", "Finish cabinet set", "finish-booth", "plywood", 0, 2, ["brk-assemble"], "2026-10-16"),
      task("mor-cut", "MOR-031", "Cut shelf blanks", "panel-saw", "plywood", 4, 1.5, [], "2026-10-14"),
      task("mor-assemble", "MOR-031", "Build shelf units", "assembly-bay", "plywood", 0, 2, ["mor-cut"], "2026-10-16"),
      task("mor-finish", "MOR-031", "Finish shelf units", "finish-booth", "plywood", 0, 1.5, ["mor-assemble"], "2026-10-19"),
      task("ng-cut", "NG-007", "Cut workbench panels", "panel-saw", "plywood", 5, 2, [], "2026-10-15"),
      task("ng-assemble", "NG-007", "Assemble workbench", "assembly-bay", "plywood", 0, 2, ["ng-cut"], "2026-10-16"),
      task("ng-finish", "NG-007", "Finish workbench", "finish-booth", "plywood", 0, 1.5, ["ng-assemble"], "2026-10-19"),
      task("riv-cut", "RIV-052", "Cut reception desk panels", "panel-saw", "plywood", 4, 2, [], "2026-10-15"),
      task("riv-assemble", "RIV-052", "Assemble reception desk", "assembly-bay", "plywood", 0, 2, ["riv-cut"], "2026-10-16"),
      task("riv-finish", "RIV-052", "Finish reception desk", "finish-booth", "plywood", 0, 1.5, ["riv-assemble"], "2026-10-19"),
      task("lee-cut", "LEE-043", "Mill credenza parts", "cnc-router", "walnut", 34, 3, [], "2026-10-13"),
      task("lee-assemble", "LEE-043", "Assemble credenza", "assembly-bay", "walnut", 0, 3, ["lee-cut"], "2026-10-15"),
      task("lee-finish", "LEE-043", "Oil and finish credenza", "finish-booth", "walnut", 0, 2, ["lee-assemble"], "2026-10-16"),
      task("das-cut", "DAS-021", "Mill side-table parts", "cnc-router", "maple", 22, 3, [], "2026-10-14"),
      task("das-assemble", "DAS-021", "Assemble side tables", "assembly-bay", "maple", 0, 2, ["das-cut"], "2026-10-16"),
      task("das-finish", "DAS-021", "Finish side tables", "finish-booth", "maple", 0, 2, ["das-assemble"], "2026-10-19"),
      task("fin-cut", "FIN-009", "Machine display components", "cnc-router", "birch", 8, 3, [], "2026-10-14"),
      task("fin-assemble", "FIN-009", "Assemble display stands", "assembly-bay", "birch", 0, 2.5, ["fin-cut"], "2026-10-16"),
      task("fin-finish", "FIN-009", "Seal display stands", "finish-booth", "birch", 0, 2, ["fin-assemble"], "2026-10-19"),
    ],
    plans: [],
    actionHistory: [],
    executedRequestIds: [],
  };
}

function addAction(
  state: PersistedShopState,
  action: string,
  description: string,
  planId: string | null,
  status: string,
  now: Date,
): PersistedShopState {
  return {
    ...state,
    lastUpdated: now.toISOString(),
    actionHistory: [
      ...state.actionHistory,
      {
        id: `action-${state.actionHistory.length + 1}`,
        action,
        description,
        timestamp: now.toISOString(),
        planId,
        status,
      },
    ],
  };
}

function addCalendarDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addBusinessDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) added += 1;
  }
  return date.toISOString().slice(0, 10);
}

function targetProtectionSchedule(
  state: PersistedShopState,
  targetOrderId: string,
): Map<string, string[]> {
  if (!state.disruption) return new Map();
  const affectedIds = new Set(analyzeImpact(state).affectedOrderIds);
  const otherAffectedOrders = state.orders
    .filter((order) => order.id !== targetOrderId && affectedIds.has(order.id))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  return new Map(
    otherAffectedOrders.map((order, index) => {
      const daysAfterArrival = index < 2 ? 0 : 1;
      const startDate = addBusinessDays(
        state.disruption!.revisedArrivalDate,
        daysAfterArrival,
      );
      return [
        order.id,
        [
          startDate,
          addBusinessDays(startDate, 1),
          addBusinessDays(startDate, 2),
        ],
      ];
    }),
  );
}

export function simulateDisruption(
  state: PersistedShopState,
  materialId: string,
  delayDays: number,
  now = new Date(),
): PersistedShopState {
  if (!Number.isInteger(delayDays) || delayDays < 1 || delayDays > 14) {
    throw new DomainError("Delay must be a whole number from 1 to 14 days.");
  }
  const material = state.materials.find((item) => item.id === materialId);
  if (!material) throw new DomainError(`Material '${materialId}' was not found.`, 404);

  if (state.disruption) {
    if (
      state.disruption.materialId === materialId &&
      state.disruption.delayDays === delayDays
    ) {
      return state;
    }
    throw new DomainError(
      "A simulated disruption is already active. This demo supports one disruption at a time.",
      409,
    );
  }

  const disruption: Disruption = {
    id: `disruption-${materialId}-${delayDays}`,
    materialId,
    materialName: material.name,
    delayDays,
    originalArrivalDate: material.scheduledArrival,
    revisedArrivalDate: addCalendarDays(material.scheduledArrival, delayDays),
    reportedAt: now.toISOString(),
    simulationLabel: DEMO_LABEL,
  };

  let next: PersistedShopState = {
    ...state,
    disruption,
    materials: state.materials.map((item) =>
      item.id === materialId
        ? { ...item, scheduledArrival: disruption.revisedArrivalDate }
        : item,
    ),
    orders: state.orders.map((order) => {
      const needsDelayedMaterial = order.taskIds.some((taskId) => {
        const item = state.tasks.find((candidate) => candidate.id === taskId);
        return (
          item?.materialId === materialId &&
          item.materialQuantity > 0 &&
          item.scheduledDate < disruption.revisedArrivalDate
        );
      });
      return needsDelayedMaterial ? { ...order, status: "at_risk" } : order;
    }),
  };
  next = addAction(
    next,
    "disruption_simulated",
    `${material.name} shipment delayed ${delayDays} days (${disruption.originalArrivalDate} → ${disruption.revisedArrivalDate}). Simulated only; no supplier was contacted.`,
    null,
    "simulated",
    now,
  );
  return next;
}

export function analyzeImpact(state: PersistedShopState): ImpactAnalysis {
  const disruption = state.disruption;
  if (!disruption) {
    throw new DomainError("Simulate a supplier disruption before analyzing impact.", 409);
  }

  const seedTaskIds = new Set(
    state.tasks
      .filter(
        (item) =>
          item.materialId === disruption.materialId &&
          item.materialQuantity > 0 &&
          item.scheduledDate < disruption.revisedArrivalDate,
      )
      .map((item) => item.id),
  );
  const affectedTaskIds = new Set(seedTaskIds);

  let changed = true;
  while (changed) {
    changed = false;
    for (const item of state.tasks) {
      if (
        !affectedTaskIds.has(item.id) &&
        item.dependsOn.some((dependency) => affectedTaskIds.has(dependency))
      ) {
        affectedTaskIds.add(item.id);
        changed = true;
      }
    }
  }

  const affectedTasks = state.tasks.filter((item) => affectedTaskIds.has(item.id));
  const affectedOrderIds = [
    ...new Set(affectedTasks.map((item) => item.orderId)),
  ];
  const affectedOrders = state.orders.filter((order) =>
    affectedOrderIds.includes(order.id),
  );
  const nodes: GraphNode[] = [
    {
      id: `material:${disruption.materialId}`,
      label: disruption.materialName,
      kind: "material",
      status: "delayed",
    },
    ...affectedTasks.map((item) => ({
      id: `task:${item.id}`,
      label: item.name,
      kind: "task" as const,
      status: "at_risk",
    })),
    ...affectedOrders.map((order) => ({
      id: `order:${order.id}`,
      label: `${order.customer} · ${order.id}`,
      kind: "order" as const,
      status: order.status,
    })),
  ];

  const edges: GraphEdge[] = [];
  for (const item of affectedTasks) {
    if (seedTaskIds.has(item.id)) {
      edges.push({
        from: `material:${disruption.materialId}`,
        to: `task:${item.id}`,
      });
    }
    for (const dependency of item.dependsOn) {
      if (affectedTaskIds.has(dependency)) {
        edges.push({
          from: `task:${dependency}`,
          to: `task:${item.id}`,
        });
      }
    }
    edges.push({
      from: `task:${item.id}`,
      to: `order:${item.orderId}`,
    });
  }

  return {
    disruption,
    summary: `${affectedOrders.length} of ${state.orders.length} orders are exposed to the ${disruption.delayDays}-day ${disruption.materialName.toLowerCase()} delay. ${affectedTasks.length} linked production steps need review.`,
    affectedOrderIds,
    affectedTaskIds: [...affectedTaskIds],
    graphNodes: nodes,
    graphEdges: edges,
  };
}

export function proposeRecovery(
  state: PersistedShopState,
  targetOrderId: string,
  now = new Date(),
): { state: PersistedShopState; plans: RecoveryPlan[] } {
  if (!state.disruption) {
    throw new DomainError("Simulate a supplier disruption before proposing recovery.", 409);
  }
  if (state.plans.some((plan) => plan.status === "executed" || plan.status === "verified")) {
    throw new DomainError(
      "A recovery plan has already been executed for this disruption.",
      409,
    );
  }
  const targetOrder = state.orders.find((order) => order.id === targetOrderId);
  if (!targetOrder) throw new DomainError(`Order '${targetOrderId}' was not found.`, 404);

  const impact = analyzeImpact(state);
  const affectedOrderIds = impact.affectedOrderIds;
  const impactedOrders = state.orders.filter((order) =>
    affectedOrderIds.includes(order.id),
  );
  if (!affectedOrderIds.includes(targetOrderId)) {
    throw new DomainError(
      `Order '${targetOrderId}' is not exposed to the active material delay.`,
      400,
    );
  }
  const planId = (key: string) =>
    key === "protect-target"
      ? `${state.disruption!.id}-${targetOrderId}-${key}`
      : `${state.disruption!.id}-${key}`;
  const allOrderCount = state.orders.length;
  const alternate = state.materials.find(
    (material) => material.id === state.disruption!.materialId,
  );
  const requiredTargetUnits = state.tasks
    .filter(
      (task) =>
        task.orderId === targetOrderId &&
        task.materialId === state.disruption!.materialId,
    )
    .reduce((total, task) => total + task.materialQuantity, 0);
  const localBuyUnits = Math.max(
    0,
    requiredTargetUnits - (alternate?.available ?? 0),
  );
  const targetUnit = alternate?.unit === "sheets" ? "sheet" : "unit";
  const targetUnits = `${targetUnit}${localBuyUnits === 1 ? "" : "s"}`;
  const protectionSchedule = targetProtectionSchedule(state, targetOrderId);
  const displacedOrderIds = [...protectionSchedule.entries()]
    .filter(([orderId, dates]) => {
      const order = state.orders.find((item) => item.id === orderId);
      return order !== undefined && (dates.at(-1) ?? "") > order.dueDate;
    })
    .map(([orderId]) => orderId);
  const latePenaltyPerOrder = 100;
  const projectedLateOrders = state.orders.filter((order) =>
    displacedOrderIds.includes(order.id),
  );
  const penaltyLabel =
    projectedLateOrders.length === 1 ? "late-delivery penalty" : "late-delivery penalties";
  const protectionCost =
    localBuyUnits * 110 +
    60 +
    projectedLateOrders.length * latePenaltyPerOrder;
  const recoveryPlans: RecoveryPlan[] = [
    {
      id: planId("expedite"),
      name: "Expedite the full shipment",
      strategy: "Pay for priority freight and preserve the existing sequence",
      targetOrderId,
      feasible: Boolean(alternate && alternate.expediteCost > 0),
      cost: alternate?.expediteCost ?? 0,
      onTimeOrders: allOrderCount,
      lateOrders: 0,
      affectedOrders: affectedOrderIds,
      risks: [
        "Expedited arrival date is a simulation estimate, not a carrier commitment.",
        "No real supplier or carrier is contacted.",
      ],
      rationale: `Restores arrival to ${state.disruption.originalArrivalDate}; existing machine slots remain intact. All ${allOrderCount} orders stay on time.`,
      actions: [
        `Simulate priority freight for ${state.disruption.materialName}: $${alternate?.expediteCost ?? 0}.`,
        "Keep the current task sequence and reserved machine time.",
      ],
      status: "proposed",
    },
    {
      id: planId("protect-target"),
      name: `Protect ${targetOrder.customer} with a partial local buy`,
      strategy: `Reserve ${localBuyUnits} local ${targetUnits} for the target and re-sequence the remaining work`,
      feasible: Boolean(alternate?.alternateAvailable),
      targetOrderId,
      cost: protectionCost,
      onTimeOrders: Math.max(0, allOrderCount - projectedLateOrders.length),
      lateOrders: projectedLateOrders.length,
      affectedOrders: displacedOrderIds,
      risks: [
        `${projectedLateOrders.length} orders are forecast late after re-sequencing.`,
        "Local stock, capacity, and delivery dates are simulated estimates; confirm stock grade and shift capacity in a real shop.",
      ],
      rationale:
        `Estimated total $${protectionCost}: $${localBuyUnits * 110} for ${localBuyUnits} local ${targetUnits}, $60 overtime/rescheduling, and $${projectedLateOrders.length * latePenaltyPerOrder} in modeled late penalties. The target stays on track; ${projectedLateOrders.length} other orders miss their due dates.`,
      actions: [
        `Reserve ${localBuyUnits} ${targetUnits} from ${alternate?.alternateSupplier ?? "the local market"} for ${targetOrder.customer}: $${localBuyUnits * 110}.`,
        `Re-sequence ${protectionSchedule.size} exposed customer orders around the revised ${state.disruption.revisedArrivalDate} arrival; modeled overtime: $60.`,
        `Record ${projectedLateOrders.length} modeled ${penaltyLabel} at $${latePenaltyPerOrder} each: $${projectedLateOrders.length * latePenaltyPerOrder}.`,
      ],
      status: "proposed",
    },
    {
      id: planId("wait"),
      name: "Wait for the delayed shipment",
      strategy: "Make no sourcing or schedule changes",
      targetOrderId,
      feasible: false,
      cost: impactedOrders.length * latePenaltyPerOrder,
      onTimeOrders: Math.max(0, allOrderCount - impactedOrders.length),
      lateOrders: Math.min(impactedOrders.length, allOrderCount),
      affectedOrders: affectedOrderIds,
      risks: [
        `${targetOrder.customer}'s order cannot complete its dependent production steps by ${targetOrder.dueDate}.`,
        `Late-penalty estimate uses $${latePenaltyPerOrder} per affected order.`,
      ],
      rationale: `Infeasible for the selected commitment: material is not available until ${state.disruption.revisedArrivalDate}, after the first dependent production slot. Modeled exposure is $${impactedOrders.length * latePenaltyPerOrder} in late penalties.`,
      actions: [
        `Accept revised arrival on ${state.disruption.revisedArrivalDate}.`,
        "Do not change the simulated production schedule.",
      ],
      status: "proposed",
    },
  ];

  const existing = new Map(state.plans.map((plan) => [plan.id, plan]));
  const plans = recoveryPlans.map((plan) => existing.get(plan.id) ?? plan);
  if (recoveryPlans.every((plan) => existing.has(plan.id))) {
    return { state, plans };
  }
  let next: PersistedShopState = {
    ...state,
    plans: [
      ...state.plans.filter(
        (plan) => !recoveryPlans.some((candidate) => candidate.id === plan.id),
      ),
      ...plans,
    ],
  };
  next = addAction(
    next,
    "recovery_proposed",
    `Generated ${plans.length} deterministic alternatives for ${targetOrder.customer}'s ${targetOrder.id} order.`,
    null,
    "proposed",
    now,
  );
  return { state: next, plans };
}

export function approveRecovery(
  state: PersistedShopState,
  planId: string,
  now = new Date(),
): PersistedShopState {
  const plan = state.plans.find((item) => item.id === planId);
  if (!plan) throw new DomainError(`Recovery plan '${planId}' was not found.`, 404);
  if (!plan.feasible) throw new DomainError("This plan is infeasible and cannot be approved.");
  if (plan.status === "executed" || plan.status === "verified") return state;
  if (plan.status === "approved") return state;

  const next: PersistedShopState = {
    ...state,
    plans: state.plans.map((item) =>
      item.id === planId ? { ...item, status: "approved" } : item,
    ),
  };
  return addAction(
    next,
    "recovery_approved",
    `Approved “${plan.name}”. No recovery action has been executed yet.`,
    planId,
    "approved",
    now,
  );
}

export function executeRecovery(
  state: PersistedShopState,
  planId: string,
  requestId: string,
  now = new Date(),
): PersistedShopState {
  if (!requestId.trim()) throw new DomainError("An idempotency requestId is required.");
  const plan = state.plans.find((item) => item.id === planId);
  if (!plan) throw new DomainError(`Recovery plan '${planId}' was not found.`, 404);

  if (
    plan.status === "executed" ||
    plan.status === "verified" ||
    state.executedRequestIds.includes(requestId)
  ) {
    return state;
  }
  if (plan.status !== "approved") {
    throw new DomainError("Approval is required before a recovery plan can execute.");
  }
  if (!state.disruption) {
    throw new DomainError("The disruption is no longer active.", 409);
  }
  if (
    state.plans.some(
      (item) =>
        item.id !== planId &&
        (item.status === "executed" || item.status === "verified"),
    )
  ) {
    throw new DomainError(
      "A different recovery plan has already been executed for this disruption.",
      409,
    );
  }

  const isTargetProtection = plan.id.endsWith("-protect-target");
  const protectionSchedule = isTargetProtection
    ? targetProtectionSchedule(state, plan.targetOrderId)
    : new Map<string, string[]>();
  const targetOrderDemand = isTargetProtection
    ? state.tasks
        .filter(
          (task) =>
            task.orderId === plan.targetOrderId &&
            task.materialId === state.disruption?.materialId,
        )
        .reduce((total, task) => total + task.materialQuantity, 0)
    : 0;

  let next: PersistedShopState = {
    ...state,
    materials: state.materials.map((material) => {
      if (material.id !== state.disruption?.materialId) return material;
      if (plan.id.endsWith("-expedite")) {
        return {
          ...material,
          scheduledArrival: state.disruption.originalArrivalDate,
        };
      }
      return {
        ...material,
        available:
          material.available +
          Math.max(0, targetOrderDemand - material.available),
      };
    }),
    tasks: state.tasks.map((task) => {
      const orderDates = protectionSchedule.get(task.orderId);
      if (!orderDates) return task;
      const order = state.orders.find((item) => item.id === task.orderId);
      const taskIndex = order?.taskIds.indexOf(task.id) ?? -1;
      const scheduledDate = orderDates[taskIndex];
      return scheduledDate ? { ...task, scheduledDate } : task;
    }),
    orders: state.orders.map((order) => {
      if (plan.id.endsWith("-expedite")) {
        return { ...order, status: "on_track" };
      }
      if (plan.id.endsWith("-protect-target")) {
        return {
          ...order,
          status: plan.affectedOrders.includes(order.id) ? "late" : "on_track",
        };
      }
      const impacted = plan.affectedOrders.includes(order.id);
      return impacted ? { ...order, status: "late" } : order;
    }),
    plans: state.plans.map((item) => {
      if (item.id === planId) return { ...item, status: "executed" };
      if (item.status === "proposed" || item.status === "approved") {
        return { ...item, status: "superseded" };
      }
      return item;
    }),
    executedRequestIds: [...state.executedRequestIds, requestId],
  };
  next = addAction(
    next,
    "recovery_executed",
    `Executed “${plan.name}” in simulated shop state. No external system was changed.`,
    planId,
    "executed",
    now,
  );
  return next;
}

export function verifyRecovery(
  state: PersistedShopState,
  planId: string,
  now = new Date(),
): { state: PersistedShopState; result: { verified: boolean; message: string; planId: string; onTimeOrders: number; lateOrders: number; stateMatches: boolean } } {
  const plan = state.plans.find((item) => item.id === planId);
  if (!plan) throw new DomainError(`Recovery plan '${planId}' was not found.`, 404);
  if (plan.status !== "executed" && plan.status !== "verified") {
    throw new DomainError("Execute an approved recovery plan before verification.");
  }

  const onTimeOrders = state.orders.filter(
    (order) => order.status === "on_track" || order.status === "complete",
  ).length;
  const lateOrders = state.orders.filter((order) => order.status === "late").length;
  const stateMatches =
    onTimeOrders === plan.onTimeOrders && lateOrders === plan.lateOrders;

  if (plan.status === "verified") {
    return {
      state,
      result: {
        verified: stateMatches,
        message: stateMatches
          ? "Verified: the simulated order statuses match the approved recovery plan."
          : "Verification failed: the current order statuses differ from the plan.",
        planId,
        onTimeOrders,
        lateOrders,
        stateMatches,
      },
    };
  }

  let next: PersistedShopState = {
    ...state,
    plans: state.plans.map((item) =>
      item.id === planId ? { ...item, status: "verified" } : item,
    ),
  };
  next = addAction(
    next,
    "recovery_verified",
    stateMatches
      ? `Verified ${onTimeOrders} on-time and ${lateOrders} late orders against plan ${planId}.`
      : `Verification found a mismatch for plan ${planId}.`,
    planId,
    stateMatches ? "verified" : "mismatch",
    now,
  );
  return {
    state: next,
    result: {
      verified: stateMatches,
      message: stateMatches
        ? "Verified: the simulated order statuses match the approved recovery plan."
        : "Verification failed: the current order statuses differ from the plan.",
      planId,
      onTimeOrders,
      lateOrders,
      stateMatches,
    },
  };
}

export function getShopView(state: PersistedShopState): ShopState {
  const { actionHistory: _actionHistory, executedRequestIds: _executedRequestIds, ...view } =
    state;
  return view;
}
