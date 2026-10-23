import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, AudioLines, Check, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Command, Factory, FileClock, HardHat, Layers3,
  LogOut, Mic, Package, Radio, RefreshCw, ShieldCheck, Siren, Truck, WandSparkles, X,
} from 'lucide-react';
import {
  analyzeImpact, getActionHistory, getGetActionHistoryQueryKey, getGetShopStateQueryKey, getHealthCheckQueryKey, getShopState,
  healthCheck, useApproveRecovery, useExecuteRecovery, useGetActionHistory,
  useGetShopState, useHealthCheck, useProposeRecovery, useSimulateDisruption,
  useVerifyRecovery,
} from '@workspace/api-client-react';
import { customFetch, setCsrfToken, setScenarioIdGetter } from '@workspace/api-client-react';
import type { ActionEvent, ImpactAnalysis, RecoveryPlan, ShopState, VerificationResult } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  refetchAll,
  formatActionTimestamp,
  requestWithTimeout,
  refreshActionHistory,
  refetchHistoryForWorkspace,
  refreshWorkspaceState,
  scenarioQueryKey,
  scenarioRequestHeaders,
} from './workspace-refresh.mjs';

const queryClient = new QueryClient();
const DEMO_PROMPT = 'Our plywood shipment is delayed by two days. Can we still deliver the Palmer order on Friday without making our other customers late?';
const SCENARIO_STORAGE_KEY = 'cascade-active-scenario-id';

let activeScenarioId: string | null = null;
try {
  activeScenarioId = window.sessionStorage.getItem(SCENARIO_STORAGE_KEY)
    ?? window.localStorage.getItem(SCENARIO_STORAGE_KEY);
} catch {
  try {
    activeScenarioId = window.localStorage.getItem(SCENARIO_STORAGE_KEY);
  } catch {
    activeScenarioId = null;
  }
}
activeScenarioId ??= new URLSearchParams(window.location.search).get('cascadeScenario');
setScenarioIdGetter(() => activeScenarioId);

function saveActiveScenarioId(scenarioId: string): boolean {
  activeScenarioId = scenarioId;
  let stored = false;
  try {
    window.sessionStorage.setItem(SCENARIO_STORAGE_KEY, scenarioId);
    stored = true;
  } catch {
    try {
      window.localStorage.setItem(SCENARIO_STORAGE_KEY, scenarioId);
      stored = true;
    } catch {
      stored = false;
    }
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('cascadeScenario', scenarioId);
    window.history.replaceState(null, '', url);
    return true;
  } catch {
    return stored;
  }
}

