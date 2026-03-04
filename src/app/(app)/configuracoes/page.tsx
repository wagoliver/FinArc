"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GlassCard } from "@/components/glass/glass-card";
import {
  AlertCircle,
  Check,
  Cloud,
  Database,
  Edit2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  azureConfigSchema,
  type AzureConfigFormData,
  mongoConfigSchema,
  type MongoConfigFormData,
} from "@/validators/cost";
import { formatDateBR } from "@/lib/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

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
}

interface MongoConfigData {
  id: string;
  orgId: string;
  publicKey: string;
  privateKey: string;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MongoValidation {
  valid: boolean;
  error?: string;
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  ADMIN: { label: "Administrador", className: "bg-blue-50 text-blue-700" },
  USER: { label: "Usuário", className: "bg-sky-50 text-sky-700" },
  VIEWER: { label: "Visualizador", className: "bg-slate-100 text-slate-600" },
};

export default function ConfiguracoesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  // -------------------------------------------------------------------------
  // User management state
  // -------------------------------------------------------------------------
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // -------------------------------------------------------------------------
  // Azure config state
  // -------------------------------------------------------------------------
  const [azureConfig, setAzureConfig] = useState<AzureConfigData | null>(null);
  const [azureValidation, setAzureValidation] = useState<AzureValidation | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncLogEntry[]>([]);
  const [azureSaving, setAzureSaving] = useState(false);
  const [azureSyncing, setAzureSyncing] = useState(false);
  const [azureError, setAzureError] = useState<string | null>(null);
  const [azureSuccess, setAzureSuccess] = useState<string | null>(null);

  const {
    register: azureRegister,
    handleSubmit: azureHandleSubmit,
    reset: azureReset,
    formState: { errors: azureFormErrors },
  } = useForm<AzureConfigFormData>({
    resolver: zodResolver(azureConfigSchema),
  });

  // -------------------------------------------------------------------------
  // MongoDB config state
  // -------------------------------------------------------------------------
  const [mongoConfig, setMongoConfig] = useState<MongoConfigData | null>(null);
  const [mongoValidation, setMongoValidation] = useState<MongoValidation | null>(null);
  const [mongoSyncHistory, setMongoSyncHistory] = useState<SyncLogEntry[]>([]);
  const [mongoSaving, setMongoSaving] = useState(false);
  const [mongoSyncing, setMongoSyncing] = useState(false);
  const [mongoError, setMongoError] = useState<string | null>(null);
  const [mongoSuccess, setMongoSuccess] = useState<string | null>(null);

  const {
    register: mongoRegister,
    handleSubmit: mongoHandleSubmit,
    reset: mongoReset,
    formState: { errors: mongoFormErrors },
  } = useForm<MongoConfigFormData>({
    resolver: zodResolver(mongoConfigSchema),
  });

