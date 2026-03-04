"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GlassCard } from "@/components/glass/glass-card";
import {
  Cloud,
  Save,
  RefreshCw,
  Loader2,
  Check,
  X,
  AlertCircle,
  Shield,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Server,
  Layers,
} from "lucide-react";
import {
  azureConfigSchema,
  type AzureConfigFormData,
} from "@/validators/cost";
import { formatBRL, formatDateBR } from "@/lib/formatters";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AzureValidation {
  valid: boolean;
  error?: string;
}

interface AzureConfigData {
  id: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SyncLogEntry {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  periodStart: string;
  periodEnd: string;
  recordsFound: number;
  recordsSynced: number;
  errors: string | null;
  configId: string;
  createdAt: string;
  config?: {
    id: string;
    subscriptionId: string;
    lastSyncAt: string | null;
  };
}

interface AzureDashboardData {
  totalAzure: number;
  variationVsPrev: number;
  serviceCount: number;
  resourceGroupCount: number;
  byService: { name: string; total: number; count: number }[];
  byResourceGroup: { name: string; total: number; count: number }[];
  byMeterCategory: { name: string; total: number; count: number }[];
  monthlyTrend: { month: string; total: number }[];
  topResources: {
    id: string;
    description: string;
    amount: number;
    date: string;
    serviceName: string | null;
    resourceGroup: string | null;
  }[];
}

const OKLCH_COLORS = [
  "oklch(0.65 0.25 290)",
  "oklch(0.65 0.2 250)",
  "oklch(0.7 0.2 195)",
  "oklch(0.65 0.25 330)",
  "oklch(0.75 0.15 80)",
  "oklch(0.65 0.25 25)",
  "oklch(0.7 0.2 145)",
  "oklch(0.6 0.2 310)",
  "oklch(0.7 0.15 220)",
  "oklch(0.65 0.2 60)",
];

const tooltipStyle = {
  background: "oklch(0.17 0.02 260 / 0.9)",
  border: "1px solid oklch(0.4 0.02 260 / 0.3)",
  borderRadius: "0.75rem",
  color: "oklch(0.95 0.01 260)",
  fontSize: "0.8rem",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AzurePage() {
  const [config, setConfig] = useState<AzureConfigData | null>(null);
  const [validation, setValidation] = useState<AzureValidation | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncLogEntry[]>([]);
  const [dashboard, setDashboard] = useState<AzureDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors },
  } = useForm<AzureConfigFormData>({
    resolver: zodResolver(azureConfigSchema),
  });

