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

export async function refetchAll(refetches) {
  const settled = await Promise.allSettled(refetches.map((refetch) => refetch()));
  const failed = settled.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return settled.map((result) => {
    if (result.status !== "fulfilled") throw result.reason;
    return result.value;
  });
}
