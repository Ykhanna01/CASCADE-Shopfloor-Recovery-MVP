export function refreshWorkspaceState(options: {
  inFlight: { current: boolean };
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  refetch: () => Promise<void>;
}): Promise<boolean>;

export function refetchAll<
  T extends readonly (() => Promise<unknown>)[],
>(
  refetches: T,
): Promise<{
  [K in keyof T]: T[K] extends () => Promise<infer Result> ? Result : never;
}>;

export function requestWithTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs?: number,
): Promise<T>;

export function scenarioQueryKey(
  queryKey: readonly unknown[],
  scenarioId: string | null,
): readonly unknown[];

export function scenarioRequestHeaders(
  scenarioId: string | null,
): Record<string, string>;

export function formatActionTimestamp(value: string): string;

export interface ActionHistoryRefreshStatus {
  scenarioId: string | null;
  pending: boolean;
  error: string;
  message: string;
}

export function refetchHistoryForWorkspace<T>(options: {
  scenarioId: string | null;
  isCurrentScenario: () => boolean;
  setStatus: (
    update: (current: ActionHistoryRefreshStatus) => ActionHistoryRefreshStatus,
  ) => void;
  refetch: () => Promise<T>;
}): Promise<T>;

export function refreshActionHistory(options: {
  scenarioId: string | null;
  inFlight: { current: Set<string | null> };
  isCurrentScenario: () => boolean;
  setStatus: (status: ActionHistoryRefreshStatus) => void;
  refetch: (scenarioId: string | null) => Promise<unknown>;
}): Promise<boolean>;
