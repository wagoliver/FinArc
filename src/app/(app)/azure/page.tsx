"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/glass/glass-card";
import {
  Cloud,
  RefreshCw,
  Loader2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Server,
  Layers,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Database,
  Zap,
  ChevronUp,
  ChevronDown,
  Settings,
} from "lucide-react";
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
  Legend,
  ReferenceLine,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GrowthEntry {
  name: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

interface AzureDashboardData {
  totalAzure: number;
  variationVsPrev: number;
  serviceCount: number;
  resourceGroupCount: number;
  avgDailyCost: number;
  totalEntries: number;
  highestDayAmount: number;
  highestDayDate: string;
  byService: { name: string; total: number; count: number }[];
  byResourceGroup: { name: string; total: number; count: number }[];
  byMeterCategory: { name: string; total: number; count: number }[];
  monthlyTrend: { month: string; total: number }[];
  dailyTrend: { day: string; total: number }[];
  serviceOverTime: Record<string, string | number>[];
  serviceOverTimeKeys: string[];
  topGrowing: GrowthEntry[];
  topShrinking: GrowthEntry[];
  costDistribution: {
    buckets: { label: string; count: number }[];
    stats: { min: number; max: number; avg: number; median: number; p95: number };
  };
  topResources: {
    id: string;
    description: string;
    amount: number;
    date: string;
    serviceName: string | null;
    resourceGroup: string | null;
    meterCategory: string | null;
    resourceId: string | null;
  }[];
}

// ---------------------------------------------------------------------------
// Corporate chart colors
// ---------------------------------------------------------------------------
const CHART_COLORS = [
  "#2563EB",
  "#3B82F6",
  "#60A5FA",
  "#93C5FD",
  "#BFDBFE",
  "#0EA5E9",
  "#8B5CF6",
  "#A78BFA",
  "#6366F1",
  "#818CF8",
];

const STACKED_COLORS = [
  "#2563EB",
  "#0EA5E9",
  "#8B5CF6",
  "#D97706",
  "#3B82F6",
];

const tooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: "0.75rem",
  color: "#1E293B",
  fontSize: "0.8rem",
  boxShadow: "0 4px 6px rgba(0,0,0,0.04)",
};

const axisStroke = "#94A3B8";
const gridStroke = "#E2E8F0";

