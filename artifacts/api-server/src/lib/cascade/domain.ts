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

interface RecoveryProjection {
  planId: string;
  inputFingerprint: string;
  taskDates: Record<string, string>;
  orderStatuses: Record<string, OrderStatus>;
  materialAvailable: Record<string, number>;
  materialArrivalDates: Record<string, string>;
  changedOrderIds: string[];
  onTimeOrders: number;
  lateOrders: number;
  feasible: boolean;
  hardViolations: string[];
  localPurchaseUnits: number;
}

export interface PersistedShopState extends ShopState {
  actionHistory: ActionEvent[];
  executedRequestIds: string[];
  recoveryProjections: Record<string, RecoveryProjection>;
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
    recoveryProjections: {},
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

type RecoveryKind = "expedite" | "protect-target" | "wait";

interface ScheduleAttempt {
  taskDates: Map<string, string>;
  hardViolations: string[];
}

const LOCAL_UNIT_COST = 110;
const LATE_ORDER_PENALTY = 100;
const MAX_SCHEDULE_DAYS = 120;

function nextOrSameBusinessDay(isoDate: string): string {
  let date = isoDate;
  while (true) {
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) return date;
    date = addCalendarDays(date, 1);
  }
}

function nextBusinessDay(isoDate: string): string {
  return addBusinessDays(isoDate, 1);
}

function orderSortKey(state: PersistedShopState, orderId: string): [string, number, string] {
  const order = state.orders.find((item) => item.id === orderId);
  const priority = order?.priority === "urgent" ? 0 : order?.priority === "high" ? 1 : 2;
  return [order?.dueDate ?? "9999-12-31", priority, orderId];
}

function compareTaskPriority(
  state: PersistedShopState,
  left: ProductionTask,
  right: ProductionTask,
): number {
  const leftKey = orderSortKey(state, left.orderId);
  const rightKey = orderSortKey(state, right.orderId);
  return (
    leftKey[0].localeCompare(rightKey[0]) ||
    leftKey[1] - rightKey[1] ||
    leftKey[2].localeCompare(rightKey[2]) ||
    left.id.localeCompare(right.id)
  );
}

function tasksInDependencyOrder(
  state: PersistedShopState,
): { tasks: ProductionTask[]; violations: string[] } {
  const byId = new Map(state.tasks.map((item) => [item.id, item]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const emitted = new Set<string>();
  const ordered: ProductionTask[] = [];
  const violations: string[] = [];

  const visit = (item: ProductionTask) => {
    if (visited.has(item.id)) return;
    if (visiting.has(item.id)) {
      violations.push(`Task dependency cycle includes ${item.id}.`);
      return;
    }
    visiting.add(item.id);
    for (const dependencyId of [...item.dependsOn].sort()) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        violations.push(`Task ${item.id} depends on missing task ${dependencyId}.`);
        continue;
      }
      visit(dependency);
    }
    visiting.delete(item.id);
    visited.add(item.id);
    if (!emitted.has(item.id)) {
      ordered.push(item);
      emitted.add(item.id);
    }
  };

  for (const item of [...state.tasks].sort((a, b) => compareTaskPriority(state, a, b))) {
    visit(item);
  }
  return { tasks: ordered, violations: [...new Set(violations)] };
}

function materialScheduleViolations(
  state: PersistedShopState,
  taskDates: Map<string, string>,
  arrivalDates: Record<string, string>,
  localPurchaseUnits: number,
  localPurchaseDate: string | undefined,
): string[] {
  const violations: string[] = [];
  for (const material of state.materials) {
    const supplies = new Map<string, number>();
    const usage = new Map<string, number>();
    const arrival = arrivalDates[material.id] ?? material.scheduledArrival;
    if (material.delayedShipment > 0) {
      supplies.set(arrival, (supplies.get(arrival) ?? 0) + material.delayedShipment);
    }
    if (
      material.id === state.disruption?.materialId &&
      localPurchaseUnits > 0 &&
      localPurchaseDate
    ) {
      supplies.set(
        localPurchaseDate,
        (supplies.get(localPurchaseDate) ?? 0) + localPurchaseUnits,
      );
    }
    for (const item of state.tasks) {
      const scheduledDate = taskDates.get(item.id);
      if (
        !scheduledDate ||
        item.status === "complete" ||
        item.materialId !== material.id ||
        item.materialQuantity <= 0
      ) {
        continue;
      }
      usage.set(
        scheduledDate,
        (usage.get(scheduledDate) ?? 0) + item.materialQuantity,
      );
    }

    let available = material.available;
    const days = [...new Set([...supplies.keys(), ...usage.keys()])].sort();
    for (const day of days) {
      available += supplies.get(day) ?? 0;
      const required = usage.get(day) ?? 0;
      if (required > available) {
        violations.push(
          `Material shortage: ${material.name} needs ${required} ${material.unit} on ${day}, but only ${available} are available.`,
        );
        available -= required;
      } else {
        available -= required;
      }
    }
  }
  return violations;
}