function Status({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const colors = {
    good: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    warn: 'bg-amber-50 text-amber-800 border border-amber-200',
    bad: 'bg-rose-50 text-rose-800 border border-rose-200',
    neutral: 'bg-stone-100 text-stone-700 border border-stone-200',
  };
  return <span className={`status-pill ${colors[tone]}`}><span className="status-dot" />{children}</span>;
}

function Button({ children, onClick, disabled, kind = 'primary', testId, className = '', type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'quiet' | 'danger';
  testId: string; className?: string; type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-[hsl(var(--primary))] text-white hover:bg-[hsl(169_54%_24%)] border-transparent',
    secondary: 'bg-[hsl(var(--card))] text-foreground hover:bg-[hsl(var(--muted))] border-[hsl(var(--border))]',
    quiet: 'bg-transparent text-muted-foreground hover:bg-[hsl(var(--muted))] border-transparent',
    danger: 'bg-rose-700 text-white hover:bg-rose-800 border-transparent',
  };
  return <button type={type} data-testid={testId} onClick={onClick} disabled={disabled}
    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${styles[kind]} ${className}`}>
    {children}
  </button>;
}

function LoadingPanel() {
  return <div className="space-y-4" aria-label="Loading workshop data">
    <div className="skeleton h-28" />
    <div className="grid gap-4 md:grid-cols-3"><div className="skeleton h-24" /><div className="skeleton h-24" /><div className="skeleton h-24" /></div>
    <div className="skeleton h-72" />
  </div>;
}

function SignInPanel({ password, error, pending, onPasswordChange, onSubmit }: {
  password: string;
  error: string;
  pending: boolean;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-foreground">
    <Header />
    <main className="mx-auto max-w-md px-5 py-16">
      <section className="panel p-6 sm:p-8">
        <span className="eyebrow">Private demonstration</span>
        <h1 className="display mt-2 text-2xl font-semibold">Sign in to CASCADE</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use the reviewer access password provided by the project owner. It is sent only to the server and is never stored in browser build configuration.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="grid gap-1.5 text-xs font-medium" htmlFor="demo-password">Demo access password
            <input id="demo-password" data-testid="input-demo-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => onPasswordChange(event.target.value)} className="h-10 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 outline-none focus:border-primary" />
          </label>
          {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">{error}</p>}
          <Button testId="button-demo-login" type="submit" disabled={pending || password.length === 0} className="w-full">{pending ? <><RefreshCw size={14} className="animate-spin" /> Signing in</> : 'Sign in'}</Button>
        </form>
      </section>
    </main>
  </div>;
}

function Home() {
  const queryClient = useQueryClient();
  const [scenarioId, setScenarioId] = useState(activeScenarioId);
  const scenarioIdRef = useRef(scenarioId);
  scenarioIdRef.current = scenarioId;
  const shopQueryKey = scenarioQueryKey(getGetShopStateQueryKey(), scenarioId);
  const historyQueryKey = scenarioQueryKey(getGetActionHistoryQueryKey(), scenarioId);
  const [authSession, setAuthSession] = useState({ checked: false, required: false, authenticated: false, csrfToken: null as string | null, unavailable: false });
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState('');
  const shop = useGetShopState({ query: { queryKey: shopQueryKey } });
  const history = useGetActionHistory({ query: { queryKey: historyQueryKey } });
  const health = useHealthCheck();
  const simulateMutation = useSimulateDisruption();
  const proposeMutation = useProposeRecovery();
  const approveMutation = useApproveRecovery();
  const executeMutation = useExecuteRecovery();
  const verifyMutation = useVerifyRecovery();
  const [scenarioText, setScenarioText] = useState(DEMO_PROMPT);
  const [materialId, setMaterialId] = useState('');
  const [delayDays, setDelayDays] = useState('2');
  const [impact, setImpact] = useState<ImpactAnalysis | null>(null);
  const [impactPendingScenario, setImpactPendingScenario] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<RecoveryPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState('');
  const [targetOrderId, setTargetOrderId] = useState('PAL-204');
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [confirmExecuteId, setConfirmExecuteId] = useState('');
  const [executionAcknowledged, setExecutionAcknowledged] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmNewDemo, setConfirmNewDemo] = useState(false);
  const [notice, setNotice] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);
  const [newDemoPending, setNewDemoPending] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [historyRefreshStatus, setHistoryRefreshStatus] = useState({
    scenarioId: null as string | null,
    pending: false,
    error: '',
    message: '',
  });
  const refreshInFlight = useRef(false);
  const impactRequests = useRef(new Map<string, Promise<ImpactAnalysis>>());
  const newDemoInFlight = useRef(false);
  const newDemoRequestId = useRef('');
  const historyRefreshInFlight = useRef(new Set<string | null>());
  const analyzedDisruptionId = useRef('');
  const restoredVerificationPlanId = useRef('');

  useEffect(() => {
    let active = true;
    setCsrfToken(null);
    fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session check failed.');
        return response.json() as Promise<{ authRequired: boolean; authenticated: boolean; csrfToken: string | null }>;
      })
      .then((session) => {
        if (!active) return;
        setCsrfToken(session.csrfToken);
        setAuthSession({ required: session.authRequired, authenticated: session.authenticated, csrfToken: session.csrfToken, checked: true, unavailable: false });
      })
      .catch(() => {
        if (!active) return;
        setAuthSession({ checked: true, required: true, authenticated: false, csrfToken: null, unavailable: true });
      });
    return () => { active = false; };
  }, []);

  const state = shop.data;
  const orders = state?.orders ?? [];
  const materials = state?.materials ?? [];
  const tasks = state?.tasks ?? [];
  const machines = state?.machines ?? [];
  const events = (history.data ?? []) as ActionEvent[];
  const visibleHistoryRefreshStatus = historyRefreshStatus.scenarioId === scenarioId
    ? historyRefreshStatus
    : null;
  const selectedMaterialId = materialId || materials.find((material) => material.name.toLowerCase().includes('plywood'))?.id || materials[0]?.id || '';
  const activeDisruption = impact?.disruption ?? state?.disruption ?? null;
  const activePlan = alternatives.find((plan) => plan.id === activePlanId) ?? state?.plans.find((plan) => plan.id === activePlanId) ?? null;
  const selectedPlanChanges = activePlan ? tasks.filter((task) => activePlan.affectedOrders.includes(task.orderId)) : [];
  const recoveredMaterial = materials.find((material) => material.id === activeDisruption?.materialId);
  const selectedMaterial = materials.find((material) => material.id === selectedMaterialId);
  const impactPending = impactPendingScenario === scenarioId;
  const anyPending = simulateMutation.isPending || impactPending || proposeMutation.isPending ||
    approveMutation.isPending || executeMutation.isPending || verifyMutation.isPending ||
    refreshPending || newDemoPending;
  const firstError = shop.error || simulateMutation.error ||
    proposeMutation.error || approveMutation.error || executeMutation.error || verifyMutation.error;

  const requestImpact = (requestedScenarioId: string | null) => {
    const key = requestedScenarioId ?? 'northstar-demo';
    const existing = impactRequests.current.get(key);
    if (existing) return existing;
    const request = requestWithTimeout((signal) => analyzeImpact({
      signal,
      headers: scenarioRequestHeaders(requestedScenarioId),
    }));
    impactRequests.current.set(key, request);
    void request.then(
      () => { if (impactRequests.current.get(key) === request) impactRequests.current.delete(key); },
      () => { if (impactRequests.current.get(key) === request) impactRequests.current.delete(key); },
    );
    return request;
  };

  const refreshWorkspace = async () => {
    if (scenarioIdRef.current === scenarioId) {
      setImpact(null);
      if (state?.disruption) setImpactPendingScenario(scenarioId);
    }
    const refreshed = await refreshWorkspaceState({
      inFlight: refreshInFlight,
      setLoading: setRefreshPending,
      setError: setWorkspaceError,
      refetch: async () => {
        const results = await refetchAll([
          () => requestWithTimeout((signal) => getShopState({
            signal,
            headers: scenarioRequestHeaders(scenarioId),
          })),
          () => refetchHistoryForWorkspace({
            scenarioId,
            isCurrentScenario: () => scenarioIdRef.current === scenarioId,
            setStatus: setHistoryRefreshStatus,
            refetch: () => requestWithTimeout((signal) => getActionHistory({
              signal,
              headers: scenarioRequestHeaders(scenarioId),
            })),
          }),
          () => requestWithTimeout((signal) => healthCheck({ signal })),
        ] as const);
        const refreshedState = results[0];
        if (!refreshedState) throw new Error('The API returned no workshop state.');
        queryClient.setQueryData(shopQueryKey, refreshedState);
        queryClient.setQueryData(historyQueryKey, results[1]);
        queryClient.setQueryData(getHealthCheckQueryKey(), results[2]);
        if (scenarioIdRef.current !== scenarioId) return;

        setAlternatives([]);
        setActivePlanId('');
        setVerification(null);
        restoredVerificationPlanId.current = '';
        const disruptionId = refreshedState.disruption?.id ?? '';
        analyzedDisruptionId.current = disruptionId
          ? `${scenarioId ?? 'northstar-demo'}:${disruptionId}`
          : '';
        if (disruptionId) {
          setImpact(null);
          setImpactPendingScenario(scenarioId);
          try {
            const refreshedImpact = await requestImpact(scenarioId);
            if (scenarioIdRef.current === scenarioId) setImpact(refreshedImpact);
          } catch (error) {
            if (scenarioIdRef.current === scenarioId) setImpact(null);
            throw error;
          } finally {
            if (scenarioIdRef.current === scenarioId) setImpactPendingScenario(null);
          }
        } else {
          setImpact(null);
        }
      },
    });
    if (scenarioIdRef.current === scenarioId) setImpactPendingScenario(null);
    return refreshed;
  };

  const refreshCurrentDemo = async () => {
    setNotice('');
    setWorkspaceError('');
    const refreshed = await refreshWorkspace();
    if (refreshed && scenarioIdRef.current === scenarioId) {
      setNotice('Current demo reloaded from saved state. No scenario was created or reset.');
    }
  };

  const refreshCurrentHistory = () => refreshActionHistory({
    scenarioId,
    inFlight: historyRefreshInFlight,
    isCurrentScenario: () => scenarioIdRef.current === scenarioId,
    setStatus: setHistoryRefreshStatus,
    refetch: async (requestedScenarioId) => {
      const actions = await requestWithTimeout((signal) => getActionHistory({
        signal,
        headers: scenarioRequestHeaders(requestedScenarioId),
      }));
      queryClient.setQueryData(
        scenarioQueryKey(getGetActionHistoryQueryKey(), requestedScenarioId),
        actions,
      );
      return actions;
    },
  });

  const startNewDemo = async () => {
    if (newDemoInFlight.current) return;
    newDemoInFlight.current = true;
    let createdScenarioId: string | null = null;
    setNewDemoPending(true);
    setWorkspaceError('');
    setNotice('');
    if (!newDemoRequestId.current) newDemoRequestId.current = window.crypto.randomUUID();
    try {
      const created = await customFetch<{ scenarioId: string; state: ShopState }>(
        '/api/cascade/scenarios',
        {
          method: 'POST',
          body: JSON.stringify({ requestId: newDemoRequestId.current }),
        },
      );
      createdScenarioId = created.scenarioId;
      const scenarioStored = saveActiveScenarioId(created.scenarioId);
      scenarioIdRef.current = created.scenarioId;
      setScenarioId(created.scenarioId);
      queryClient.setQueryData(
        scenarioQueryKey(getGetShopStateQueryKey(), created.scenarioId),
        created.state,
      );
      queryClient.setQueryData(
        scenarioQueryKey(getGetActionHistoryQueryKey(), created.scenarioId),
        [],
      );
      setHistoryRefreshStatus({
        scenarioId: created.scenarioId,
        pending: false,
        error: '',
        message: '',
      });
      simulateMutation.reset();
      proposeMutation.reset();
      approveMutation.reset();
      executeMutation.reset();
      verifyMutation.reset();
      setScenarioText(DEMO_PROMPT);
      setMaterialId('');
      setDelayDays('2');
      setImpact(null);
      setAlternatives([]);
      setActivePlanId('');
      setTargetOrderId('PAL-204');
      setVerification(null);
      setConfirmExecuteId('');
      setExecutionAcknowledged(false);
      analyzedDisruptionId.current = '';
      restoredVerificationPlanId.current = '';
      const refreshed = await refetchAll([
        () => queryClient.fetchQuery({
          queryKey: scenarioQueryKey(getGetShopStateQueryKey(), created.scenarioId),
          queryFn: ({ signal }) => getShopState({
            signal,
            headers: scenarioRequestHeaders(created.scenarioId),
          }),
          staleTime: 0,
        }),
        () => queryClient.fetchQuery({
          queryKey: scenarioQueryKey(getGetActionHistoryQueryKey(), created.scenarioId),
          queryFn: ({ signal }) => getActionHistory({
            signal,
            headers: scenarioRequestHeaders(created.scenarioId),
          }),
          staleTime: 0,
        }),
        () => health.refetch({ throwOnError: true }),
      ] as const);
      if (refreshed[2].isError) throw refreshed[2].error;
      if (!refreshed[0]) throw new Error('The API returned no workshop state for the new demo.');
      newDemoRequestId.current = '';
      setNotice(scenarioStored
        ? 'A fresh simulated demo started. The previous run and its audit history were preserved.'
        : 'A fresh simulated demo is active for this tab only because browser storage and URL persistence were unavailable.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start a new demo.';
      setWorkspaceError(createdScenarioId
        ? `The new demo was created and selected, but not every section could be refreshed. ${message}`
        : message);
    } finally {
      newDemoInFlight.current = false;
      setNewDemoPending(false);
    }
  };
  const errorText = workspaceError || (firstError instanceof Error ? firstError.message : firstError ? 'The service could not complete that request.' : '');

  useEffect(() => {
    if (!authSession.checked || (authSession.required && !authSession.authenticated)) return;
    const disruption = state?.disruption;
    if (!disruption) {
      analyzedDisruptionId.current = '';
      setImpact(null);
      return;
    }
    const disruptionKey = `${scenarioId ?? 'northstar-demo'}:${disruption.id}`;
    if (analyzedDisruptionId.current === disruptionKey) return;
    analyzedDisruptionId.current = disruptionKey;
    setImpact(null);
    setImpactPendingScenario(scenarioId);
    void requestImpact(scenarioId).then((result) => {
      if (scenarioIdRef.current === scenarioId) setImpact(result);
    }).catch((error: unknown) => {
      if (scenarioIdRef.current === scenarioId) {
        setWorkspaceError(error instanceof Error ? error.message : 'Impact analysis could not be completed.');
      }
    }).finally(() => {
      if (scenarioIdRef.current === scenarioId) setImpactPendingScenario(null);
    });
  }, [authSession.checked, authSession.required, authSession.authenticated, scenarioId, state?.disruption?.id]);

  useEffect(() => {
    if (!state?.plans.length) return;
    const availablePlans = alternatives.length ? alternatives : state.plans;
    if (availablePlans.some((plan) => plan.id === activePlanId)) return;
    const statusRank: Record<string, number> = { verified: 4, executed: 3, approved: 2, proposed: 1, superseded: 0 };
    const preferred = [...availablePlans].sort((a, b) => (statusRank[b.status] ?? -1) - (statusRank[a.status] ?? -1))[0];
    if (preferred) setActivePlanId(preferred.id);
  }, [state?.plans, alternatives, activePlanId]);

  useEffect(() => {
    if (!authSession.checked || (authSession.required && !authSession.authenticated)) return;
    const verifiedPlan = state?.plans.find((plan) => plan.status === 'verified');
    if (!verifiedPlan || verification?.planId === verifiedPlan.id || restoredVerificationPlanId.current === verifiedPlan.id) return;
    restoredVerificationPlanId.current = verifiedPlan.id;
    verifyMutation.mutate({ planId: verifiedPlan.id }, {
      onSuccess: (result) => setVerification(result),
    });
  }, [authSession.checked, authSession.required, authSession.authenticated, state?.plans, verification?.planId]);

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginPending(true);
    setLoginError('');
    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: loginPassword }),
      });
      if (!response.ok) throw new Error('Sign-in was not accepted. Check the demo access password.');
      const session = await response.json() as { authRequired: boolean; authenticated: boolean; csrfToken: string | null };
      if (!session.authenticated || !session.csrfToken) throw new Error('The server did not establish a secure session.');
      setCsrfToken(session.csrfToken);
      setAuthSession({ required: session.authRequired, authenticated: session.authenticated, csrfToken: session.csrfToken, checked: true, unavailable: false });
      setLoginPassword('');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoginPending(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/session', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: authSession.csrfToken ? { 'x-csrf-token': authSession.csrfToken } : {},
      });
    } finally {
      setCsrfToken(null);
      setAuthSession({ checked: true, required: true, authenticated: false, csrfToken: null, unavailable: false });
      setVerification(null);
    }
  };

  const runSimulation = () => {
    if (!selectedMaterialId) return;
    setNotice('');
    setVerification(null);
    simulateMutation.mutate({ data: { materialId: selectedMaterialId, delayDays: Number(delayDays) } }, {
      onSuccess: (result) => {
        setImpact(result);
        analyzedDisruptionId.current = `${scenarioId ?? 'northstar-demo'}:${result.disruption.id}`;
        setAlternatives([]);
        setActivePlanId('');
        refreshWorkspace();
      },
    });
  };

  const recalculateImpact = async () => {
    setWorkspaceError('');
    setNotice('');
    setImpactPendingScenario(scenarioId);
    try {
      const result = await requestImpact(scenarioId);
      if (scenarioIdRef.current === scenarioId) {
        setImpact(result);
        setNotice('Impact recalculated from the current simulated shop state.');
      }
    } catch (error) {
      if (scenarioIdRef.current === scenarioId) {
        setImpact(null);
        setWorkspaceError(error instanceof Error ? error.message : 'Impact analysis could not be completed.');
      }
    } finally {
      if (scenarioIdRef.current === scenarioId) setImpactPendingScenario(null);
    }
  };

  const proposeRecovery = (orderId: string) => {
    setNotice('');
    proposeMutation.mutate({ data: { targetOrderId: orderId } }, {
      onSuccess: (plans) => {
        setAlternatives(plans);
        setActivePlanId(plans.find((plan) => plan.rationale.startsWith('Recommended by policy'))?.id ?? plans[0]?.id ?? '');
        setConfirmExecuteId('');
        setVerification(null);
        refreshWorkspace();
      },
    });
  };

  const approvePlan = (plan: RecoveryPlan) => approveMutation.mutate({ planId: plan.id }, {
    onSuccess: (updated) => {
      setAlternatives((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`Approval recorded for ${updated.name}. Execution remains a separate step.`);
      refreshWorkspace();
    },
  });

  const executePlan = (plan: RecoveryPlan) => {
    executeMutation.mutate({ planId: plan.id, data: { requestId: plan.id } }, {
      onSuccess: () => {
        setConfirmExecuteId('');
        setExecutionAcknowledged(false);
        setNotice('The approved recovery plan was executed in the simulation. Verify the resulting shop state next.');
        setAlternatives((current) => current.map((item) => {
          if (item.id === plan.id) return { ...item, status: 'executed' };
          return item.status === 'proposed' || item.status === 'approved'
            ? { ...item, status: 'superseded' }
            : item;
        }));
        refreshWorkspace();
      },
    });
  };

  const verifyPlan = (plan: RecoveryPlan) => verifyMutation.mutate({ planId: plan.id }, {
    onSuccess: (result) => {
      setVerification(result);
      if (result.verified) {
        setAlternatives((current) => current.map((item) => item.id === plan.id ? { ...item, status: 'verified' } : item));
        setNotice('Persisted schedule verified against the plan forecast.');
      } else {
        setNotice('');
      }
      refreshWorkspace();
    },
  });

  const startVoiceInput = () => {
    type SpeechRecognitionLike = { lang: string; interimResults: boolean; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void };
    const speechWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Speech = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Speech) {
      setNotice('Voice capture is not available in this browser. Edit the scenario text or use the controls below.');
      return;
    }
    const recognition = new Speech();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setScenarioText(transcript);
    };
    recognition.onend = () => setVoiceListening(false);
    setVoiceListening(true);
    recognition.start();
  };

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const machineById = useMemo(() => new Map(machines.map((machine) => [machine.id, machine])), [machines]);
  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const activeOrderCount = orders.filter((order) => order.status !== 'complete').length;
  const riskOrderCount = orders.filter((order) => order.status === 'at_risk' || order.status === 'late').length;
  const upcomingOrders = [...orders].sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id));
  const closestDeadline = upcomingOrders.find((order) => order.status !== 'complete')?.dueDate;
  const taskHours = tasks.filter((task) => task.status !== 'complete').reduce((total, task) => total + task.durationHours, 0);

  if (shop.isLoading) return <div className="min-h-[100dvh] bg-[hsl(var(--background))] p-5 md:p-8"><Header health={health.data?.status} /><div className="mx-auto mt-8 max-w-[1440px]"><LoadingPanel /></div></div>;

  if (!authSession.checked) return <div className="min-h-[100dvh] bg-[hsl(var(--background))] p-5 md:p-8"><Header health={health.data?.status} /><div className="mx-auto mt-8 max-w-[1440px]"><LoadingPanel /></div></div>;

  if (authSession.unavailable) return <div className="min-h-[100dvh] bg-[hsl(var(--background))]"><Header health={health.data?.status} /><main className="mx-auto max-w-2xl px-5 py-24"><div className="panel p-7"><h1 className="display text-2xl font-semibold">Secure session unavailable</h1><p className="mt-2 text-sm text-muted-foreground">CASCADE could not check demo access. The workshop remains read-only until authentication is available.</p><Button testId="button-retry-session" className="mt-6" onClick={() => window.location.reload()}><RefreshCw size={15} /> Retry connection</Button></div></main></div>;

  if (authSession.required && !authSession.authenticated) return <SignInPanel password={loginPassword} error={loginError} pending={loginPending} onPasswordChange={setLoginPassword} onSubmit={login} />;

  if (shop.isError || !state) return <div className="min-h-[100dvh] bg-[hsl(var(--background))]"><Header health={health.data?.status} /><main className="mx-auto max-w-2xl px-5 py-24">
    <div className="panel p-7"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-700"><AlertTriangle size={20} /></div>
      <h1 className="display text-2xl font-semibold">Workshop state unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{shop.error instanceof Error ? shop.error.message : 'CASCADE could not load the simulated workshop.'}</p>
      <Button testId="button-retry-state" className="mt-6" onClick={() => void shop.refetch()}><RefreshCw size={15} /> Retry connection</Button>
    </div></main></div>;

  const affectedOrderIds = impact?.affectedOrderIds ?? [];
  const affectedTaskIds = impact?.affectedTaskIds ?? [];
  const targetOrders = impact
    ? orders.filter((order) => affectedOrderIds.includes(order.id))
    : state.disruption
      ? []
      : orders;
  const selectedTargetOrderId = targetOrders.some((order) => order.id === targetOrderId)
    ? targetOrderId
    : targetOrders[0]?.id ?? '';
  const headlineTargetOrder = orders.find((order) => order.id === selectedTargetOrderId);
  const constraintTargetOrder = orders.find((order) => order.id === activePlan?.targetOrderId) ?? headlineTargetOrder;
  const localActions = alternatives.length ? alternatives : state.plans;
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-foreground">
    <Header health={health.data?.status} onHistory={() => setShowHistory(true)} onLogout={authSession.required ? logout : undefined} />
    <main className="mx-auto max-w-[1540px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <section className="mb-6 grid gap-5 border-b border-[hsl(var(--border))] pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2"><span className="eyebrow">Northstar Custom Works / Shift A</span><span className="inline-flex items-center gap-1.5 rounded border border-[hsl(var(--border))] px-2 py-1 text-[10px]" data-testid="current-demo-indicator"><span className="eyebrow">Current demo</span><span className="mono">{scenarioId ?? 'northstar-demo'}</span></span><span className="eyebrow">{state.scenarioName}</span><span className="rounded-sm bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-amber-900">{state.simulationLabel || 'Simulated workshop data'}</span></div>
          <h1 className="display text-[28px] font-semibold leading-tight sm:text-[36px]">{headlineTargetOrder ? `Can ${headlineTargetOrder.customer} meet the ${formatWeekday(headlineTargetOrder.dueDate)} deadline without making another customer late?` : 'Can the selected order meet its deadline without making another customer late?'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{activeDisruption ? `A ${activeDisruption.delayDays}-day ${activeDisruption.materialName.toLowerCase()} delay is active in the simulation.` : 'Ready to model the default two-day cabinet-grade plywood delay.'} CASCADE compares deterministic options against the selected hard deadline and all other customer commitments.</p>
        </div>
        <div className="grid gap-3 lg:justify-items-end">
          <div className="flex min-h-10 items-center gap-2 border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${health.data?.status === 'ok' || health.data?.status === 'healthy' ? 'bg-emerald-600' : 'bg-amber-500'}`} /><span>API {health.data?.status ?? 'checking'}</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Button kind="primary" testId="button-refresh-workspace" disabled={anyPending} onClick={() => { void refreshCurrentDemo(); }}><RefreshCw size={14} className={refreshPending ? 'animate-spin' : ''} /> {refreshPending ? 'Refreshing current demo' : 'Refresh current demo'}</Button>
              <p className="mt-1 max-w-56 text-[10px] leading-relaxed text-muted-foreground">Reload this demo’s saved state, recovery plans, verification, and action history. Does not create or reset a scenario.</p>
            </div>
            <div>
              <Button kind="secondary" testId="button-new-demo" disabled={anyPending} onClick={() => setConfirmNewDemo(true)}><RefreshCw size={14} className={newDemoPending ? 'animate-spin' : ''} /> {newDemoPending ? 'Starting new demo' : 'Start new demo'}</Button>
              <p className="mt-1 max-w-56 text-[10px] leading-relaxed text-muted-foreground">Create a separate fresh scenario. Your current demo and its audit history remain available.</p>
            </div>
          </div>
          {confirmNewDemo && <div role="alertdialog" aria-labelledby="confirm-new-demo-title" aria-describedby="confirm-new-demo-description" className="max-w-md rounded-md border border-amber-300 bg-amber-50 p-3 text-left">
            <h2 id="confirm-new-demo-title" className="text-xs font-semibold text-amber-950">Start a separate fresh demo?</h2>
            <p id="confirm-new-demo-description" className="mt-1 text-[11px] leading-relaxed text-amber-900">Your current demo and its action history will be preserved. CASCADE will switch to the new scenario only after it is created.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button kind="quiet" testId="button-cancel-new-demo" onClick={() => setConfirmNewDemo(false)}>Cancel</Button>
              <Button kind="secondary" testId="button-confirm-new-demo" disabled={anyPending} onClick={() => { setConfirmNewDemo(false); void startNewDemo(); }}>Create new demo</Button>
            </div>
          </div>}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 border-y border-[hsl(var(--border))] sm:grid-cols-4" aria-label="Workshop summary">
        <OverviewMetric label="Active orders" value={String(activeOrderCount)} detail={`${orders.length} total commitments`} icon={<Package size={16} />} />
        <OverviewMetric label="At risk / late" value={String(riskOrderCount)} detail="Current persisted order status" icon={<AlertTriangle size={16} />} tone={riskOrderCount ? 'warn' : 'good'} />
        <OverviewMetric label="Nearest due date" value={closestDeadline ? formatDate(closestDeadline) : '—'} detail="Across active customer orders" icon={<Clock3 size={16} />} />
        <OverviewMetric label="Booked work" value={`${taskHours.toFixed(1)} h`} detail={`${tasks.length} production tasks`} icon={<Factory size={16} />} />
      </section>

      <ol className="mb-6 grid grid-cols-2 border border-[hsl(var(--border))] bg-[hsl(var(--card))] sm:grid-cols-4" aria-label="Recovery workflow">
        {[
          { label: 'Disruption', complete: Boolean(state.disruption), current: !state.disruption },
          { label: 'Impact', complete: Boolean(impact), current: Boolean(state.disruption && !impact) },
          { label: 'Decision', complete: state.plans.length > 0, current: Boolean(impact && !state.plans.length) },
          { label: 'Verification', complete: state.plans.some((plan) => plan.status === 'verified'), current: state.plans.some((plan) => plan.status === 'executed') },
        ].map((step, index) => <li key={step.label} className={`flex items-center gap-3 border-[hsl(var(--border))] px-4 py-3 ${index % 2 === 0 ? 'border-r' : ''} ${index > 1 ? 'sm:border-l' : ''} ${index < 2 ? 'sm:border-r' : ''}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${step.complete ? 'bg-emerald-700 text-white' : step.current ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--muted))] text-muted-foreground'}`}>{step.complete ? <Check size={12} /> : `0${index + 1}`}</span>
          <span className={`text-xs font-semibold ${step.current ? 'text-[hsl(var(--primary))]' : 'text-foreground'}`}>{step.label}</span>
          {step.current && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />}
        </li>)}
      </ol>

      {errorText && <div role="alert" data-testid="status-request-error" className="mb-4 flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        <span><strong>Request did not complete.</strong> {errorText}</span><span className="flex items-center gap-2">{workspaceError && <Button kind="secondary" testId="button-retry-workspace-refresh" disabled={anyPending} onClick={() => { void refreshCurrentDemo(); }}><RefreshCw size={14} /> Retry refresh</Button>}<Button kind="quiet" testId="button-dismiss-error" onClick={() => { setWorkspaceError(''); simulateMutation.reset(); proposeMutation.reset(); approveMutation.reset(); executeMutation.reset(); verifyMutation.reset(); }}><X size={15} /> Dismiss</Button></span>
      </div>}
      {notice && <div role="status" data-testid="status-action-notice" className="mb-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900"><span className="flex items-center gap-2"><CheckCircle2 size={16} />{notice}</span><button aria-label="Dismiss message" data-testid="button-dismiss-notice" onClick={() => setNotice('')}><X size={15} /></button></div>}

      <div className="min-w-0 space-y-6">
        <div className="min-w-0 space-y-5">
          <section className="panel overflow-hidden" aria-labelledby="scenario-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5">
              <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded bg-[hsl(var(--primary))] text-white"><AudioLines size={16} /></div><h2 id="scenario-heading" className="text-sm font-semibold">Tell CASCADE what changed</h2></div>
              <span className="eyebrow">01 / Disruption intake</span>
            </div>
            <div className="p-5">
              <label className="sr-only" htmlFor="scenarioPrompt">Disruption prompt</label>
              <textarea id="scenarioPrompt" data-testid="input-scenario-prompt" value={scenarioText} onChange={(event) => setScenarioText(event.target.value)}
                className="block min-h-[86px] w-full max-w-full resize-y rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-[14px] leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Describe a supplier, machine, or material disruption…" />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <label className="grid gap-1"><span className="eyebrow">Material affected</span>
                    <select data-testid="select-disruption-material" value={selectedMaterialId} onChange={(event) => setMaterialId(event.target.value)}
                      className="h-9 min-w-44 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 text-xs outline-none focus:border-primary">
                      {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1"><span className="eyebrow">Delay</span>
                    <select data-testid="select-disruption-delay" value={delayDays} onChange={(event) => setDelayDays(event.target.value)}
                      className="h-9 min-w-24 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 text-xs outline-none focus:border-primary">
                      {[1, 2, 3, 4, 5, 7, 10, 14].map((days) => <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button kind="secondary" testId="button-voice-capture" onClick={startVoiceInput} aria-label="Capture disruption by voice">
                    <Mic size={15} />{voiceListening ? 'Listening…' : 'Speak'}
                  </Button>
                      <Button testId="button-simulate-disruption" onClick={runSimulation} disabled={anyPending || !selectedMaterialId || Boolean(state.disruption)}>
                        {simulateMutation.isPending ? <><RefreshCw size={14} className="animate-spin" /> Simulating</> : state.disruption ? <><CheckCircle2 size={15} /> Scenario active</> : <><Siren size={15} /> Simulate disruption</>}
                  </Button>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><CircleHelp size={13} />The prompt is a scenario note; the material and delay controls drive the simulation. Voice capture only fills the note. No supplier or customer is contacted.</p>
            </div>
          </section>

          <section className="panel" aria-labelledby="impact-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5">
              <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded bg-amber-100 text-amber-800"><Activity size={16} /></div><h2 id="impact-heading" className="text-sm font-semibold">Impact & dependencies</h2></div>
              <div className="flex items-center gap-2"><span className="eyebrow">02 / Shop-floor exposure</span><Button kind="quiet" testId="button-recalculate-impact" onClick={() => { void recalculateImpact(); }} disabled={anyPending}><RefreshCw size={13} className={impactPending ? 'animate-spin' : ''} /> {impactPending ? 'Analyzing' : 'Recalculate'}</Button></div>
            </div>
            {activeDisruption ? <div className="p-5">
              <div className="flex flex-col justify-between gap-3 rounded-md border border-amber-200 bg-amber-50/75 p-4 sm:flex-row sm:items-center">
                <div className="flex gap-3"><div className="mt-0.5 text-amber-800"><Truck size={18} /></div><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{activeDisruption.materialName} shipment delayed</strong><Status tone="warn">+{activeDisruption.delayDays} days</Status></div><p className="mt-1 text-xs text-amber-900/75">{activeDisruption.simulationLabel || 'Simulated supplier disruption'} · Reported {formatTime(activeDisruption.reportedAt)}</p></div></div>
                <div className="flex flex-wrap gap-5 pl-8 sm:pl-0"><Metric label="Orders exposed" value={impact ? String(affectedOrderIds.length) : '—'} /><Metric label="Tasks affected" value={impact ? String(affectedTaskIds.length) : '—'} /></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[hsl(var(--border))] pb-3 text-xs">
                <span className="text-muted-foreground">Inbound arrival</span><span className="mono">{formatDate(activeDisruption.originalArrivalDate)} <ArrowRight size={12} className="mx-1 inline text-amber-700" /> {formatDate(activeDisruption.revisedArrivalDate)}</span>
                <span className="text-muted-foreground">{selectedMaterial?.delayedShipment ?? 0} {selectedMaterial?.unit ?? 'units'} inbound</span>
                {impact && affectedOrderIds.length > 0 && <span className="font-medium text-amber-900">{impact.affectedOrderIds.length} commitments exposed to the stock gap</span>}
                {impact && affectedOrderIds.length === 0 && <span className="font-medium text-emerald-800">No orders currently exposed on the persisted schedule</span>}
              </div>
              {impactPending && !impact ? <div className="my-4 flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-xs text-muted-foreground" role="status" data-testid="status-impact-loading"><RefreshCw size={14} className="animate-spin text-primary" /> Restoring impact analysis from the simulated shop state…</div> :
                workspaceError && !impact ? <div className="my-4 flex items-center justify-between gap-3 rounded border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-900" role="alert" data-testid="status-impact-error"><span>Impact analysis could not be restored. {workspaceError}</span><Button kind="secondary" testId="button-retry-impact" onClick={() => { void recalculateImpact(); }}><RefreshCw size={13} /> Retry</Button></div> :
                <p className="my-4 text-sm leading-relaxed text-muted-foreground" data-testid="text-impact-summary">{impact?.summary || 'A simulated disruption is active. Its affected orders and tasks will appear after analysis completes.'}</p>}
              {impact && affectedOrderIds.length > 0 ? <div className="mb-4 flex flex-wrap gap-2" data-testid="list-affected-orders">
                {affectedOrderIds.map((id) => {
                  const order = orderById.get(id);
                  return <span key={id} data-testid={`chip-affected-order-${id}`} className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-[hsl(var(--card))] px-2.5 py-1.5 text-xs"><span className="mono text-[10px] text-muted-foreground">{id}</span><span className="font-semibold">{order?.customer ?? id}</span><span className="text-muted-foreground">· {order?.product ?? 'Affected order'}</span></span>;
                })}
              </div> : impact ? <div className="mb-4 rounded border border-dashed border-[hsl(var(--border))] px-3 py-3 text-xs text-muted-foreground" data-testid="empty-affected-orders">The simulator returned no affected orders for this disruption.</div> : null}
              {impact && <DependencyGraph impact={impact} />}
            </div> : <EmptyBlock icon={<Layers3 size={19} />} title="No active disruption analysis" detail="Simulate a supplier delay to trace material, task, and order dependencies from the live workshop model." />}
          </section>

          <section className="panel" aria-labelledby="orders-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5">
              <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded bg-stone-200 text-stone-700"><Package size={16} /></div><h2 id="orders-heading" className="text-sm font-semibold">Committed orders</h2><span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[10px]">{orders.length}</span></div><span className="eyebrow">Shared constraints / simulated</span>
            </div>
            {orders.length ? <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead><tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[10px] uppercase tracking-[.08em] text-muted-foreground"><th className="px-5 py-2.5 font-medium">Order / customer</th><th className="px-4 py-2.5 font-medium">Product</th><th className="px-4 py-2.5 font-medium">Qty</th><th className="px-4 py-2.5 font-medium">Due</th><th className="px-4 py-2.5 font-medium">Priority</th><th className="px-5 py-2.5 font-medium">Schedule</th></tr></thead>
                <tbody>{upcomingOrders.map((order) => <tr key={order.id} data-testid={`row-order-${order.id}`} className={`border-b border-[hsl(var(--border))] last:border-0 ${affectedOrderIds.includes(order.id) ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-5 py-3"><div className="mono text-[10px] text-muted-foreground">{order.id}</div><div className="mt-0.5 text-xs font-semibold">{order.customer}</div></td>
                  <td className="px-4 py-3 text-xs">{order.product}</td><td className="px-4 py-3 mono text-xs">{order.quantity}</td><td className="px-4 py-3 mono text-xs">{formatDate(order.dueDate)}</td>
                  <td className="px-4 py-3"><Status tone={order.priority === 'urgent' ? 'bad' : order.priority === 'high' ? 'warn' : 'neutral'}>{order.priority}</Status></td>
                  <td className="px-5 py-3"><Status tone={order.status === 'on_track' || order.status === 'complete' ? 'good' : order.status === 'late' ? 'bad' : 'warn'}>{order.status.replace('_', ' ')}</Status></td>
                </tr>)}</tbody>
              </table>
            </div> : <EmptyBlock icon={<Package size={19} />} title="No simulated orders" detail="The shop-state service returned no committed orders." />}
          </section>

          <section className="panel" aria-labelledby="materials-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded bg-teal-100 text-teal-800"><Package size={16} /></div><h2 id="materials-heading" className="text-sm font-semibold">Material & supplier position</h2></div><span className="eyebrow">Availability / inbound / alternate</span></div>
            {materials.length ? <div className="grid gap-px bg-[hsl(var(--border))] sm:grid-cols-2">
              {materials.map((material) => <article key={material.id} data-testid={`card-material-${material.id}`} className="bg-[hsl(var(--card))] p-4">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{material.name}</h3><p className="mt-1 text-xs text-muted-foreground">Primary: {material.supplier}</p></div><span className="mono text-xs text-muted-foreground">{material.available} {material.unit}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[hsl(var(--border))] pt-3 text-[11px]">
                  <div><span className="eyebrow">Inbound</span><div className="mt-1 text-xs">{material.delayedShipment} {material.unit} · {formatDate(material.scheduledArrival)}</div></div>
                  <div><span className="eyebrow">Alternate supplier</span><div className="mt-1 flex items-center gap-1.5 text-xs">{material.alternateAvailable ? <Status tone="good">Available</Status> : <Status tone="bad">Unavailable</Status>}</div><div className="mt-1 text-[10px] text-muted-foreground">{material.alternateSupplier}</div></div>
                </div>
                <div className="mt-2 flex items-center justify-between rounded bg-[hsl(var(--background))] px-2.5 py-2 text-[11px]"><span className="text-muted-foreground">Expedite estimate</span><span className="mono font-medium">{formatMoney(material.expediteCost)}</span></div>
              </article>)}
            </div> : <EmptyBlock icon={<Package size={19} />} title="No material records" detail="Material availability and supplier options have not been provided." />}
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="panel overflow-hidden" aria-labelledby="recovery-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5">
              <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded bg-[hsl(var(--primary))] text-white"><WandSparkles size={15} /></div><div><h2 id="recovery-heading" className="text-sm font-semibold">Compare recovery plans</h2><p className="mt-0.5 text-[11px] text-muted-foreground">04 / Decide · deterministic schedule and cost</p></div></div>
              <Status tone={state.plans.some((plan) => plan.status === 'verified') ? 'good' : state.plans.some((plan) => plan.status === 'executed') ? 'warn' : 'neutral'}>{state.plans.find((plan) => plan.status === 'verified') ? 'verified' : state.plans.find((plan) => plan.status === 'executed') ? 'executed' : state.plans.some((plan) => plan.status === 'approved') ? 'approved' : 'proposed'}</Status>
            </div>
            {impact || state.disruption ? <div className="p-5">
              <label htmlFor="target-order" className="eyebrow">Protect a delivery commitment</label>
              <div className="mt-1.5 flex gap-2">
                <select id="target-order" data-testid="select-target-order" value={selectedTargetOrderId}
                  onChange={(event) => setTargetOrderId(event.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 text-xs outline-none focus:border-primary">
                  {targetOrders.length ? targetOrders.map((order) => <option key={order.id} value={order.id}>{order.customer} · {order.product} · due {formatDate(order.dueDate)}</option>) : <option value="">Recalculate impact to list exposed orders</option>}
                </select>
                <Button testId="button-propose-recovery" disabled={anyPending || targetOrders.length === 0} onClick={() => {
                  if (selectedTargetOrderId) proposeRecovery(selectedTargetOrderId);
                }}>{proposeMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={15} />} Compare</Button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{targetOrders.length ? 'Compare deterministic alternatives against shared inventory, machine hours, and task dependencies. Nothing executes automatically.' : 'Recalculate impact to review exposed orders before comparing recovery options.'}</p>
            </div> : <div className="border-b border-[hsl(var(--border))]"><EmptyBlock icon={<WandSparkles size={18} />} title="Waiting for a disruption" detail="Run a disruption simulation before comparing recovery alternatives." /></div>}

            {proposeMutation.isPending && <div className="space-y-3 p-5"><div className="skeleton h-20" /><div className="skeleton h-20" /></div>}
            {localActions.length > 0 && <div className="border-t border-[hsl(var(--border))] px-5 pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="eyebrow">{alternatives.length ? 'Computed alternatives' : 'Persisted alternatives'}</span><span className="mono text-[10px] text-muted-foreground">{localActions.length} plans · recommendation marked by policy</span></div>
              <div className="grid gap-3 md:grid-cols-3">
                {localActions.map((plan, index) => <RecoveryCard key={plan.id} plan={plan} index={index} active={activePlanId === plan.id} onSelect={() => setActivePlanId(plan.id)} />)}
              </div>
              <p className="mt-4 border-l-2 border-[hsl(var(--accent))] bg-[hsl(var(--background))] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Constraint policy:</strong> {constraintTargetOrder ? `${constraintTargetOrder.customer}’s ${formatWeekday(constraintTargetOrder.dueDate)} deadline` : 'The selected order’s deadline'} is a hard requirement. Other customer deadlines remain visible preferences and late-order penalties; an infeasible plan never counts as a recommendation.</p>
            </div>}

            {activePlan && <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5" data-testid={`panel-plan-detail-${activePlan.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="eyebrow">Selected strategy / {activePlan.feasible ? 'feasible' : 'infeasible'}</span><h3 className="mt-1 text-sm font-semibold">{activePlan.name}</h3></div><Status tone={!activePlan.feasible ? 'bad' : activePlan.status === 'verified' ? 'good' : activePlan.status === 'executed' || activePlan.status === 'approved' ? 'warn' : 'neutral'}>{activePlan.status}</Status></div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{activePlan.rationale}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniMetric label="Plan cost" value={formatMoney(activePlan.cost)} />
                <MiniMetric label="On time" value={String(activePlan.onTimeOrders)} />
                <MiniMetric label="Late" value={String(activePlan.lateOrders)} danger={activePlan.lateOrders > 0} />
              </div>
              <div className="mt-4"><span className="eyebrow">Trade-offs & risks</span>{activePlan.risks.length ? <ul className="mt-2 space-y-1.5">{activePlan.risks.map((risk, index) => <li key={`${index}-${risk}`} className="flex gap-2 text-xs leading-relaxed text-muted-foreground"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-700" />{risk}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No risks returned by the simulator.</p>}</div>
              <div className="mt-4"><span className="eyebrow">Schedule and cost actions</span>{activePlan.actions.length ? <ol className="mt-2 grid gap-2 md:grid-cols-2">{activePlan.actions.map((action, index) => <li key={`${index}-${action}`} className="flex gap-2 border-l border-[hsl(var(--border))] py-1 pl-3 text-xs leading-relaxed"><span className="mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>{action}</li>)}</ol> : <p className="mt-2 text-xs text-muted-foreground">No action details returned.</p>}</div>

              {(activePlan.status === 'executed' || activePlan.status === 'verified') && <section className="mt-5 border-t border-[hsl(var(--border))] pt-4" aria-labelledby="executed-state-heading" data-testid="panel-executed-schedule">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="eyebrow">Persisted result</span><h4 id="executed-state-heading" className="mt-1 text-xs font-semibold">Schedule and inventory after execution</h4></div><Status tone={activePlan.status === 'verified' ? 'good' : 'warn'}>{activePlan.status === 'verified' ? 'verified state' : 'executed state'}</Status></div>
                <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,.34fr)]">
                  <div className="min-w-0">
                    <p className="eyebrow">Changed customer schedules</p>
                    {selectedPlanChanges.length ? <ul className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">{selectedPlanChanges.map((task) => <li key={task.id} className="flex min-w-0 items-start justify-between gap-3 border-b border-[hsl(var(--border))] pb-2 text-xs"><span className="min-w-0"><span className="block truncate font-medium">{task.name}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{orderById.get(task.orderId)?.customer ?? task.orderId}</span></span><span className="mono shrink-0">{formatDate(task.scheduledDate)}</span></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">This plan retained the existing task dates.</p>}
                  </div>
                  {recoveredMaterial && <div className="border-l border-[hsl(var(--border))] pl-4"><p className="eyebrow">{recoveredMaterial.name}</p><p className="mono mt-2 text-sm font-medium">{recoveredMaterial.available} {recoveredMaterial.unit} available</p><p className="mt-1 text-[10px] text-muted-foreground">Inbound {recoveredMaterial.delayedShipment} · {formatDate(recoveredMaterial.scheduledArrival)}</p></div>}
                </div>
              </section>}

              {activePlan.feasible && activePlan.status === 'proposed' && <Button testId={`button-approve-plan-${activePlan.id}`} className="mt-5 w-full" disabled={anyPending} onClick={() => approvePlan(activePlan)}>
                {approveMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Check size={15} />} Explicitly approve plan
              </Button>}
              {!activePlan.feasible && <div className="mt-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">This alternative is not feasible in the current simulated schedule.</div>}
              {activePlan.status === 'approved' && <div className="mt-4">
                {confirmExecuteId !== activePlan.id ? <Button testId={`button-start-execution-${activePlan.id}`} kind="danger" className="w-full" disabled={anyPending} onClick={() => { setConfirmExecuteId(activePlan.id); setExecutionAcknowledged(false); }}><ArrowDownRight size={15} /> Review execution</Button> :
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3" data-testid={`confirm-execution-${activePlan.id}`}>
                    <div className="flex gap-2 text-xs font-semibold text-rose-900"><AlertTriangle size={15} className="shrink-0" />Execute approved actions in the simulator?</div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-rose-900/80">This will apply the plan to simulated workshop state. It does not contact a supplier or customer.</p>
                    <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-rose-950"><input data-testid="checkbox-confirm-execution" type="checkbox" checked={executionAcknowledged} onChange={(event) => setExecutionAcknowledged(event.target.checked)} className="mt-0.5 accent-rose-800" />I understand this action changes only the fictional simulation.</label>
                    <div className="mt-3 flex gap-2"><Button testId={`button-confirm-execute-${activePlan.id}`} kind="danger" className="flex-1" disabled={!executionAcknowledged || anyPending} onClick={() => executePlan(activePlan)}>{executeMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />} Confirm execution</Button><Button kind="secondary" testId={`button-cancel-execute-${activePlan.id}`} onClick={() => setConfirmExecuteId('')}>Cancel</Button></div>
                  </div>}
              </div>}
              {activePlan.status === 'executed' && <Button testId={`button-verify-plan-${activePlan.id}`} className="mt-5 w-full" disabled={anyPending} onClick={() => verifyPlan(activePlan)}>
                {verifyMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={15} />} Verify simulated outcome
              </Button>}
              {activePlan.status === 'verified' && !verification && verifyMutation.isPending && <div className="mt-4 flex items-center gap-2 border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-xs text-muted-foreground" role="status"><RefreshCw size={14} className="animate-spin" />Restoring independent verification from persisted state…</div>}
            </div>}
            {verification && <VerificationPanel result={verification} />}
          </section>

          <section className="panel" aria-labelledby="capacity-heading">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-3.5"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded bg-sky-100 text-sky-800"><Factory size={15} /></div><h2 id="capacity-heading" className="text-sm font-semibold">Machine capacity</h2></div><span className="eyebrow">Five-day load</span></div>
            {machines.length ? <div className="divide-y divide-[hsl(var(--border))]">{machines.map((machine) => {
              const assigned = tasks.filter((task) => task.machineId === machine.id && task.status !== 'complete').reduce((total, task) => total + task.durationHours, 0);
              const capacityHours = machine.hoursPerDay * 5;
              const pct = Math.min(100, capacityHours ? assigned / capacityHours * 100 : 0);
              return <div key={machine.id} data-testid={`row-machine-${machine.id}`} className="px-5 py-3"><div className="flex justify-between gap-2"><span className="text-xs font-semibold">{machine.name}</span><span className="mono text-[10px] text-muted-foreground">{assigned.toFixed(1)} h queued <span className="text-border">/</span> {capacityHours} h total</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className={`h-full rounded-full ${pct >= 85 ? 'bg-amber-600' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div></div>;
            })}</div> : <EmptyBlock icon={<Factory size={18} />} title="No machine records" detail="Capacity information is not available." />}
            <div className="border-t border-[hsl(var(--border))] px-5 py-3 text-[10px] leading-relaxed text-muted-foreground">Capacity bars compare all non-complete task hours with five-day machine capacity.</div>
          </section>

          <section className="panel" aria-labelledby="task-heading">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-3.5"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded bg-stone-200 text-stone-700"><HardHat size={15} /></div><h2 id="task-heading" className="text-sm font-semibold">Production sequence</h2></div><span className="mono text-[10px] text-muted-foreground">{tasks.length} tasks</span></div>
            {tasks.length ? <div className="max-h-[340px] divide-y divide-[hsl(var(--border))] overflow-y-auto scrollbar-thin">{tasks.map((task) => <div key={task.id} data-testid={`row-task-${task.id}`} className={`px-5 py-3 ${affectedTaskIds.includes(task.id) ? 'bg-amber-50/60' : ''}`}>
              <div className="flex items-start justify-between gap-2"><div><div className="text-xs font-medium">{task.name}</div><div className="mt-1 text-[10px] text-muted-foreground">{orderById.get(task.orderId)?.customer ?? task.orderId} <span className="mx-1">·</span>{machineById.get(task.machineId)?.name ?? task.machineId}</div></div><Status tone={task.status === 'complete' ? 'good' : task.status === 'scheduled' ? 'warn' : 'neutral'}>{task.status}</Status></div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground"><span>{formatDate(task.scheduledDate)}</span><span>{task.durationHours} h</span><span>{task.materialQuantity} {materials.find((material) => material.id === task.materialId)?.unit ?? 'units'}</span>{task.dependsOn.length > 0 && <span>Depends on {task.dependsOn.map((id) => taskById.get(id)?.name ?? id).join(', ')}</span>}</div>
            </div>)}</div> : <EmptyBlock icon={<HardHat size={18} />} title="No production tasks" detail="Task sequence data has not been returned by the simulator." />}
          </section>
        </aside>
      </div>

      <footer className="mt-7 flex flex-col gap-2 border-t border-[hsl(var(--border))] pt-4 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5"><ShieldCheck size={13} />All people, orders, suppliers, and events shown are fictional simulated data.</span>
        <button data-testid="button-open-history-footer" className="inline-flex items-center gap-1.5 text-primary hover:underline" onClick={() => setShowHistory(true)}><FileClock size={13} /> Auditable action history <ChevronRight size={13} /></button>
      </footer>
    </main>
    {showHistory && <HistoryDrawer
      events={events}
      loading={history.isLoading || history.isFetching || Boolean(visibleHistoryRefreshStatus?.pending)}
      error={visibleHistoryRefreshStatus?.error || (history.isError ? 'Could not load action history. Check the connection and try again.' : '')}
      successMessage={visibleHistoryRefreshStatus?.message ?? ''}
      onClose={() => setShowHistory(false)}
      onRefresh={() => { void refreshCurrentHistory(); }}
    />}
    {anyPending && <div className="pointer-events-none fixed bottom-4 right-4 z-30 hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs shadow-md sm:flex sm:items-center sm:gap-2"><RefreshCw size={13} className="animate-spin text-primary" />Updating simulated shift…</div>}
  </div>;
}

function Header({ health, onHistory, onLogout }: { health?: string; onHistory?: () => void; onLogout?: () => void }) {
  return <header className="border-b border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
    <div className="mx-auto flex h-[58px] max-w-[1540px] items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3"><div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><Command size={18} strokeWidth={2.5} /><span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--sidebar))] bg-[hsl(var(--accent))]" /></div>
        <div><div className="display text-[17px] font-bold leading-none tracking-[-.04em]">CASCADE</div><div className="mt-1 font-mono text-[8px] uppercase tracking-[.16em] opacity-65">Shopfloor recovery</div></div>
        <span className="ml-2 hidden h-5 items-center rounded border border-white/15 px-2 font-mono text-[9px] uppercase tracking-wide text-white/60 sm:flex">SIMULATOR</span>
      </div>
      <div className="flex items-center gap-3"><div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-white/65 sm:flex"><Radio size={13} className={health === 'ok' || health === 'healthy' ? 'text-emerald-300' : 'text-amber-300'} />Service {health ?? 'checking'}</div>
        {onHistory && <button onClick={onHistory} data-testid="button-open-history-header" className="flex min-h-9 items-center gap-2 rounded border border-white/20 px-3 text-xs font-medium hover:bg-white/10"><FileClock size={14} /> History</button>}
        {onLogout && <button onClick={onLogout} data-testid="button-demo-logout" className="flex min-h-9 items-center gap-2 rounded border border-white/20 px-3 text-xs font-medium hover:bg-white/10"><LogOut size={14} /> Sign out</button>}
        <div className="hidden items-center gap-1.5 text-[10px] text-white/50 sm:flex"><span className="mono">SHIFT A</span><span className="text-white/25">·</span><span className="mono">DEMO</span></div>
      </div>
    </div>
  </header>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="eyebrow">{label}</div><div className="display mt-0.5 text-xl font-semibold tracking-tight" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div></div>;
}

function OverviewMetric({ label, value, detail, icon, tone = 'neutral' }: {
  label: string; value: string; detail: string; icon: ReactNode; tone?: 'good' | 'warn' | 'neutral';
}) {
  const iconTone = tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-[hsl(var(--primary))]';
  return <div className="min-w-0 border-[hsl(var(--border))] px-3 py-4 sm:border-r sm:px-5 last:border-0">
    <div className="flex items-center gap-2"><span className={iconTone}>{icon}</span><span className="eyebrow">{label}</span></div>
    <div className="display mt-2 truncate text-2xl font-semibold" data-testid={`overview-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div>
    <p className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</p>
  </div>;
}

function MiniMetric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-2"><div className="eyebrow">{label}</div><div className={`mono mt-1 text-sm font-medium ${danger ? 'text-rose-700' : ''}`} data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div></div>;
}

function EmptyBlock({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="flex items-start gap-3 px-5 py-6"><div className="mt-0.5 text-muted-foreground">{icon}</div><div><h3 className="text-xs font-semibold">{title}</h3><p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{detail}</p></div></div>;
}

function DependencyGraph({ impact }: { impact: ImpactAnalysis }) {
  const nodes = impact.graphNodes;
  const edges = impact.graphEdges;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const visibleEdges = edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  return <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3" data-testid="graph-impact-dependencies">
    <div className="mb-2 flex items-center justify-between"><span className="eyebrow">Dependency path</span><span className="mono text-[9px] text-muted-foreground">{nodes.length} nodes · {visibleEdges.length} links</span></div>
    {nodes.length ? <div className="space-y-2">
      {(['material', 'task', 'order'] as const).map((kind) => {
        const group = nodes.filter((node) => node.kind === kind);
        if (!group.length) return null;
        return <div key={kind} className="flex flex-wrap items-center gap-1.5"><span className="w-[54px] text-[9px] uppercase tracking-wider text-muted-foreground">{kind}s</span>
          {group.map((node, index) => <div key={node.id} className="flex items-center gap-1.5">
            {index > 0 && <ArrowRight size={11} className="text-[hsl(var(--border))]" />}
            <span data-testid={`node-impact-${node.id}`} className={`rounded border px-2 py-1 text-[10px] ${node.status.toLowerCase().includes('affected') || node.status.toLowerCase().includes('delay') ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}>
              <span className="font-medium">{node.label}</span><span className="ml-1.5 opacity-60">{node.status}</span>
            </span>
          </div>)}
        </div>;
      })}
      {visibleEdges.length > 0 && <details data-testid="button-toggle-dependency-links" className="mt-2 border-t border-[hsl(var(--border))] pt-2">
        <summary className="cursor-pointer text-[10px] text-muted-foreground">Show dependency links</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">{visibleEdges.map((edge, index) => {
          const from = nodes.find((node) => node.id === edge.from);
          const to = nodes.find((node) => node.id === edge.to);
          return <li key={`${edge.from}-${edge.to}-${index}`} className="mono flex items-center gap-1 text-[9px] text-muted-foreground"><span>{from?.label}</span><ArrowRight size={10} /><span>{to?.label}</span></li>;
        })}</ul>
      </details>}
    </div> : <p className="text-xs text-muted-foreground">The impact response contained no dependency graph nodes.</p>}
  </div>;
}

function RecoveryCard({ plan, index, active, onSelect }: {
  plan: RecoveryPlan; index: number; active: boolean; onSelect: () => void;
}) {
  const recommended = plan.rationale.startsWith('Recommended by policy');
  const tone = !plan.feasible ? 'bad' : plan.status === 'verified' ? 'good' : plan.status === 'approved' || plan.status === 'executed' ? 'warn' : 'neutral';
  return <button type="button" data-testid={`card-recovery-plan-${plan.id}`} aria-pressed={active} onClick={onSelect}
    className={`flex min-h-[220px] w-full flex-col border p-4 text-left transition-colors ${active ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/[.045] shadow-[inset_3px_0_0_hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--background))]'}`}>
    <span className="flex w-full items-center justify-between gap-2"><span className="eyebrow">Option 0{index + 1}</span><Status tone={tone}>{plan.feasible ? plan.status : 'not feasible'}</Status></span>
    {recommended && <span className="mt-3 inline-flex w-fit items-center gap-1.5 font-mono text-[9px] font-medium uppercase text-emerald-800"><CheckCircle2 size={12} />Policy recommendation</span>}
    <h3 className="mt-3 text-sm font-semibold leading-snug">{plan.name}</h3>
    <p className="mt-1 min-h-8 text-[11px] leading-relaxed text-muted-foreground">{plan.strategy}</p>
    <div className="mt-4 grid w-full grid-cols-3 border-y border-[hsl(var(--border))] py-2.5">
      <div><div className="eyebrow">Cost</div><div className="mono mt-1 text-sm font-medium">{formatMoney(plan.cost)}</div></div>
      <div><div className="eyebrow">On time</div><div className="mono mt-1 text-sm font-medium text-emerald-800">{plan.onTimeOrders}</div></div>
      <div><div className="eyebrow">Late</div><div className={`mono mt-1 text-sm font-medium ${plan.lateOrders ? 'text-rose-700' : ''}`}>{plan.lateOrders}</div></div>
    </div>
    <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[10px] text-muted-foreground">
      <span>{plan.affectedOrders.length} orders re-sequenced</span>
      <span className="inline-flex items-center gap-1 font-semibold text-primary">{active ? 'Selected' : 'Review'} <ChevronRight size={12} /></span>
    </div>
    {plan.risks.length > 0 && <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-amber-900"><AlertTriangle size={12} className="mr-1 inline" />{plan.risks[0]}</p>}
  </button>;
}

function VerificationPanel({ result }: { result: VerificationResult }) {
  return <div className={`border-t p-5 ${result.verified && result.stateMatches ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`} data-testid="panel-verification-result" role="status">
    <div className="flex items-center gap-2"><ShieldCheck size={17} className={result.verified && result.stateMatches ? 'text-emerald-800' : 'text-amber-800'} /><h3 className="text-sm font-semibold">Verification result</h3><Status tone={result.verified && result.stateMatches ? 'good' : 'warn'}>{result.verified ? 'verified' : 'review'}</Status></div>
    <p className="mt-2 text-xs leading-relaxed">{result.message}</p><div className="mt-3 flex gap-5"><Metric label="Verified on time" value={String(result.onTimeOrders)} /><Metric label="Verified late" value={String(result.lateOrders)} /><Metric label="State match" value={result.stateMatches ? 'Yes' : 'No'} /></div>
  </div>;
}

function HistoryDrawer({ events, loading, error, successMessage, onClose, onRefresh }: {
  events: ActionEvent[]; loading: boolean; error: string; successMessage: string; onClose: () => void; onRefresh: () => void;
}) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="history-title" className="flex h-full w-full max-w-[480px] flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
      <div className="flex items-start justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><div className="eyebrow">Audit record · simulated</div><h2 id="history-title" className="display mt-1 text-xl font-semibold">Action history</h2><p className="mt-1 text-xs text-muted-foreground">Every simulator action, approval, and outcome in sequence.</p></div><button data-testid="button-close-history" aria-label="Close history" onClick={onClose} className="rounded p-2 hover:bg-[hsl(var(--muted))]"><X size={18} /></button></div>
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-3"><span className="mono text-[10px] text-muted-foreground">{events.length} events</span><button type="button" data-testid="button-refresh-history" aria-busy={loading} disabled={loading} onClick={onRefresh} className="inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50">{loading ? <><RefreshCw size={13} className="animate-spin" /> Refreshing…</> : <><RefreshCw size={13} /> Refresh history</>}</button></div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
        {loading && <p role="status" aria-live="polite" className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw size={13} className="animate-spin text-primary" />Refreshing this demo’s saved action history…</p>}
        {!loading && successMessage && <p role="status" aria-live="polite" className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{successMessage}</p>}
        {error && <div role="alert" className="mb-3 rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"><p>{error}</p><Button kind="secondary" testId="button-retry-history" className="mt-3" disabled={loading} onClick={onRefresh}><RefreshCw size={13} /> Try again</Button></div>}
        {loading ? <div className="space-y-3"><div className="skeleton h-16" /><div className="skeleton h-16" /><div className="skeleton h-16" /></div> :
          events.length ? <ol className="relative ml-2 border-l border-[hsl(var(--border))] pl-5">{events.map((event) => <li key={event.id} data-testid={`event-history-${event.id}`} className="relative pb-5 last:pb-0"><span className="absolute -left-[25px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-[hsl(var(--card))] bg-primary" />
            <div className="flex items-start justify-between gap-2"><div><div className="text-xs font-semibold">{event.action}</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{event.description}</p></div><Status tone={event.status.toLowerCase().includes('success') || event.status.toLowerCase().includes('complete') ? 'good' : event.status.toLowerCase().includes('fail') ? 'bad' : 'neutral'}>{event.status}</Status></div>
            <div className="mt-2 flex items-center gap-2 font-mono text-[9px] text-muted-foreground"><Clock3 size={11} />{formatTime(event.timestamp)}{event.planId && <><span>·</span><span>Plan {event.planId}</span></>}</div>
          </li>)}</ol> :
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-muted-foreground"><FileClock size={19} /></div><h3 className="text-sm font-semibold">No actions recorded yet</h3><p className="mt-1 max-w-[250px] text-xs leading-relaxed text-muted-foreground">Simulated disruptions, approvals, execution, and verification will appear here.</p></div>}
      </div>
      <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-5 py-3 text-[10px] text-muted-foreground">Fictional simulation record. No external contacts are made.</div>
    </aside>
  </div>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}
function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(`${value.length <= 10 ? `${value}T12:00:00` : value}`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}
function formatWeekday(value: string) {
  if (!value) return 'due-date';
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? 'due-date'
    : new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date);
}
function formatTime(value: string) {
  if (!value) return 'unknown time';
  return formatActionTimestamp(value);
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><Router /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