// ---------------------------------------------------------------------------
// Sort types for table
// ---------------------------------------------------------------------------
type SortField = "serviceName" | "resourceGroup" | "meterCategory" | "resourceId" | "amount" | "date";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AzurePage() {
  const [dashboard, setDashboard] = useState<AzureDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    current: string;
    done: number;
    total: number;
  } | null>(null);
  const [sortField, setSortField] = useState<SortField>("amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // -------------------------------------------------------------------------
  // Fetch dashboard + last sync
  // -------------------------------------------------------------------------
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/azure/dashboard");
      const data = await res.json();
      if (data.success) setDashboard(data.data);
    } catch {
      // silent
    }
  }, []);

  const fetchLastSync = useCallback(async () => {
    try {
      const res = await fetch("/api/azure/config");
      const data = await res.json();
      if (data.success && data.data?.lastSyncAt) {
        setLastSyncAt(data.data.lastSyncAt);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchDashboard(), fetchLastSync()]).finally(() =>
      setLoading(false)
    );
  }, [fetchDashboard, fetchLastSync]);

  // -------------------------------------------------------------------------
  // Incremental sync – month by month
  // -------------------------------------------------------------------------
  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    setSyncProgress(null);

    try {
      // 1. Fetch status to know which months are pending
      const statusRes = await fetch("/api/azure/sync/status");
      const statusData = await statusRes.json();
      if (!statusData.success) {
        setSyncMsg(statusData.error || "Erro ao verificar status");
        setSyncing(false);
        return;
      }

      const { months, totalMonths } = statusData.data;
      const pending = months.filter((m: { synced: boolean }) => !m.synced);

      if (pending.length === 0) {
        setSyncMsg("Todos os meses já estão sincronizados!");
        setSyncing(false);
        return;
      }

      let totalSynced = 0;
      const alreadySynced = totalMonths - pending.length;

      // 2. Sync each pending month sequentially
      for (let i = 0; i < pending.length; i++) {
        const month = pending[i] as { key: string; label: string };
        setSyncProgress({
          current: month.label,
          done: alreadySynced + i,
          total: totalMonths,
        });

        const res = await fetch("/api/azure/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: month.key }),
        });
        const data = await res.json();

        if (!data.success) {
          // On rate limit, stop and show how far we got
          if (res.status === 429) {
            setSyncMsg(
              `Rate limit! ${totalSynced} registros sincronizados até ${month.label}. Tente novamente em 30s para continuar.`
            );
            setSyncProgress(null);
            fetchDashboard();
            fetchLastSync();
            setSyncing(false);
            return;
          }
          setSyncMsg(`Erro em ${month.label}: ${data.error}`);
          setSyncProgress(null);
          setSyncing(false);
          return;
        }

        totalSynced += data.data.recordsSynced;

        // Small delay between months to avoid rate limit
        if (i < pending.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      setSyncProgress(null);
      setSyncMsg(`Concluído! ${totalSynced} registros sincronizados.`);
      fetchDashboard();
      fetchLastSync();
    } catch {
      setSyncMsg("Erro ao sincronizar");
      setSyncProgress(null);
    } finally {
      setSyncing(false);
    }
  };

  // -------------------------------------------------------------------------
  // Comparative month-by-month data
  // -------------------------------------------------------------------------
  const monthlyComparison = useMemo(() => {
    if (!dashboard?.monthlyTrend?.length) return [];
    return dashboard.monthlyTrend.map((item, i) => {
      const prev = i > 0 ? dashboard.monthlyTrend[i - 1].total : null;
      const variation =
        prev !== null && prev > 0
          ? ((item.total - prev) / prev) * 100
          : null;
      return {
        ...item,
        variation,
      };
    });
  }, [dashboard]);

  const monthlyAvg = useMemo(() => {
    if (!monthlyComparison.length) return 0;
    return (
      monthlyComparison.reduce((sum, m) => sum + m.total, 0) /
      monthlyComparison.length
    );
  }, [monthlyComparison]);

  // -------------------------------------------------------------------------
  // Sorted table data
  // -------------------------------------------------------------------------
  const sortedResources = useMemo(() => {
    if (!dashboard) return [];
    return [...dashboard.topResources].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "amount":
          return (a.amount - b.amount) * dir;
        case "date":
          return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
        case "serviceName":
          return ((a.serviceName ?? "").localeCompare(b.serviceName ?? "")) * dir;
        case "resourceGroup":
          return ((a.resourceGroup ?? "").localeCompare(b.resourceGroup ?? "")) * dir;
        case "meterCategory":
          return ((a.meterCategory ?? "").localeCompare(b.meterCategory ?? "")) * dir;
        case "resourceId":
          return ((a.resourceId ?? "").localeCompare(b.resourceId ?? "")) * dir;
        default:
          return 0;
      }
    });
  }, [dashboard, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="ml-1 inline h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 inline h-3 w-3 text-blue-600" />
    ) : (
      <ChevronDown className="ml-1 inline h-3 w-3 text-blue-600" />
    );
  };

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Compact Action Bar */}
      <GlassCard className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2">
            <Cloud className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">
              Azure Cost Management
            </h1>
            {lastSyncAt && (
              <p className="text-xs text-text-muted">
                Última sync: {formatDateBR(lastSyncAt)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          {syncProgress && (
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{
                    width: `${Math.round((syncProgress.done / syncProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-text-secondary whitespace-nowrap">
                {syncProgress.current} ({syncProgress.done}/{syncProgress.total})
              </span>
            </div>
          )}
          {syncMsg && !syncProgress && (
            <span className="text-xs text-text-secondary max-w-xs truncate">{syncMsg}</span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-accent flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sincronizar
          </button>
          <Link
            href="/configuracoes"
            className="rounded-lg border border-border-glass p-2 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Configurações Azure"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </GlassCard>

      {/* Dashboard content */}
      {dashboard && (dashboard.totalAzure > 0 || dashboard.monthlyTrend.length > 0) && (
        <>
          {/* ============================================================= */}
          {/* Seção A — KPI Cards                                           */}
          {/* ============================================================= */}
          <div className="grid gap-4 xl:grid-cols-6 lg:grid-cols-3 sm:grid-cols-2">
            {/* 1. Total Azure */}
            <GlassCard className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Total Azure</span>
                <div className="rounded-lg bg-blue-50 p-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold text-text-primary">
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
                    </>
                  ) : (
                    <span className="text-xs text-text-muted">Mês atual</span>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* 2. Variação Mensal */}
            <GlassCard className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Variação Mensal</span>
                <div className="rounded-lg bg-blue-50 p-1.5">
                  {dashboard.variationVsPrev >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-blue-600" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-blue-600" />
                  )}
                </div>
              </div>
              <div className="mt-2">
                <p
                  className={`text-xl font-bold ${
                    dashboard.variationVsPrev > 0
                      ? "text-danger"
                      : dashboard.variationVsPrev < 0
                        ? "text-success"
                        : "text-text-primary"
                  }`}
                >
                  {dashboard.variationVsPrev > 0 ? "+" : ""}
                  {dashboard.variationVsPrev.toFixed(1)}%
                </p>
                <p className="mt-1 text-xs text-text-muted">vs. mês anterior</p>
              </div>
            </GlassCard>

            {/* 3. Custo Diário Médio */}
            <GlassCard className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Custo Diário Médio</span>
                <div className="rounded-lg bg-sky-50 p-1.5">
                  <Activity className="h-3.5 w-3.5 text-sky-600" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold text-text-primary">
                  {formatBRL(dashboard.avgDailyCost)}
                </p>
                <p className="mt-1 text-xs text-text-muted">Média 30 dias</p>
              </div>
            </GlassCard>

            {/* 4. Dia Mais Caro */}
            <GlassCard className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Dia Mais Caro</span>
                <div className="rounded-lg bg-violet-50 p-1.5">
                  <Zap className="h-3.5 w-3.5 text-violet-600" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold text-text-primary">
                  {formatBRL(dashboard.highestDayAmount)}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                  <Calendar className="h-3 w-3" />
                  {dashboard.highestDayDate || "-"}
                </p>
              </div>
            </GlassCard>

            {/* 5. Total de Registros */}
            <GlassCard className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Registros Sync</span>
                <div className="rounded-lg bg-blue-50 p-1.5">
                  <Database className="h-3.5 w-3.5 text-blue-600" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold text-text-primary">
                  {dashboard.totalEntries.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-xs text-text-muted">Todas as syncs</p>
              </div>
            </GlassCard>

            {/* 6. Serviços / Resource Groups */}
            <GlassCard className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Serviços / RGs</span>
                <div className="rounded-lg bg-blue-50 p-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold text-text-primary">
                  {dashboard.serviceCount}{" "}
                  <span className="text-sm font-normal text-text-muted">/</span>{" "}
                  {dashboard.resourceGroupCount}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  <Server className="mr-1 inline h-3 w-3" />
                  Serviços
                  <Layers className="ml-2 mr-1 inline h-3 w-3" />
                  Grupos
                </p>
              </div>
            </GlassCard>
          </div>

          {/* ============================================================= */}
          {/* Seção B — Comparativo Mês-a-Mês + Evolução por Serviço        */}
          {/* ============================================================= */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Comparativo de Custos Mensal — BarChart */}
            {monthlyComparison.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Comparativo de Custos Mensal
                </span>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyComparison} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="month" stroke={axisStroke} fontSize={11} />
                      <YAxis
                        stroke={axisStroke}
                        fontSize={11}
                        tickFormatter={(v) =>
                          v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                        }
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [formatBRL(Number(value)), "Custo"]}
                      />
                      <ReferenceLine
                        y={monthlyAvg}
                        stroke="#94A3B8"
                        strokeDasharray="6 4"
                        label={{
                          value: `Média: ${formatBRL(monthlyAvg)}`,
                          position: "insideTopRight",
                          fill: "#64748B",
                          fontSize: 10,
                        }}
                      />
                      <Bar
                        dataKey="total"
                        fill="#2563EB"
                        radius={[6, 6, 0, 0]}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        label={(props: any) => {
                          const { x, y, width: w, value, index } = props;
                          const item = monthlyComparison[index];
                          if (!item?.variation) return null;
                          const color = item.variation > 0 ? "#DC2626" : "#16A34A";
                          const txt = `${item.variation > 0 ? "+" : ""}${item.variation.toFixed(1)}%`;
                          return (
                            <text
                              x={Number(x) + Number(w) / 2}
                              y={Number(y) - 6}
                              textAnchor="middle"
                              fill={color}
                              fontSize={9}
                              fontWeight={600}
                            >
                              {value > 0 ? txt : ""}
                            </text>
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            )}

            {/* Evolução Mensal (12 meses) — AreaChart */}
            {dashboard.monthlyTrend.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Evolução Mensal (12 Meses)
                </span>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboard.monthlyTrend}>
                      <defs>
                        <linearGradient id="azureGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="month" stroke={axisStroke} fontSize={11} />
                      <YAxis
                        stroke={axisStroke}
                        fontSize={11}
                        tickFormatter={(v) =>
                          v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                        }
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [formatBRL(Number(value)), "Total"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#2563EB"
                        fill="url(#azureGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            )}
          </div>

          {/* ============================================================= */}
          {/* Seção C — Análise por Serviço                                 */}
          {/* ============================================================= */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Evolução por Serviço (Top 5) — Stacked AreaChart */}
            {dashboard.serviceOverTime.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Evolução por Serviço (Top 5)
                </span>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboard.serviceOverTime}>
                      <defs>
                        {dashboard.serviceOverTimeKeys.map((key, i) => (
                          <linearGradient key={key} id={`svc-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={STACKED_COLORS[i % STACKED_COLORS.length]} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={STACKED_COLORS[i % STACKED_COLORS.length]} stopOpacity={0.02} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="month" stroke={axisStroke} fontSize={10} />
                      <YAxis
                        stroke={axisStroke}
                        fontSize={10}
                        tickFormatter={(v) =>
                          v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v.toFixed(0)}`
                        }
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any, name: any) => [formatBRL(Number(value)), String(name)]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "10px", color: "#64748B" }}
                        formatter={(value: string) =>
                          value.length > 20 ? value.slice(0, 20) + "…" : value
                        }
                      />
                      {dashboard.serviceOverTimeKeys.map((key, i) => (
                        <Area
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stackId="1"
                          stroke={STACKED_COLORS[i % STACKED_COLORS.length]}
                          fill={`url(#svc-${i})`}
                          strokeWidth={1.5}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            )}

            {/* Top Serviços por Custo — Horizontal BarChart */}
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
                        stroke={gridStroke}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke={axisStroke}
                        fontSize={11}
                        tickFormatter={(v) =>
                          v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke={axisStroke}
                        fontSize={10}
                        width={120}
                        tickFormatter={(v: string) =>
                          v.length > 18 ? v.slice(0, 18) + "…" : v
                        }
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [formatBRL(Number(value)), "Custo"]}
                      />
                      <Bar dataKey="total" fill="#2563EB" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            )}

            {/* Categorias de Medição — Simple meter list (replacing Treemap) */}
            {dashboard.byMeterCategory.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Categorias de Medição
                </span>
                <div className="flex-1 space-y-3">
                  {(() => {
                    const maxVal = Math.max(
                      ...dashboard.byMeterCategory.map((m) => m.total)
                    );
                    return dashboard.byMeterCategory.slice(0, 10).map((m, i) => (
                      <div key={m.name}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="truncate text-text-primary" title={m.name}>
                            {m.name.length > 25 ? m.name.slice(0, 25) + "…" : m.name}
                          </span>
                          <span className="ml-2 shrink-0 font-medium text-text-primary">
                            {formatBRL(m.total)}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(m.total / maxVal) * 100}%`,
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </GlassCard>
            )}
          </div>

          {/* ============================================================= */}
          {/* Seção D — Crescimento & Distribuição                          */}
          {/* ============================================================= */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Serviços em Crescimento / Redução */}
            <GlassCard className="flex flex-col">
              <span className="mb-4 text-sm font-medium text-text-secondary">
                Crescimento vs. Mês Anterior
              </span>

              {/* Growing */}
              {dashboard.topGrowing.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-danger">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Em Crescimento
                  </p>
                  <div className="space-y-2">
                    {dashboard.topGrowing.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2"
                      >
                        <span className="truncate text-xs text-text-primary" title={s.name}>
                          {s.name.length > 25 ? s.name.slice(0, 25) + "…" : s.name}
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-text-muted">
                            {formatBRL(s.previous)}
                          </span>
                          <ArrowUpRight className="h-3 w-3 text-danger" />
                          <span className="font-medium text-danger">
                            {formatBRL(s.current)}
                          </span>
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                            +{s.changePercent.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shrinking */}
              {dashboard.topShrinking.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-success">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    Em Redução
                  </p>
                  <div className="space-y-2">
                    {dashboard.topShrinking.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2"
                      >
                        <span className="truncate text-xs text-text-primary" title={s.name}>
                          {s.name.length > 25 ? s.name.slice(0, 25) + "…" : s.name}
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-text-muted">
                            {formatBRL(s.previous)}
                          </span>
                          <ArrowDownRight className="h-3 w-3 text-success" />
                          <span className="font-medium text-success">
                            {formatBRL(s.current)}
                          </span>
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-success">
                            {s.changePercent.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard.topGrowing.length === 0 && dashboard.topShrinking.length === 0 && (
                <p className="py-8 text-center text-sm text-text-muted">
                  Sem dados suficientes para comparação
                </p>
              )}
            </GlassCard>

            {/* Distribuição de Custos — Histograma + Stats */}
            <GlassCard className="flex flex-col">
              <span className="mb-4 text-sm font-medium text-text-secondary">
                Distribuição de Custos
              </span>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.costDistribution.buckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="label" stroke={axisStroke} fontSize={10} />
                    <YAxis stroke={axisStroke} fontSize={11} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [`${Number(value)} registros`, "Qtd"]}
                    />
                    <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-5 gap-2">
                {[
                  { label: "Mínimo", value: dashboard.costDistribution.stats.min },
                  { label: "Média", value: dashboard.costDistribution.stats.avg },
                  { label: "Mediana", value: dashboard.costDistribution.stats.median },
                  { label: "P95", value: dashboard.costDistribution.stats.p95 },
                  { label: "Máximo", value: dashboard.costDistribution.stats.max },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg bg-slate-50 p-2 text-center"
                  >
                    <p className="text-[10px] text-text-muted">{s.label}</p>
                    <p className="text-xs font-semibold text-text-primary">
                      {formatBRL(s.value)}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* ============================================================= */}
          {/* Seção E — Distribuição (Pie Charts)                           */}
          {/* ============================================================= */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* PieChart Resource Group */}
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
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [formatBRL(Number(value)), ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {dashboard.byResourceGroup.slice(0, 5).map((rg, i) => (
                    <div key={rg.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="truncate text-text-secondary">{rg.name}</span>
                      </div>
                      <span className="font-medium text-text-primary">{formatBRL(rg.total)}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* PieChart Meter Category */}
            {dashboard.byMeterCategory.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Distribuição por Meter Category
                </span>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboard.byMeterCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="total"
                        nameKey="name"
                        strokeWidth={0}
                      >
                        {dashboard.byMeterCategory.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [formatBRL(Number(value)), ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {dashboard.byMeterCategory.slice(0, 5).map((mc, i) => (
                    <div key={mc.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="truncate text-text-secondary">{mc.name}</span>
                      </div>
                      <span className="font-medium text-text-primary">{formatBRL(mc.total)}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>

          {/* ============================================================= */}
          {/* Seção F — Tabela Expandida                                    */}
          {/* ============================================================= */}
          {dashboard.topResources.length > 0 && (
            <GlassCard className="flex flex-col">
              <span className="mb-4 text-sm font-medium text-text-secondary">
                Top 20 Recursos Mais Caros
              </span>
              <div className="overflow-auto rounded-xl border border-border-glass">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-glass bg-slate-50">
                      <th
                        className="cursor-pointer px-3 py-2.5 text-left font-medium text-text-secondary hover:text-text-primary"
                        onClick={() => toggleSort("serviceName")}
                      >
                        Serviço <SortIcon field="serviceName" />
                      </th>
                      <th
                        className="cursor-pointer px-3 py-2.5 text-left font-medium text-text-secondary hover:text-text-primary"
                        onClick={() => toggleSort("resourceGroup")}
                      >
                        Resource Group <SortIcon field="resourceGroup" />
                      </th>
                      <th
                        className="cursor-pointer px-3 py-2.5 text-left font-medium text-text-secondary hover:text-text-primary"
                        onClick={() => toggleSort("meterCategory")}
                      >
                        Meter Category <SortIcon field="meterCategory" />
                      </th>
                      <th
                        className="cursor-pointer px-3 py-2.5 text-left font-medium text-text-secondary hover:text-text-primary"
                        onClick={() => toggleSort("resourceId")}
                      >
                        Resource ID <SortIcon field="resourceId" />
                      </th>
                      <th
                        className="cursor-pointer px-3 py-2.5 text-right font-medium text-text-secondary hover:text-text-primary"
                        onClick={() => toggleSort("amount")}
                      >
                        Valor <SortIcon field="amount" />
                      </th>
                      <th
                        className="cursor-pointer px-3 py-2.5 text-right font-medium text-text-secondary hover:text-text-primary"
                        onClick={() => toggleSort("date")}
                      >
                        Data <SortIcon field="date" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResources.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-border-glass/50 last:border-0 hover:bg-slate-50"
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
                        <td
                          className="max-w-28 truncate px-3 py-2 text-text-muted"
                          title={r.meterCategory ?? "-"}
                        >
                          {r.meterCategory ?? "-"}
                        </td>
                        <td
                          className="max-w-40 truncate px-3 py-2 font-mono text-[11px] text-text-muted"
                          title={r.resourceId ?? "-"}
                        >
                          {r.resourceId
                            ? r.resourceId.split("/").pop() ?? r.resourceId
                            : "-"}
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
        </>
      )}

      {/* Empty state */}
      {(!dashboard || (dashboard.totalAzure === 0 && dashboard.monthlyTrend.length === 0)) && (
        <GlassCard className="flex flex-col items-center justify-center py-16">
          <Cloud className="mb-3 h-12 w-12 text-text-muted" />
          <p className="text-lg font-medium text-text-primary">Sem dados Azure</p>
          <p className="mt-1 text-sm text-text-muted">
            Configure suas credenciais nas{" "}
            <Link href="/configuracoes" className="text-blue-600 hover:underline">
              Configurações
            </Link>{" "}
            e sincronize os custos.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