function machineScheduleViolations(
  state: PersistedShopState,
  taskDates: Map<string, string>,
): string[] {
  const violations: string[] = [];
  const machines = new Map(state.machines.map((item) => [item.id, item]));
  const loads = new Map<string, number>();
  for (const item of state.tasks) {
    const date = taskDates.get(item.id);
    if (!date || item.status === "complete") continue;
    const machine = machines.get(item.machineId);
    if (!machine) {
      violations.push(`Task ${item.id} uses missing machine ${item.machineId}.`);
      continue;
    }
    if (item.durationHours <= 0 || item.durationHours > machine.hoursPerDay) {
      violations.push(
        `Task ${item.id} requires ${item.durationHours} hours, above ${machine.name}'s ${machine.hoursPerDay}-hour daily capacity.`,
      );
      continue;
    }
    const key = `${item.machineId}:${date}`;
    loads.set(key, (loads.get(key) ?? 0) + item.durationHours);
  }
  for (const [key, hours] of loads) {
    const machineId = key.slice(0, key.indexOf(":"));
    const machine = machines.get(machineId)!;
    if (hours > machine.hoursPerDay) {
      violations.push(
        `${machine.name} is overloaded on ${key.slice(key.indexOf(":") + 1)}: ${hours} of ${machine.hoursPerDay} hours.`,
      );
    }
  }
  return violations;
}

function dependencyScheduleViolations(
  state: PersistedShopState,
  taskDates: Map<string, string>,
): string[] {
  const byId = new Map(state.tasks.map((item) => [item.id, item]));
  const violations: string[] = [];
  for (const item of state.tasks) {
    const scheduledDate = taskDates.get(item.id);
    if (!scheduledDate) {
      violations.push(`Task ${item.id} has no scheduled date.`);
      continue;
    }
    for (const dependencyId of item.dependsOn) {
      const dependency = byId.get(dependencyId);
      const dependencyDate = taskDates.get(dependencyId);
      if (!dependency || !dependencyDate) {
        violations.push(`Task ${item.id} has an unresolved dependency ${dependencyId}.`);
      } else if (dependencyDate >= scheduledDate) {
        violations.push(
          `Task ${item.id} is scheduled before dependency ${dependency.id} is complete.`,
        );
      }
    }
  }
  return violations;
}

