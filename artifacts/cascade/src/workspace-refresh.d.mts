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
