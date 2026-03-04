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
} from "lucide-react";
import {
  azureConfigSchema,
  type AzureConfigFormData,
} from "@/validators/cost";
import { formatDateBR } from "@/lib/formatters";

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AzurePage() {
  const [config, setConfig] = useState<AzureConfigData | null>(null);
  const [validation, setValidation] = useState<AzureValidation | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncLogEntry[]>([]);
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

  useEffect(() => {
    Promise.all([fetchConfig(), fetchSyncHistory()]).finally(() =>
      setLoading(false)
    );
  }, [fetchConfig, fetchSyncHistory]);

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
                    new Date().getMonth(),
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
    </div>
  );
}