function recoveryInputFingerprint(state: PersistedShopState): string {
  return JSON.stringify({
    disruption: state.disruption,
    orders: [...state.orders]
      .map(({ id, dueDate, priority, taskIds }) => ({ id, dueDate, priority, taskIds }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    materials: [...state.materials]
      .map(({ id, available, delayedShipment, scheduledArrival, alternateAvailable, expediteCost }) => ({
        id,
        available,
        delayedShipment,
        scheduledArrival,
        alternateAvailable,
        expediteCost,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    machines: [...state.machines]
      .map(({ id, hoursPerDay }) => ({ id, hoursPerDay }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    tasks: [...state.tasks]
      .map(({ id, orderId, machineId, materialId, materialQuantity, durationHours, dependsOn, scheduledDate, status }) => ({
        id,
        orderId,
        machineId,
        materialId,
        materialQuantity,
        durationHours,
        dependsOn: [...dependsOn].sort(),
        scheduledDate,
        status,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}

function buildRecoverySchedule(
  state: PersistedShopState,
  kind: RecoveryKind,
  targetOrderId: string,
  localPurchaseUnits: number,
): ScheduleAttempt {
  if (!state.disruption) {
    return { taskDates: new Map(), hardViolations: ["No active disruption is available."] };
  }

  const impact = analyzeImpact(state);
  const affectedTaskIds = new Set(impact.affectedTaskIds);
  const reflowTaskIds = new Set(
    kind === "wait"
      ? [...affectedTaskIds]
      : kind === "protect-target"
        ? [...affectedTaskIds].filter(
            (taskId) => state.tasks.find((item) => item.id === taskId)?.orderId !== targetOrderId,
          )
        : [],
  );
  const { tasks: orderedTasks, violations: orderingViolations } =
    tasksInDependencyOrder(state);
  const taskDates = new Map<string, string>();
  for (const item of state.tasks) {
    if (!reflowTaskIds.has(item.id)) taskDates.set(item.id, item.scheduledDate);
  }

  const material = state.materials.find(
    (item) => item.id === state.disruption?.materialId,
  );
  const arrivalDates = Object.fromEntries(
    state.materials.map((item) => [
      item.id,
      item.id === state.disruption?.materialId && kind === "expedite"
        ? state.disruption.originalArrivalDate
        : item.scheduledArrival,
    ]),
  );
  const targetMaterialTask = state.tasks
    .filter(
      (item) =>
        item.orderId === targetOrderId &&
        item.materialId === state.disruption?.materialId &&
        item.materialQuantity > 0,
    )
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];
  const localPurchaseDate = targetMaterialTask?.scheduledDate;

  const hardViolations = [...orderingViolations];
  hardViolations.push(
    ...machineScheduleViolations(state, taskDates),
    ...materialScheduleViolations(
      state,
      taskDates,
      arrivalDates,
      kind === "protect-target" ? localPurchaseUnits : 0,
      localPurchaseDate,
    ),
  );
  const machineLoad = new Map<string, number>();
  for (const item of state.tasks) {
    const date = taskDates.get(item.id);
    if (!date || item.status === "complete") continue;
    const key = `${item.machineId}:${date}`;
    machineLoad.set(key, (machineLoad.get(key) ?? 0) + item.durationHours);
  }

  const machineById = new Map(state.machines.map((item) => [item.id, item]));
  for (const item of orderedTasks) {
    if (!reflowTaskIds.has(item.id) || item.status === "complete") continue;
    const machine = machineById.get(item.machineId);
    if (!machine) {
      hardViolations.push(`Task ${item.id} uses missing machine ${item.machineId}.`);
      continue;
    }
    if (item.durationHours <= 0 || item.durationHours > machine.hoursPerDay) {
      hardViolations.push(
        `Task ${item.id} requires ${item.durationHours} hours, above ${machine.name}'s ${machine.hoursPerDay}-hour daily capacity.`,
      );
      continue;
    }
    let earliest = nextOrSameBusinessDay(state.disruption.revisedArrivalDate);
    let dependencyBlocked = false;
    for (const dependencyId of item.dependsOn) {
      const dependencyDate = taskDates.get(dependencyId);
      if (!dependencyDate) {
        hardViolations.push(`Task ${item.id} has an unresolved dependency ${dependencyId}.`);
        dependencyBlocked = true;
        continue;
      }
      const afterDependency = nextBusinessDay(dependencyDate);
      if (afterDependency > earliest) earliest = afterDependency;
    }
    if (dependencyBlocked) continue;

    let candidate = earliest;
    const lastCandidate = addCalendarDays(earliest, MAX_SCHEDULE_DAYS);
    let placed = false;
    while (candidate <= lastCandidate) {
      const loadKey = `${item.machineId}:${candidate}`;
      const currentLoad = machineLoad.get(loadKey) ?? 0;
      if (currentLoad + item.durationHours <= machine.hoursPerDay) {
        const candidateDates = new Map(taskDates);
        candidateDates.set(item.id, candidate);
        const materialFailures = materialScheduleViolations(
          state,
          candidateDates,
          arrivalDates,
          kind === "protect-target" ? localPurchaseUnits : 0,
          localPurchaseDate,
        );
        if (materialFailures.length === 0) {
          taskDates.set(item.id, candidate);
          machineLoad.set(loadKey, currentLoad + item.durationHours);
          placed = true;
          break;
        }
      }
      candidate = nextBusinessDay(candidate);
    }
    if (!placed) {
      const reason = material
        ? `No material- and capacity-feasible slot within ${MAX_SCHEDULE_DAYS} days for ${item.id}.`
        : `Material ${state.disruption.materialName} is missing from the shop state.`;
      hardViolations.push(reason);
    }
  }

  const finalHardViolations = [
    ...hardViolations,
    ...machineScheduleViolations(state, taskDates),
    ...dependencyScheduleViolations(state, taskDates),
    ...materialScheduleViolations(
      state,
      taskDates,
      arrivalDates,
      kind === "protect-target" ? localPurchaseUnits : 0,
      localPurchaseDate,
    ),
  ];
  return {
    taskDates,
    hardViolations: [...new Set(finalHardViolations)],
  };
}

interface EvaluatedRecoveryPlan {
  projection: RecoveryProjection;
  cost: number;
  changedTaskCount: number;
  lateOrderIds: string[];
  rationale: string;
  actions: string[];
  risks: string[];
}

function evaluateRecoveryPlan(
  state: PersistedShopState,
  planId: string,
  targetOrderId: string,
  kind: RecoveryKind,
): EvaluatedRecoveryPlan {
  const disruption = state.disruption!;
  const delayedMaterial = state.materials.find(
    (item) => item.id === disruption.materialId,
  );
  const targetOrder = state.orders.find((item) => item.id === targetOrderId)!;
  const targetTasks = state.tasks.filter((item) => item.orderId === targetOrderId);
  const targetMaterialTasks = targetTasks.filter(
    (item) =>
      item.materialId === disruption.materialId &&
      item.materialQuantity > 0 &&
      item.scheduledDate < disruption.revisedArrivalDate,
  );
  const localPurchaseUnits =
    kind === "protect-target" && delayedMaterial
      ? Math.max(
          0,
          targetMaterialTasks.reduce(
            (total, item) => total + item.materialQuantity,
            0,
          ) - delayedMaterial.available,
        )
      : 0;
  const localPurchaseDate = targetMaterialTasks
    .map((item) => item.scheduledDate)
    .sort()[0];
  const schedule = buildRecoverySchedule(
    state,
    kind,
    targetOrderId,
    localPurchaseUnits,
  );
  const arrivalDates = Object.fromEntries(
    state.materials.map((item) => [
      item.id,
      item.id === disruption.materialId && kind === "expedite"
        ? disruption.originalArrivalDate
        : item.scheduledArrival,
    ]),
  );
  const taskDates: Record<string, string> = {};
  for (const item of state.tasks) {
    taskDates[item.id] = schedule.taskDates.get(item.id) ?? item.scheduledDate;
  }
  const missingTaskDates = state.tasks
    .filter((item) => !schedule.taskDates.has(item.id))
    .map((item) => `Task ${item.id} could not be placed in the projected schedule.`);
  const orderStatuses = Object.fromEntries(
    state.orders.map((order) => {
      const orderTasks = state.tasks.filter((item) => item.orderId === order.id);
      const allComplete =
        orderTasks.length > 0 && orderTasks.every((item) => item.status === "complete");
      const hasUnscheduledTask = orderTasks.some((item) => !schedule.taskDates.has(item.id));
      const finishDate = orderTasks
        .map((item) => taskDates[item.id])
        .sort()
        .at(-1);
      const late = hasUnscheduledTask || !finishDate || finishDate > order.dueDate;
      return [
        order.id,
        allComplete ? "complete" : late ? "late" : "on_track",
      ];
    }),
  ) as Record<string, OrderStatus>;
  const onTimeOrders = Object.values(orderStatuses).filter(
    (status) => status === "on_track" || status === "complete",
  ).length;
  const lateOrderIds = state.orders
    .filter((order) => orderStatuses[order.id] === "late")
    .map((order) => order.id);
  const changedOrderIds = state.orders
    .filter((order) =>
      order.taskIds.some((taskId) => taskDates[taskId] !== state.tasks.find((item) => item.id === taskId)?.scheduledDate),
    )
    .map((order) => order.id);
  const changedTaskCount = state.tasks.filter(
    (item) => taskDates[item.id] !== item.scheduledDate,
  ).length;
  const hardViolations = [...schedule.hardViolations, ...missingTaskDates];
  if (kind === "expedite" && (!delayedMaterial || delayedMaterial.expediteCost <= 0)) {
    hardViolations.push("Priority freight is not available for the delayed material.");
  }
  if (
    kind === "protect-target" &&
    localPurchaseUnits > 0 &&
    !delayedMaterial?.alternateAvailable
  ) {
    hardViolations.push("The alternate supplier cannot provide the required local stock.");
  }
  if (orderStatuses[targetOrderId] === "late") {
    hardViolations.push(
      `Hard target deadline missed: ${targetOrder.customer}'s order finishes after ${targetOrder.dueDate}.`,
    );
  }
  const uniqueHardViolations = [...new Set(hardViolations)];
  const lateOrders = lateOrderIds.length;
  const cost =
    kind === "expedite"
      ? delayedMaterial?.expediteCost ?? 0
      : (kind === "protect-target" ? localPurchaseUnits * LOCAL_UNIT_COST : 0) +
        lateOrders * LATE_ORDER_PENALTY;
  const projection: RecoveryProjection = {
    planId,
    inputFingerprint: recoveryInputFingerprint(state),
    taskDates,
    orderStatuses,
    materialAvailable: Object.fromEntries(
      state.materials.map((item) => [
        item.id,
        item.available +
          (item.id === disruption.materialId ? localPurchaseUnits : 0),
      ]),
    ),
    materialArrivalDates: arrivalDates,
    changedOrderIds,
    onTimeOrders,
    lateOrders,
    feasible: uniqueHardViolations.length === 0,
    hardViolations: uniqueHardViolations,
    localPurchaseUnits,
  };

  const targetFinish = targetTasks
    .map((item) => `${item.name} ${taskDates[item.id]}`)
    .join(" → ");
  const scheduleActions = state.orders
    .filter((order) => order.id === targetOrderId || changedOrderIds.includes(order.id))
    .map((order) => {
      const steps = state.tasks
        .filter((item) => item.orderId === order.id)
        .sort((a, b) => order.taskIds.indexOf(a.id) - order.taskIds.indexOf(b.id))
        .map((item) => `${item.name} ${taskDates[item.id]}`)
        .join(" → ");
      return `Schedule ${order.id} (${order.customer}): ${steps}. Due ${order.dueDate}; ${orderStatuses[order.id] === "late" ? "late" : "on time"}.`;
    });
  const localCostLabel =
    kind === "protect-target"
      ? `${localPurchaseUnits} local ${delayedMaterial?.unit === "sheets" ? "sheet" : "unit"}${localPurchaseUnits === 1 ? "" : "s"} × $${LOCAL_UNIT_COST}`
      : "";
  const costDetails =
    kind === "expedite"
      ? `modeled priority freight $${cost}`
      : `${localCostLabel ? `${localCostLabel} + ` : ""}${lateOrders} late orders × $${LATE_ORDER_PENALTY}`;
  const rationale =
    `${kind === "expedite" ? "Preserve the existing schedule with an expedited arrival." : kind === "protect-target" ? "Protect the selected order with local stock, then schedule remaining exposed work against capacity." : "Make no local purchase; schedule exposed work after the delayed material arrives."} ` +
    `Projected cost: $${cost} (${costDetails}). ${onTimeOrders} orders finish by their due dates; ${lateOrders} finish late. ` +
    `The selected order's projected sequence is ${targetFinish || "not scheduled"} (due ${targetOrder.dueDate}). ` +
    "Recommendation policy: minimize late customer orders first, then modeled cost. Non-target due dates remain visible and carry a modeled $100 late penalty; the selected order's deadline is hard.";
  const actions = [
    kind === "expedite"
      ? `Model priority freight for ${disruption.materialName} at $${delayedMaterial?.expediteCost ?? 0}; no supplier or carrier is contacted.`
      : kind === "protect-target"
        ? `Reserve ${localPurchaseUnits} ${delayedMaterial?.unit === "sheets" ? "sheet" : "unit"}${localPurchaseUnits === 1 ? "" : "s"} from ${delayedMaterial?.alternateSupplier ?? "the alternate supplier"} for ${targetOrder.customer}; modeled cost $${localPurchaseUnits * LOCAL_UNIT_COST}.`
        : `Use the delayed shipment arriving ${disruption.revisedArrivalDate}; make no local purchase.`,
    ...scheduleActions,
    `Modeled late-delivery penalty: $${LATE_ORDER_PENALTY} per late order; no overtime surcharge is included because the scenario has no overtime price.`,
    ...(uniqueHardViolations.length
      ? uniqueHardViolations.map((item) => `Constraint failure: ${item}`)
      : []),
  ];
  const risks = [
    ...(lateOrderIds.length
      ? [`${lateOrderIds.length} orders are forecast late: ${lateOrderIds.join(", ")}.`]
      : []),
    ...(kind === "protect-target" && localPurchaseUnits > 0
      ? ["Local supplier availability and the $110-per-sheet estimate are simulated assumptions, not a quote or purchase."]
      : []),
    ...(kind === "expedite"
      ? ["The expedited arrival date and freight estimate are simulated, not a carrier commitment."]
      : []),
    ...uniqueHardViolations,
  ];
  return {
    projection,
    cost,
    changedTaskCount,
    lateOrderIds,
    rationale,
    actions,
    risks,
  };
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

  const delayedMaterial = state.materials.find(
    (item) => item.id === disruption.materialId,
  );
  if (!delayedMaterial) {
    throw new DomainError(
      `Material '${disruption.materialId}' was not found.`,
      404,
    );
  }
  let remainingStock = delayedMaterial.available;
  let inboundReceived = false;
  const seedTaskIds = new Set<string>();
  const materialTasks = state.tasks
    .filter(
      (item) =>
        item.materialId === disruption.materialId &&
        item.materialQuantity > 0 &&
        item.status !== "complete",
    )
    .sort(
      (a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate) ||
        compareTaskPriority(state, a, b),
    );
  for (const item of materialTasks) {
    if (
      !inboundReceived &&
      item.scheduledDate >= delayedMaterial.scheduledArrival
    ) {
      remainingStock += delayedMaterial.delayedShipment;
      inboundReceived = true;
    }
    if (item.materialQuantity <= remainingStock) {
      remainingStock -= item.materialQuantity;
    } else {
      seedTaskIds.add(item.id);
    }
  }
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
  if (!impact.affectedOrderIds.includes(targetOrderId)) {
    throw new DomainError(
      `Order '${targetOrderId}' is not exposed to the active material delay.`,
      400,
    );
  }
  const planId = (key: string) =>
    key === "protect-target"
      ? `${state.disruption!.id}-${targetOrderId}-${key}`
      : `${state.disruption!.id}-${key}`;
  const planSpecs: Array<{
    key: RecoveryKind;
    name: string;
    strategy: string;
  }> = [
    {
      key: "expedite",
      name: "Expedite the full shipment",
      strategy: "Model priority freight and preserve current task dates.",
    },
    {
      key: "protect-target",
      name: `Protect ${targetOrder.customer} with a partial local buy`,
      strategy: "Reserve local stock for the selected order and re-sequence other exposed work.",
    },
    {
      key: "wait",
      name: "Wait for the delayed shipment",
      strategy: "Make no local purchase and schedule exposed work after the shipment arrives.",
    },
  ];
  const evaluations = planSpecs.map((spec) => ({
    ...spec,
    id: planId(spec.key),
    evaluation: evaluateRecoveryPlan(
      state,
      planId(spec.key),
      targetOrderId,
      spec.key,
    ),
  }));
  const recommended = [...evaluations]
    .filter((item) => item.evaluation.projection.feasible)
    .sort(
      (a, b) =>
        a.evaluation.projection.lateOrders - b.evaluation.projection.lateOrders ||
        a.evaluation.cost - b.evaluation.cost ||
        a.evaluation.changedTaskCount - b.evaluation.changedTaskCount ||
        a.id.localeCompare(b.id),
    )[0];
  const recoveryPlans: RecoveryPlan[] = evaluations.map((item) => ({
    id: item.id,
    name: item.name,
    strategy: item.strategy,
    targetOrderId,
    feasible: item.evaluation.projection.feasible,
    cost: item.evaluation.cost,
    onTimeOrders: item.evaluation.projection.onTimeOrders,
    lateOrders: item.evaluation.projection.lateOrders,
    affectedOrders: item.evaluation.projection.changedOrderIds,
    risks: item.evaluation.risks,
    rationale:
      item.id === recommended?.id
        ? `Recommended by policy (fewer late customers first, then modeled cost). ${item.evaluation.rationale}`
        : item.evaluation.rationale,
    actions: item.evaluation.actions,
    status: "proposed",
  }));

  const existing = new Map(state.plans.map((plan) => [plan.id, plan]));
  const plans = recoveryPlans.map((plan) => {
    const prior = existing.get(plan.id);
    return prior ? { ...plan, status: prior.status } : plan;
  });
  if (recoveryPlans.every((plan) => existing.has(plan.id))) {
    return { state, plans };
  }
  const projections = {
    ...(state.recoveryProjections ?? {}),
    ...Object.fromEntries(
      evaluations.map((item) => [item.id, item.evaluation.projection]),
    ),
  };
  let next: PersistedShopState = {
    ...state,
    plans: [
      ...state.plans.filter(
        (plan) => !recoveryPlans.some((candidate) => candidate.id === plan.id),
      ),
      ...plans,
    ],
    recoveryProjections: projections,
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
  const projection = state.recoveryProjections?.[planId];
  if (
    !projection ||
    projection.inputFingerprint !== recoveryInputFingerprint(state)
  ) {
    throw new DomainError(
      "This plan has no current constraint-checked projection. Generate recovery plans again before approval.",
      409,
    );
  }
  if (!projection.feasible) {
    throw new DomainError(
      "This plan violates a hard scheduling constraint and cannot be approved.",
    );
  }

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

  if (state.executedRequestIds.includes(requestId)) return state;
  if (plan.status === "executed" || plan.status === "verified") return state;
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

  const projection = state.recoveryProjections?.[planId];
  if (
    !projection ||
    projection.inputFingerprint !== recoveryInputFingerprint(state)
  ) {
    throw new DomainError(
      "The approved plan is stale or missing its projected schedule. Generate and approve a current plan before execution.",
      409,
    );
  }
  if (!projection.feasible || !plan.feasible) {
    throw new DomainError(
      "The approved plan violates a hard scheduling constraint and cannot execute.",
      409,
    );
  }
  if (
    state.tasks.some((task) => !projection.taskDates[task.id]) ||
    state.orders.some((order) => !projection.orderStatuses[order.id]) ||
    state.materials.some(
      (material) =>
        projection.materialAvailable[material.id] === undefined ||
        projection.materialArrivalDates[material.id] === undefined,
    )
  ) {
    throw new DomainError(
      "The approved plan is incomplete and cannot be executed.",
      409,
    );
  }

  let next: PersistedShopState = {
    ...state,
    materials: state.materials.map((material) => {
      return {
        ...material,
        available: projection.materialAvailable[material.id],
        scheduledArrival: projection.materialArrivalDates[material.id],
      };
    }),
    tasks: state.tasks.map((task) => {
      return { ...task, scheduledDate: projection.taskDates[task.id] };
    }),
    orders: state.orders.map((order) => {
      return { ...order, status: projection.orderStatuses[order.id] };
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
  const projection = state.recoveryProjections?.[planId];
  const actualTaskDates = new Map(
    state.tasks.map((item) => [item.id, item.scheduledDate]),
  );
  const actualArrivalDates = Object.fromEntries(
    state.materials.map((item) => [item.id, item.scheduledArrival]),
  );
  const actualOrderStatuses = Object.fromEntries(
    state.orders.map((order) => {
      const orderTasks = state.tasks.filter((item) => item.orderId === order.id);
      const allComplete =
        orderTasks.length > 0 && orderTasks.every((item) => item.status === "complete");
      const finishDate = orderTasks
        .map((item) => item.scheduledDate)
        .sort()
        .at(-1);
      return [
        order.id,
        allComplete
          ? "complete"
          : !finishDate || finishDate > order.dueDate
            ? "late"
            : "on_track",
      ];
    }),
  ) as Record<string, OrderStatus>;
  const onTimeOrders = Object.values(actualOrderStatuses).filter(
    (status) => status === "on_track" || status === "complete",
  ).length;
  const lateOrders = Object.values(actualOrderStatuses).filter(
    (status) => status === "late",
  ).length;
  const machineViolations = machineScheduleViolations(state, actualTaskDates);
  const dependencyViolations = dependencyScheduleViolations(
    state,
    actualTaskDates,
  );
  const materialViolations = materialScheduleViolations(
    state,
    actualTaskDates,
    actualArrivalDates,
    0,
    undefined,
  );
  const unknownMaterials = state.tasks
    .filter(
      (item) =>
        item.materialQuantity > 0 &&
        !state.materials.some((material) => material.id === item.materialId),
    )
    .map((item) => `Task ${item.id} uses missing material ${item.materialId}.`);
  const targetOrder = state.orders.find((order) => order.id === plan.targetOrderId);
  const targetDeadlineViolations = !targetOrder
    ? [`Selected target order ${plan.targetOrderId} is missing.`]
    : actualOrderStatuses[targetOrder.id] === "late"
      ? [`Hard target deadline missed: ${targetOrder.customer}'s order finishes after ${targetOrder.dueDate}.`]
      : [];
  const constraintViolations = [
    ...machineViolations,
    ...dependencyViolations,
    ...materialViolations,
    ...unknownMaterials,
    ...targetDeadlineViolations,
  ];
  const scheduleMatches =
    Boolean(projection) &&
    state.tasks.every(
      (item) => projection?.taskDates[item.id] === item.scheduledDate,
    );
  const orderOutcomesMatch =
    Boolean(projection) &&
    state.orders.every(
      (order) =>
        projection?.orderStatuses[order.id] === actualOrderStatuses[order.id] &&
        order.status === actualOrderStatuses[order.id],
    );
  const materialOutcomesMatch =
    Boolean(projection) &&
    state.materials.every(
      (material) =>
        projection?.materialAvailable[material.id] === material.available &&
        projection?.materialArrivalDates[material.id] ===
          material.scheduledArrival,
    );
  const planForecastMatches =
    Boolean(projection) &&
    projection?.feasible === plan.feasible &&
    projection?.onTimeOrders === plan.onTimeOrders &&
    projection?.lateOrders === plan.lateOrders &&
    projection?.changedOrderIds.length === plan.affectedOrders.length &&
    [...(projection?.changedOrderIds ?? [])].sort().join(",") ===
      [...plan.affectedOrders].sort().join(",");
  const stateMatches =
    Boolean(projection?.feasible) &&
    scheduleMatches &&
    orderOutcomesMatch &&
    materialOutcomesMatch &&
    planForecastMatches &&
    onTimeOrders === plan.onTimeOrders &&
    lateOrders === plan.lateOrders &&
    constraintViolations.length === 0;
  const issues = [
    ...constraintViolations,
    ...(!projection
      ? ["No persisted forecast exists for this plan; its exact predicted schedule cannot be compared."]
      : []),
    ...(projection && !scheduleMatches
      ? ["Persisted task dates differ from the plan's predicted schedule."]
      : []),
    ...(projection && !orderOutcomesMatch
      ? ["Persisted order outcomes differ from the dates or predicted order statuses."]
      : []),
    ...(projection && !materialOutcomesMatch
      ? ["Persisted material quantities or arrival dates differ from the plan forecast."]
      : []),
    ...(projection && !planForecastMatches
      ? ["The saved plan summary differs from its stored schedule projection."]
      : []),
    ...(onTimeOrders !== plan.onTimeOrders || lateOrders !== plan.lateOrders
      ? ["Actual on-time/late counts differ from the plan forecast."]
      : []),
  ];

  if (plan.status === "verified" && stateMatches) {
    return {
      state,
      result: {
        verified: true,
        message: "Verified: the persisted schedule, material, capacity, dependencies, deadlines, and plan forecast agree.",
        planId,
        onTimeOrders,
        lateOrders,
        stateMatches: true,
      },
    };
  }
  if (plan.status === "verified" && !projection) {
    return {
      state,
      result: {
        verified: false,
        message: "This legacy verified plan has no stored forecast snapshot, so exact predicted-schedule verification is unavailable.",
        planId,
        onTimeOrders,
        lateOrders,
        stateMatches: false,
      },
    };
  }
  if (!stateMatches && plan.status === "verified") {
    return {
      state,
      result: {
        verified: false,
        message: `Verification failed: ${issues.slice(0, 3).join(" ")}`,
        planId,
        onTimeOrders,
        lateOrders,
        stateMatches: false,
      },
    };
  }

  if (!stateMatches) {
    const description = `Verification failed for ${planId}: ${issues.slice(0, 3).join(" ") || "stored state does not match the projected outcome."}`;
    const priorFailure = state.actionHistory.at(-1);
    const next =
      priorFailure?.action === "recovery_verification_failed" &&
      priorFailure.planId === planId &&
      priorFailure.description === description
        ? state
        : addAction(
            state,
            "recovery_verification_failed",
            description,
            planId,
            "mismatch",
            now,
          );
    return {
      state: next,
      result: {
        verified: false,
        message: description,
        planId,
        onTimeOrders,
        lateOrders,
        stateMatches: false,
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
    `Verified ${onTimeOrders} on-time and ${lateOrders} late orders against the exact projected schedule for ${planId}.`,
    planId,
    "verified",
    now,
  );
  return {
    state: next,
    result: {
      verified: true,
      message: "Verified: the persisted schedule, material, capacity, dependencies, deadlines, and plan forecast agree.",
      planId,
      onTimeOrders,
      lateOrders,
      stateMatches: true,
    },
  };
}

export function getShopView(state: PersistedShopState): ShopState {
  const {
    actionHistory: _actionHistory,
    executedRequestIds: _executedRequestIds,
    recoveryProjections: _recoveryProjections,
    ...view
  } = state;
  return view;
}