  // -------------------------------------------------------------------------
  // Fetch users
  // -------------------------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/usuarios");
      const json = await res.json();
      if (json.success) setUsers(json.data);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // -------------------------------------------------------------------------
  // Fetch Azure config + sync history
  // -------------------------------------------------------------------------
  const fetchAzureConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/azure/config");
      const data = await res.json();
      if (data.success && data.data) {
        setAzureConfig(data.data);
        if (data.validation) setAzureValidation(data.validation);
        azureReset({
          tenantId: data.data.tenantId,
          clientId: data.data.clientId,
          clientSecret: "",
          subscriptionId: data.data.subscriptionId,
        });
      }
    } catch {
      // silent
    }
  }, [azureReset]);

  const fetchSyncHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/azure/sync");
      const data = await res.json();
      if (data.success) setSyncHistory(data.data);
    } catch {
      // silent
    }
  }, []);

  // -------------------------------------------------------------------------
  // Fetch MongoDB config + sync history
  // -------------------------------------------------------------------------
  const fetchMongoConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/mongo/config");
      const data = await res.json();
      if (data.success && data.data) {
        setMongoConfig(data.data);
        if (data.validation) setMongoValidation(data.validation);
        mongoReset({
          orgId: data.data.orgId,
          publicKey: data.data.publicKey,
          privateKey: "",
        });
      }
    } catch {
      // silent
    }
  }, [mongoReset]);

  const fetchMongoSyncHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/mongo/sync");
      const data = await res.json();
      if (data.success) setMongoSyncHistory(data.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAzureConfig();
    fetchSyncHistory();
    fetchMongoConfig();
    fetchMongoSyncHistory();
  }, [fetchUsers, fetchAzureConfig, fetchSyncHistory, fetchMongoConfig, fetchMongoSyncHistory]);

  // -------------------------------------------------------------------------
  // User form handlers
  // -------------------------------------------------------------------------
  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", role: "USER" });
    setFormError("");
    setFormSuccess("");
    setEditingUser(null);
    setShowForm(false);
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", role: "USER" });
    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setFormError("");
    setFormSuccess("");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    try {
      if (editingUser) {
        const body: Record<string, string> = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
        };
        if (formData.password) body.password = formData.password;

        const res = await fetch(`/api/usuarios/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.success) {
          setFormSuccess("Usuário atualizado com sucesso");
          fetchUsers();
          setTimeout(resetForm, 1000);
        } else {
          setFormError(json.error || "Erro ao atualizar usuário");
        }
      } else {
        if (!formData.password) {
          setFormError("Senha é obrigatória para novos usuários");
          return;
        }

        const res = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (json.success) {
          setFormSuccess("Usuário criado com sucesso");
          fetchUsers();
          setTimeout(resetForm, 1000);
        } else {
          setFormError(json.error || "Erro ao criar usuário");
        }
      }
    } catch {
      setFormError("Erro de conexão com o servidor");
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === session?.user?.id) {
      alert("Você não pode excluir seu próprio usuário");
      return;
    }

    if (!confirm(`Deseja realmente excluir o usuário "${user.name}"?`)) return;

    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        fetchUsers();
      } else {
        alert(json.error || "Erro ao excluir usuário");
      }
    } catch {
      alert("Erro de conexão com o servidor");
    }
  };

  // -------------------------------------------------------------------------
  // Azure config handlers
  // -------------------------------------------------------------------------
  const onAzureSubmit = async (data: AzureConfigFormData) => {
    setAzureSaving(true);
    setAzureError(null);
    setAzureSuccess(null);

    try {
      const res = await fetch("/api/azure/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!result.success) {
        setAzureError(result.error || "Erro ao salvar configuração");
        return;
      }

      setAzureConfig(result.data);
      if (result.validation) {
        setAzureValidation(result.validation);
        if (result.validation.valid) {
          setAzureSuccess("Configuração salva e credenciais validadas!");
        } else {
          setAzureSuccess("Configuração salva.");
          setAzureError(`Validação Azure: ${result.validation.error}`);
        }
      } else {
        setAzureSuccess("Configuração salva com sucesso!");
      }
    } catch {
      setAzureError("Erro ao salvar configuração");
    } finally {
      setAzureSaving(false);
    }
  };

  const handleAzureSync = async () => {
    setAzureSyncing(true);
    setAzureError(null);
    setAzureSuccess(null);

    try {
      const res = await fetch("/api/azure/sync", { method: "POST" });
      const data = await res.json();

      if (!data.success) {
        setAzureError(data.error || "Erro ao sincronizar");
        return;
      }

      setAzureSuccess(
        `Sincronização concluída! ${data.data.recordsSynced} registros sincronizados.`
      );
      fetchSyncHistory();
      fetchAzureConfig();
    } catch {
      setAzureError("Erro ao sincronizar com Azure");
    } finally {
      setAzureSyncing(false);
    }
  };

  // -------------------------------------------------------------------------
  // MongoDB config handlers
  // -------------------------------------------------------------------------
  const onMongoSubmit = async (data: MongoConfigFormData) => {
    setMongoSaving(true);
    setMongoError(null);
    setMongoSuccess(null);

    try {
      const res = await fetch("/api/mongo/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!result.success) {
        setMongoError(result.error || "Erro ao salvar configuração");
        return;
      }

      setMongoConfig(result.data);
      if (result.validation) {
        setMongoValidation(result.validation);
        if (result.validation.valid) {
          setMongoSuccess("Configuração salva e credenciais validadas!");
        } else {
          setMongoSuccess("Configuração salva.");
          setMongoError(`Validação MongoDB: ${result.validation.error}`);
        }
      } else {
        setMongoSuccess("Configuração salva com sucesso!");
      }
    } catch {
      setMongoError("Erro ao salvar configuração");
    } finally {
      setMongoSaving(false);
    }
  };

  const handleMongoSync = async () => {
    setMongoSyncing(true);
    setMongoError(null);
    setMongoSuccess(null);

    try {
      const res = await fetch("/api/mongo/sync", { method: "POST" });
      const data = await res.json();

      if (!data.success) {
        setMongoError(data.error || "Erro ao sincronizar");
        return;
      }

      setMongoSuccess(
        `Sincronização concluída! ${data.data.recordsSynced} registros sincronizados.`
      );
      fetchMongoSyncHistory();
      fetchMongoConfig();
    } catch {
      setMongoError("Erro ao sincronizar com MongoDB Atlas");
    } finally {
      setMongoSyncing(false);
    }
  };

  const syncStatusIndicator = (status: SyncLogEntry["status"]) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Configurações</h1>
        <p className="text-sm text-text-secondary">
          Gerencie as configurações do sistema
        </p>
      </div>

      {/* General Settings */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-primary">Geral</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border-glass p-3">
            <div>
              <p className="text-sm text-text-primary">Perfil do Usuário</p>
              <p className="text-xs text-text-muted">
                {session?.user?.name} ({session?.user?.email})
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                ROLE_CONFIG[(session?.user as { role?: string } | undefined)?.role || "USER"]?.className || ROLE_CONFIG.USER.className
              }`}
            >
              {ROLE_CONFIG[(session?.user as { role?: string } | undefined)?.role || "USER"]?.label || "Usuário"}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* ================================================================= */}
      {/* Azure Integration                                                 */}
      {/* ================================================================= */}
      <GlassCard>
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2">
            <Cloud className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Integração Azure
            </h2>
            <p className="text-xs text-text-muted">
              Configure credenciais e sincronize custos do Azure
            </p>
          </div>
        </div>

        {/* Azure alerts */}
        {azureError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-danger" />
            <span className="text-sm text-danger">{azureError}</span>
            <button
              onClick={() => setAzureError(null)}
              className="ml-auto text-danger hover:text-danger/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {azureSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <Check className="h-4 w-4 text-success" />
            <span className="text-sm text-success">{azureSuccess}</span>
            <button
              onClick={() => setAzureSuccess(null)}
              className="ml-auto text-success hover:text-success/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Credential form */}
        <form onSubmit={azureHandleSubmit(onAzureSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Tenant ID (Directory ID)
              </label>
              <input
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                {...azureRegister("tenantId")}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
              {azureFormErrors.tenantId && (
                <p className="mt-1 text-xs text-danger">
                  {azureFormErrors.tenantId.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Client ID (Application ID)
              </label>
              <input
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                {...azureRegister("clientId")}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
              {azureFormErrors.clientId && (
                <p className="mt-1 text-xs text-danger">
                  {azureFormErrors.clientId.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Client Secret
              </label>
              <input
                type="password"
                placeholder={
                  azureConfig ? "Digite para alterar" : "Seu client secret"
                }
                {...azureRegister("clientSecret")}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
              {azureFormErrors.clientSecret && (
                <p className="mt-1 text-xs text-danger">
                  {azureFormErrors.clientSecret.message}
                </p>
              )}
              {azureConfig && (
                <p className="mt-1 text-xs text-text-muted">
                  Atual: {azureConfig.clientSecret}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Subscription ID
              </label>
              <input
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                {...azureRegister("subscriptionId")}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
              {azureFormErrors.subscriptionId && (
                <p className="mt-1 text-xs text-danger">
                  {azureFormErrors.subscriptionId.message}
                </p>
              )}
            </div>
          </div>

          {/* Validation status */}
          {azureValidation && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 ${
                azureValidation.valid
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {azureValidation.valid ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-danger" />
              )}
              <span
                className={`text-xs ${
                  azureValidation.valid ? "text-success" : "text-danger"
                }`}
              >
                {azureValidation.valid
                  ? "Credenciais validadas"
                  : azureValidation.error || "Credenciais inválidas"}
              </span>
            </div>
          )}

          {azureConfig?.lastSyncAt && (
            <p className="text-xs text-text-muted">
              Última sincronização: {formatDateBR(azureConfig.lastSyncAt)}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleAzureSync}
              disabled={azureSyncing || !azureConfig}
              className="flex items-center gap-2 rounded-lg border border-border-glass px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-50"
            >
              {azureSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar
                </>
              )}
            </button>
            <button
              type="submit"
              disabled={azureSaving}
              className="btn-accent flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              {azureSaving ? (
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

        {/* Sync History */}
        {syncHistory.length > 0 && (
          <div className="mt-6 border-t border-border-glass pt-4">
            <h3 className="mb-3 text-sm font-medium text-text-secondary">
              Histórico de Sincronizações
            </h3>
            <div className="overflow-auto rounded-lg border border-border-glass">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-glass bg-slate-50">
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
                        {syncStatusIndicator(log.status)}
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
          </div>
        )}
      </GlassCard>

      {/* ================================================================= */}
      {/* MongoDB Integration                                              */}
      {/* ================================================================= */}
      <GlassCard>
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2">
            <Database className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Integração MongoDB Atlas
            </h2>
            <p className="text-xs text-text-muted">
              Configure credenciais e sincronize custos do MongoDB Atlas
            </p>
          </div>
        </div>

        {/* Mongo alerts */}
        {mongoError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-danger" />
            <span className="text-sm text-danger">{mongoError}</span>
            <button
              onClick={() => setMongoError(null)}
              className="ml-auto text-danger hover:text-danger/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {mongoSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <Check className="h-4 w-4 text-success" />
            <span className="text-sm text-success">{mongoSuccess}</span>
            <button
              onClick={() => setMongoSuccess(null)}
              className="ml-auto text-success hover:text-success/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Credential form */}
        <form onSubmit={mongoHandleSubmit(onMongoSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Organization ID
              </label>
              <input
                type="text"
                placeholder="6x7y8z..."
                {...mongoRegister("orgId")}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
              {mongoFormErrors.orgId && (
                <p className="mt-1 text-xs text-danger">
                  {mongoFormErrors.orgId.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Public Key
              </label>
              <input
                type="text"
                placeholder="abcdefgh"
                {...mongoRegister("publicKey")}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
              {mongoFormErrors.publicKey && (
                <p className="mt-1 text-xs text-danger">
                  {mongoFormErrors.publicKey.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Private Key
              </label>
              <input
                type="password"
                placeholder={
                  mongoConfig ? "Digite para alterar" : "Sua private key"
                }
                {...mongoRegister("privateKey")}
                className="glass-input w-full rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
              {mongoFormErrors.privateKey && (
                <p className="mt-1 text-xs text-danger">
                  {mongoFormErrors.privateKey.message}
                </p>
              )}
              {mongoConfig && (
                <p className="mt-1 text-xs text-text-muted">
                  Atual: {mongoConfig.privateKey}
                </p>
              )}
            </div>
          </div>

          {/* Validation status */}
          {mongoValidation && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 ${
                mongoValidation.valid
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {mongoValidation.valid ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-danger" />
              )}
              <span
                className={`text-xs ${
                  mongoValidation.valid ? "text-success" : "text-danger"
                }`}
              >
                {mongoValidation.valid
                  ? "Credenciais validadas"
                  : mongoValidation.error || "Credenciais inválidas"}
              </span>
            </div>
          )}

          {mongoConfig?.lastSyncAt && (
            <p className="text-xs text-text-muted">
              Última sincronização: {formatDateBR(mongoConfig.lastSyncAt)}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleMongoSync}
              disabled={mongoSyncing || !mongoConfig}
              className="flex items-center gap-2 rounded-lg border border-border-glass px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 disabled:opacity-50"
            >
              {mongoSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar
                </>
              )}
            </button>
            <button
              type="submit"
              disabled={mongoSaving}
              className="btn-accent flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              {mongoSaving ? (
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

        {/* Mongo Sync History */}
        {mongoSyncHistory.length > 0 && (
          <div className="mt-6 border-t border-border-glass pt-4">
            <h3 className="mb-3 text-sm font-medium text-text-secondary">
              Histórico de Sincronizações
            </h3>
            <div className="overflow-auto rounded-lg border border-border-glass">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-glass bg-slate-50">
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
                  {mongoSyncHistory.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border-glass/50 last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        {syncStatusIndicator(log.status)}
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
          </div>
        )}
      </GlassCard>

      {/* User Management - Admin Only */}
      {isAdmin && (
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-text-primary">
                Gerenciamento de Usuários
              </h2>
            </div>
            <button
              onClick={handleOpenCreate}
              className="btn-accent flex items-center gap-2 px-3 py-2 text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Adicionar Usuário
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-10 w-10 text-text-muted" />
              <p className="mt-2 text-sm text-text-muted">
                Nenhum usuário encontrado
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border border-border-glass p-3 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-medium text-blue-600">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {user.name}
                      </p>
                      <p className="text-xs text-text-muted">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ROLE_CONFIG[user.role]?.className || ROLE_CONFIG.USER.className
                      }`}
                    >
                      {ROLE_CONFIG[user.role]?.label || user.role}
                    </span>
                    <button
                      onClick={() => handleOpenEdit(user)}
                      className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-text-primary"
                      title="Editar usuário"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {user.id !== session?.user?.id && (
                      <button
                        onClick={() => handleDelete(user)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-red-50 hover:text-danger"
                        title="Excluir usuário"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* User Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <GlassCard variant="strong" className="w-full max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                {editingUser ? (
                  <>
                    <Edit2 className="h-5 w-5" />
                    Editar Usuário
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Novo Usuário
                  </>
                )}
              </h2>
              <button
                onClick={resetForm}
                className="rounded-lg p-1 text-text-muted hover:bg-surface-2 hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Nome
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="glass-input w-full px-3 py-2 text-sm"
                  placeholder="Nome completo"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="glass-input w-full px-3 py-2 text-sm"
                  placeholder="email@exemplo.com"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Senha {editingUser && "(deixe vazio para manter a atual)"}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="glass-input w-full px-3 py-2 text-sm"
                  placeholder={editingUser ? "Nova senha (opcional)" : "Senha"}
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">
                  Função
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="glass-input w-full px-3 py-2 text-sm"
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="USER">Usuário</option>
                  <option value="VIEWER">Visualizador</option>
                </select>
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {formSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-border-glass px-4 py-2 text-sm text-text-secondary hover:bg-surface-2"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-accent px-4 py-2 text-sm">
                  {editingUser ? "Atualizar" : "Criar Usuário"}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
