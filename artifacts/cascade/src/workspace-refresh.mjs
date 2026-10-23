export async function refreshWorkspaceState({
  inFlight,
  setLoading,
  setError,
  refetch,
}) {
  if (inFlight.current) return false;
  inFlight.current = true;
  setLoading(true);
  setError("");
  try {
    await refetch();
    return true;
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unable to refresh workshop data.");
    return false;
  } finally {
    inFlight.current = false;
    setLoading(false);
  }
}

export async function withPendingState(setPending, operation) {
  try {
    setPending(true);
    return await operation();
  } finally {
    setPending(false);
  }
}

export function isPendingScenario(pendingScenarioId, scenarioId) {
  return pendingScenarioId !== undefined && pendingScenarioId === scenarioId;
}

export function clearPendingScenario(pendingScenarioId, completedScenarioId) {
  return pendingScenarioId === completedScenarioId ? undefined : pendingScenarioId;
}

export async function withScenarioPending(setPendingScenario, scenarioId, operation) {
  setPendingScenario(scenarioId);
  try {
    return await operation();
  } finally {
    setPendingScenario((pendingScenarioId) => clearPendingScenario(pendingScenarioId, scenarioId));
  }
}

export async function refetchAll(refetches) {
  const settled = await Promise.allSettled(refetches.map((refetch) => refetch()));
  const failed = settled.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return settled.map((result) => {
    if (result.status !== "fulfilled") throw result.reason;
    return result.value;
  });
}

export async function requestWithTimeout(request, timeoutMs = 20000) {
  const controller = new AbortController();
  let timeoutId;
  const timeoutError = new Error("Request timed out. Check the connection and try again.");
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => request(controller.signal)),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function scenarioQueryKey(queryKey, scenarioId) {
  return [...queryKey, scenarioId ?? "northstar-demo"];
}

export function scenarioRequestHeaders(scenarioId) {
  return scenarioId ? { "x-cascade-scenario-id": scenarioId } : {};
}

export function formatActionTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }).format(date);
}

export async function refetchHistoryForWorkspace({
  scenarioId,
  isCurrentScenario,
  setStatus,
  refetch,
}) {
  const result = await refetch();
  if (isCurrentScenario()) {
    setStatus((current) => current.scenarioId === scenarioId
      ? { ...current, error: "", message: "Action history refreshed." }
      : current);
  }
  return result;
}

export async function refreshActionHistory({
  scenarioId,
  inFlight,
  isCurrentScenario,
  setStatus,
  refetch,
}) {
  if (inFlight.current.has(scenarioId)) return false;

  inFlight.current.add(scenarioId);
  if (isCurrentScenario()) {
    setStatus({ scenarioId, pending: true, error: "", message: "" });
  }
  try {
    await refetch(scenarioId);
    if (isCurrentScenario()) {
      setStatus({
        scenarioId,
        pending: false,
        error: "",
        message: "Action history refreshed.",
      });
    }
    return true;
  } catch {
    if (isCurrentScenario()) {
      setStatus({
        scenarioId,
        pending: false,
        error: "Could not reload action history. Check the connection and try again.",
        message: "",
      });
    }
    return false;
  } finally {
    inFlight.current.delete(scenarioId);
  }
}