  // -------------------------------------------------------------------------
  // Fetch config & sync history
  // -------------------------------------------------------------------------
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/azure/config");
      const data = await res.json();
      if (data.success && data.data) {
        setConfig(data.data);
        if (data.validation) setValidation(data.validation);
        reset({
          tenantId: data.data.tenantId,
          clientId: data.data.clientId,
          clientSecret: "", // Don't prefill masked secret
          subscriptionId: data.data.subscriptionId,
        });
      }
    } catch {
      // silent
    }
  }, [reset]);

  const fetchSyncHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/azure/sync");
      const data = await res.json();
      if (data.success) setSyncHistory(data.data);
    } catch {
      // silent
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/azure/dashboard");
      const data = await res.json();
      if (data.success) setDashboard(data.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchSyncHistory(), fetchDashboard()]).finally(
      () => setLoading(false)
    );
  }, [fetchConfig, fetchSyncHistory, fetchDashboard]);

  // -------------------------------------------------------------------------
  // Save config
  // -------------------------------------------------------------------------
  const onSubmit = async (formData: AzureConfigFormData) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/azure/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Erro ao salvar configuração");
        return;
      }

      setConfig(data.data);
      if (data.validation) {
        setValidation(data.validation);
        if (data.validation.valid) {
          setSuccess("Configuração salva e credenciais validadas com sucesso!");
        } else {
          setSuccess("Configuração salva.");
          setError(`Validação Azure: ${data.validation.error}`);
        }
      } else {
        setSuccess("Configuração salva com sucesso!");
      }
    } catch {
      setError("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Trigger sync
  // -------------------------------------------------------------------------
  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/azure/sync", {
        method: "POST",
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Erro ao sincronizar");
        return;
      }

      setSuccess(
        `Sincronização concluída! ${data.data.recordsSynced} registros sincronizados.`
      );
      fetchSyncHistory();
      fetchConfig();
      fetchDashboard();
    } catch {
      setError("Erro ao sincronizar com Azure");
    } finally {
      setSyncing(false);
    }
  };

  // -------------------------------------------------------------------------
  // Status indicator helper
  // -------------------------------------------------------------------------
  const statusIndicator = (status: SyncLogEntry["status"]) => {
    const dotColors: Record<string, string> = {
      RUNNING: "bg-warning",
      SUCCESS: "bg-success",
      FAILED: "bg-danger",
    };
    const labels: Record<string, string> = {
      RUNNING: "Executando",
      SUCCESS: "Sucesso",
      FAILED: "Falhou",
    };
    return (
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${dotColors[status]}`} />
        <span className="text-sm text-text-primary">{labels[status]}</span>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Connection status
  // -------------------------------------------------------------------------
  const connectionStatus = () => {
    if (!config) {
      return (
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-text-muted" />
          <span className="text-sm text-text-muted">Não configurado</span>
        </div>
      );
    }

    const lastSync = syncHistory[0];
    if (!lastSync) {
      return (
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-warning" />
          <span className="text-sm text-warning">
            Configurado - Nunca sincronizado
          </span>
        </div>
      );
    }

    if (lastSync.status === "SUCCESS") {
      return (
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-success" />
          <span className="text-sm text-success">Conectado</span>
        </div>
      );
    }

    if (lastSync.status === "FAILED") {
      return (
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-danger" />
          <span className="text-sm text-danger">Erro na conexão</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-warning" />
        <span className="text-sm text-warning">Sincronizando...</span>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Azure Cost Management
          </h1>
          <p className="text-sm text-text-secondary">
            Configure e sincronize custos do Microsoft Azure
          </p>
        </div>
        {connectionStatus()}
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-danger" />
          <span className="text-sm text-danger">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-danger hover:text-danger/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3">
          <Check className="h-4 w-4 text-success" />
          <span className="text-sm text-success">{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto text-success hover:text-success/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Config Form */}
        <div className="lg:col-span-2">
          <GlassCard variant="strong">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-lg bg-accent-blue/15 p-2">
                <Shield className="h-5 w-5 text-accent-blue" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Credenciais Azure
                </h2>
                <p className="text-xs text-text-muted">
                  Configure as credenciais do Azure Active Directory
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Tenant ID */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Tenant ID (Directory ID)
                  </label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    {...register("tenantId")}
                    className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                  />
                  {formErrors.tenantId && (
                    <p className="mt-1 text-xs text-danger">
                      {formErrors.tenantId.message}
                    </p>
                  )}
                </div>

                {/* Client ID */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Client ID (Application ID)
                  </label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    {...register("clientId")}
                    className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                  />
                  {formErrors.clientId && (
                    <p className="mt-1 text-xs text-danger">
                      {formErrors.clientId.message}
                    </p>
                  )}
                </div>

                {/* Client Secret */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    placeholder={
                      config ? "Digite para alterar" : "Seu client secret"
                    }
                    {...register("clientSecret")}
                    className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                  />
                  {formErrors.clientSecret && (
                    <p className="mt-1 text-xs text-danger">
                      {formErrors.clientSecret.message}
                    </p>
                  )}
                  {config && (
                    <p className="mt-1 text-xs text-text-muted">
                      Atual: {config.clientSecret}
                    </p>
                  )}
                </div>

                {/* Subscription ID */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Subscription ID
                  </label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    {...register("subscriptionId")}
                    className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                  />
                  {formErrors.subscriptionId && (
                    <p className="mt-1 text-xs text-danger">
                      {formErrors.subscriptionId.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-accent flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Salvar Configuração
                    </>
                  )}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>

        {/* Sync Panel */}
        <div>
          <GlassCard variant="strong" className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-purple/15 p-2">
                <Cloud className="h-5 w-5 text-accent-purple" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Sincronização
                </h2>
                <p className="text-xs text-text-muted">
                  Importe custos do Azure
                </p>
              </div>
            </div>

            {validation && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 ${
                  validation.valid
                    ? "bg-success/10 border border-success/20"
                    : "bg-danger/10 border border-danger/20"
                }`}
              >
                {validation.valid ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-danger" />
                )}
                <span
                  className={`text-xs ${
                    validation.valid ? "text-success" : "text-danger"
                  }`}
                >
                  {validation.valid
                    ? "Credenciais validadas"
                    : validation.error || "Credenciais inválidas"}
                </span>
              </div>
            )}

            {config && (
              <div className="rounded-lg bg-surface-1/50 p-3">
                <p className="text-xs text-text-muted">Período da sync</p>
                <p className="text-sm font-medium text-text-primary">
                  {new Date(
                    new Date().getFullYear(),
                    new Date().getMonth() - 11,
                    1
                  ).toLocaleDateString("pt-BR")}{" "}
                  -{" "}
                  {new Date(
                    new Date().getFullYear(),
                    new Date().getMonth() + 1,
                    0
                  ).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}

            {config?.lastSyncAt && (
              <div className="rounded-lg bg-surface-1/50 p-3">
                <p className="text-xs text-text-muted">
                  Última sincronização
                </p>
                <p className="text-sm font-medium text-text-primary">
                  {formatDateBR(config.lastSyncAt)}
                </p>
              </div>
            )}

            <button
              onClick={handleSync}
              disabled={syncing || !config}
              className="btn-accent flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar Custos
                </>
              )}
            </button>

            {!config && (
              <p className="text-center text-xs text-text-muted">
                Configure as credenciais antes de sincronizar
              </p>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Sync History */}
      <GlassCard>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Histórico de Sincronizações
        </h2>

        {syncHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <Cloud className="mb-2 h-8 w-8" />
            <p className="text-sm">Nenhuma sincronização realizada</p>
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-border-glass">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-glass bg-surface-1/50">
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">
                    Período
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Encontrados
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Sincronizados
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">
                    Erros
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border-glass/50 last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      {statusIndicator(log.status)}
                    </td>
                    <td className="px-4 py-2.5 text-text-primary">
                      {formatDateBR(log.periodStart)} -{" "}
                      {formatDateBR(log.periodEnd)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-primary">
                      {log.recordsFound}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-primary">
                      {log.recordsSynced}
                    </td>
                    <td className="max-w-48 truncate px-4 py-2.5 text-text-muted">
                      {log.errors || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-muted">
                      {formatDateBR(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* ================================================================= */}
      {/* Azure Dashboard – Visualizações de Custos                         */}
      {/* ================================================================= */}
      {dashboard && (dashboard.totalAzure > 0 || dashboard.monthlyTrend.length > 0) && (
        <>
          <div className="border-t border-border-glass pt-6">
            <h2 className="text-xl font-bold text-text-primary">
              Dashboard de Custos Azure
            </h2>
            <p className="text-sm text-text-secondary">
              Análise detalhada dos custos importados do Azure
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Total Azure */}
            <GlassCard className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  Total Azure
                </span>
                <div className="rounded-lg bg-accent-blue/15 p-2">
                  <DollarSign className="h-4 w-4 text-accent-blue" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-text-primary">
                  {formatBRL(dashboard.totalAzure)}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  {dashboard.variationVsPrev !== 0 ? (
                    <>
                      {dashboard.variationVsPrev > 0 ? (
                        <TrendingUp className="h-3 w-3 text-danger" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-success" />
                      )}
                      <span
                        className={`text-xs font-medium ${
                          dashboard.variationVsPrev > 0
                            ? "text-danger"
                            : "text-success"
                        }`}
                      >
                        {dashboard.variationVsPrev > 0 ? "+" : ""}
                        {dashboard.variationVsPrev.toFixed(1)}%
                      </span>
                      <span className="text-xs text-text-muted">
                        vs. mês anterior
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-text-muted">Mês atual</span>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* Service count */}
            <GlassCard className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  Serviços Azure
                </span>
                <div className="rounded-lg bg-accent-purple/15 p-2">
                  <Server className="h-4 w-4 text-accent-purple" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-text-primary">
                  {dashboard.serviceCount}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Serviços distintos
                </p>
              </div>
            </GlassCard>

            {/* Resource Group count */}
            <GlassCard className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  Resource Groups
                </span>
                <div className="rounded-lg bg-accent-cyan/15 p-2">
                  <Layers className="h-4 w-4 text-accent-cyan" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-text-primary">
                  {dashboard.resourceGroupCount}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Grupos de recursos
                </p>
              </div>
            </GlassCard>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Services – Horizontal BarChart */}
            {dashboard.byService.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Top Serviços por Custo
                </span>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dashboard.byService}
                      layout="vertical"
                      margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="oklch(0.3 0.02 260 / 0.3)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="oklch(0.5 0.02 260)"
                        fontSize={11}
                        tickFormatter={(v) =>
                          v >= 1000
                            ? `R$${(v / 1000).toFixed(0)}k`
                            : `R$${v}`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="oklch(0.5 0.02 260)"
                        fontSize={10}
                        width={120}
                        tickFormatter={(v: string) =>
                          v.length > 18 ? v.slice(0, 18) + "…" : v
                        }
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [
                          formatBRL(Number(value)),
                          "Custo",
                        ]}
                      />
                      <Bar
                        dataKey="total"
                        fill="oklch(0.65 0.2 250)"
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            )}

            {/* Monthly Trend – AreaChart */}
            {dashboard.monthlyTrend.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Evolução Mensal
                </span>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboard.monthlyTrend}>
                      <defs>
                        <linearGradient
                          id="azureGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="oklch(0.65 0.2 250)"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor="oklch(0.65 0.2 250)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="oklch(0.3 0.02 260 / 0.3)"
                      />
                      <XAxis
                        dataKey="month"
                        stroke="oklch(0.5 0.02 260)"
                        fontSize={11}
                      />
                      <YAxis
                        stroke="oklch(0.5 0.02 260)"
                        fontSize={11}
                        tickFormatter={(v) =>
                          v >= 1000
                            ? `R$${(v / 1000).toFixed(0)}k`
                            : `R$${v}`
                        }
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [
                          formatBRL(Number(value)),
                          "Total",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="oklch(0.65 0.2 250)"
                        fill="url(#azureGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            )}
          </div>

          {/* Second Row: PieChart + Table */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Resource Group Distribution – PieChart */}
            {dashboard.byResourceGroup.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Distribuição por Resource Group
                </span>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboard.byResourceGroup}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="total"
                        nameKey="name"
                        strokeWidth={0}
                      >
                        {dashboard.byResourceGroup.map((_, i) => (
                          <Cell
                            key={i}
                            fill={OKLCH_COLORS[i % OKLCH_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [
                          formatBRL(Number(value)),
                          "",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {dashboard.byResourceGroup.slice(0, 5).map((rg, i) => (
                    <div
                      key={rg.name}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              OKLCH_COLORS[i % OKLCH_COLORS.length],
                          }}
                        />
                        <span className="truncate text-text-secondary">
                          {rg.name}
                        </span>
                      </div>
                      <span className="font-medium text-text-primary">
                        {formatBRL(rg.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Top Resources Table */}
            {dashboard.topResources.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Top Recursos Mais Caros
                </span>
                <div className="overflow-auto rounded-xl border border-border-glass">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-glass bg-surface-1/50">
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">
                          Serviço
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">
                          Resource Group
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-text-secondary">
                          Valor
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-text-secondary">
                          Data
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.topResources.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-border-glass/50 last:border-0"
                        >
                          <td
                            className="max-w-36 truncate px-3 py-2 text-text-primary"
                            title={r.serviceName ?? r.description}
                          >
                            {r.serviceName ?? r.description}
                          </td>
                          <td
                            className="max-w-32 truncate px-3 py-2 text-text-muted"
                            title={r.resourceGroup ?? "-"}
                          >
                            {r.resourceGroup ?? "-"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-text-primary">
                            {formatBRL(r.amount)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-text-muted">
                            {formatDateBR(r.date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
