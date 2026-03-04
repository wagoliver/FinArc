"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/glass/glass-card";
import {
  Database,
  RefreshCw,
  Loader2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Server,
  Zap,
  ChevronUp,
  ChevronDown,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/formatters";
import {
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
interface MongoDashboardData {
  referenceMonth: string;
  totalMongo: number;
  variationVsPrev: number;
  activeClusters: number;
  topClusterName: string;
  topClusterCost: number;
  byCluster: { name: string; total: number; count: number }[];
  byProject: { name: string; total: number; count: number }[];
  bySku: { name: string; total: number; count: number }[];
  monthlyTrend: { month: string; total: number }[];
  clusterOverTime: Record<string, string | number>[];
  clusterOverTimeKeys: string[];
  clusterComparison: {
    cluster: string;
    project: string;
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  }[];
}

// ---------------------------------------------------------------------------
// Chart style
// ---------------------------------------------------------------------------
const CHART_COLORS = [
  "#10B981",
  "#34D399",
  "#6EE7B7",
  "#A7F3D0",
  "#D1FAE5",
  "#059669",
  "#047857",
  "#065F46",
  "#064E3B",
  "#022C22",
];

const STACKED_COLORS = [
  "#10B981",
  "#059669",
  "#0EA5E9",
  "#8B5CF6",
  "#D97706",
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
// Sort
// ---------------------------------------------------------------------------
type SortField = "cluster" | "project" | "current" | "previous" | "changePercent";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MongoPage() {
  const [dashboard, setDashboard] = useState<MongoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const [sortField, setSortField] = useState<SortField>("current");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // -------------------------------------------------------------------------
  // Fetch dashboard + config
  // -------------------------------------------------------------------------
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/mongo/dashboard");
      const data = await res.json();
      if (data.success) setDashboard(data.data);
    } catch {
      // silent
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/mongo/config");
      const data = await res.json();
      if (data.success) {
        setHasConfig(!!data.data);
        if (data.data?.lastSyncAt) {
          setLastSyncAt(data.data.lastSyncAt);
        }
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchDashboard(), fetchConfig()]).finally(() =>
      setLoading(false)
    );
  }, [fetchDashboard, fetchConfig]);

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------
  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);

    try {
      const res = await fetch("/api/mongo/sync", { method: "POST" });
      const data = await res.json();

      if (!data.success) {
        setSyncMsg(data.error || "Erro ao sincronizar");
        return;
      }

      setSyncMsg(
        `Concluído! ${data.data.recordsSynced} registros de ${data.data.invoicesProcessed}/${data.data.invoicesTotal ?? "?"} faturas.`
      );
      fetchDashboard();
      fetchConfig();
    } catch {
      setSyncMsg("Erro ao sincronizar");
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
      return { ...item, variation };
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
  // Sorted table
  // -------------------------------------------------------------------------
  const sortedComparison = useMemo(() => {
    if (!dashboard) return [];
    return [...dashboard.clusterComparison].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "current":
          return (a.current - b.current) * dir;
        case "previous":
          return (a.previous - b.previous) * dir;
        case "changePercent":
          return (a.changePercent - b.changePercent) * dir;
        case "cluster":
          return a.cluster.localeCompare(b.cluster) * dir;
        case "project":
          return a.project.localeCompare(b.project) * dir;
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
    if (sortField !== field)
      return <ChevronDown className="ml-1 inline h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 inline h-3 w-3 text-emerald-600" />
    ) : (
      <ChevronDown className="ml-1 inline h-3 w-3 text-emerald-600" />
    );
  };

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <GlassCard className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2">
            <Database className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">
              MongoDB Atlas Billing
            </h1>
            <p className="text-xs text-text-muted">
              {dashboard?.referenceMonth
                ? `Ref.: ${dashboard.referenceMonth}`
                : ""}
              {lastSyncAt
                ? ` · Última sync: ${formatDateBR(lastSyncAt)}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {syncMsg && (
            <span className="text-xs text-text-secondary max-w-xs truncate">
              {syncMsg}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing || !hasConfig}
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
            title="Configurações MongoDB"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </GlassCard>

      {/* Not configured — prompt to go to settings */}
      {hasConfig === false && (
        <GlassCard className="py-10 text-center">
          <Database className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-sm text-text-secondary">
            MongoDB Atlas não configurado.
          </p>
          <Link
            href="/configuracoes"
            className="btn-accent mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Settings className="h-4 w-4" />
            Ir para Configurações
          </Link>
        </GlassCard>
      )}

      {/* Dashboard content */}
      {dashboard &&
        (dashboard.totalMongo > 0 || dashboard.monthlyTrend.length > 0) && (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 xl:grid-cols-4 sm:grid-cols-2">
              {/* 1. Custo Total */}
              <GlassCard className="flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    Custo Total
                  </span>
                  <div className="rounded-lg bg-emerald-50 p-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xl font-bold text-text-primary">
                    {formatBRL(dashboard.totalMongo)}
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
                      <span className="text-xs text-text-muted">
                        vs. mês anterior
                      </span>
                    )}
                  </div>
                </div>
              </GlassCard>

              {/* 2. Clusters Ativos */}
              <GlassCard className="flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    Clusters Ativos
                  </span>
                  <div className="rounded-lg bg-emerald-50 p-1.5">
                    <Server className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xl font-bold text-text-primary">
                    {dashboard.activeClusters}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Com custo no período
                  </p>
                </div>
              </GlassCard>

              {/* 3. Cluster Mais Caro */}
              <GlassCard className="flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    Cluster Mais Caro
                  </span>
                  <div className="rounded-lg bg-emerald-50 p-1.5">
                    <Zap className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xl font-bold text-text-primary">
                    {formatBRL(dashboard.topClusterCost)}
                  </p>
                  <p className="mt-1 text-xs text-text-muted truncate">
                    {dashboard.topClusterName}
                  </p>
                </div>
              </GlassCard>

              {/* 4. Variação */}
              <GlassCard className="flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    Variação Mensal
                  </span>
                  <div className="rounded-lg bg-emerald-50 p-1.5">
                    {dashboard.variationVsPrev >= 0 ? (
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" />
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
                  <p className="mt-1 text-xs text-text-muted">
                    vs. mês anterior
                  </p>
                </div>
              </GlassCard>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Bar chart horizontal: custo por cluster */}
              {dashboard.byCluster.length > 0 && (
                <GlassCard className="flex flex-col">
                  <span className="mb-4 text-sm font-medium text-text-secondary">
                    Custo por Cluster
                  </span>
                  <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dashboard.byCluster}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={gridStroke}
                        />
                        <XAxis
                          type="number"
                          stroke={axisStroke}
                          fontSize={11}
                          tickFormatter={(v) =>
                            v >= 1000
                              ? `R$${(v / 1000).toFixed(0)}k`
                              : `R$${v}`
                          }
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
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
                          formatter={(value: any) => [
                            formatBRL(Number(value)),
                            "Custo",
                          ]}
                        />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                          {dashboard.byCluster.map((_, i) => (
                            <Cell
                              key={i}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              )}

              {/* Donut chart: distribuição por SKU */}
              {dashboard.bySku.length > 0 && (
                <GlassCard className="flex flex-col">
                  <span className="mb-4 text-sm font-medium text-text-secondary">
                    Distribuição por SKU
                  </span>
                  <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboard.bySku}
                          dataKey="total"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={120}
                          paddingAngle={2}
                          label={({ name, percent }: { name?: string; percent?: number }) =>
                            `${(name ?? "").length > 20 ? (name ?? "").slice(0, 20) + "…" : (name ?? "")} (${((percent ?? 0) * 100).toFixed(0)}%)`
                          }
                          labelLine={true}
                          fontSize={10}
                        >
                          {dashboard.bySku.map((_, i) => (
                            <Cell
                              key={i}
                              fill={CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(value: any) => [
                            formatBRL(Number(value)),
                            "Custo",
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              )}
            </div>

            {/* Stacked bar: evolução mensal top 5 clusters */}
            {dashboard.clusterOverTime.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Evolução Mensal por Cluster (Top 5)
                </span>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dashboard.clusterOverTime}
                      margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridStroke}
                      />
                      <XAxis
                        dataKey="month"
                        stroke={axisStroke}
                        fontSize={11}
                      />
                      <YAxis
                        stroke={axisStroke}
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
                          "",
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px" }}
                        iconSize={10}
                      />
                      {dashboard.clusterOverTimeKeys.map((key, i) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          stackId="a"
                          fill={STACKED_COLORS[i % STACKED_COLORS.length]}
                          radius={
                            i === dashboard.clusterOverTimeKeys.length - 1
                              ? [4, 4, 0, 0]
                              : [0, 0, 0, 0]
                          }
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            )}

            {/* Comparativo de Custos Mensal */}
            {monthlyComparison.length > 0 && (
              <GlassCard className="flex flex-col">
                <span className="mb-4 text-sm font-medium text-text-secondary">
                  Comparativo de Custos Mensal
                </span>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyComparison}
                      margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridStroke}
                      />
                      <XAxis
                        dataKey="month"
                        stroke={axisStroke}
                        fontSize={11}
                      />
                      <YAxis
                        stroke={axisStroke}
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
                          "Custo",
                        ]}
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
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {monthlyComparison.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.variation !== null && entry.variation > 10
                                ? "#EF4444"
                                : entry.variation !== null &&
                                    entry.variation < -10
                                  ? "#10B981"
                                  : "#059669"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            )}

            {/* Tabela comparativa por cluster */}
            {sortedComparison.length > 0 && (
              <GlassCard>
                <span className="mb-4 block text-sm font-medium text-text-secondary">
                  Comparativo por Cluster
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-glass text-left text-xs text-text-muted">
                        <th
                          className="cursor-pointer pb-3 pr-4"
                          onClick={() => toggleSort("cluster")}
                        >
                          Cluster
                          <SortIcon field="cluster" />
                        </th>
                        <th
                          className="cursor-pointer pb-3 pr-4"
                          onClick={() => toggleSort("project")}
                        >
                          Projeto
                          <SortIcon field="project" />
                        </th>
                        <th
                          className="cursor-pointer pb-3 pr-4 text-right"
                          onClick={() => toggleSort("current")}
                        >
                          Mês Ref.
                          <SortIcon field="current" />
                        </th>
                        <th
                          className="cursor-pointer pb-3 pr-4 text-right"
                          onClick={() => toggleSort("previous")}
                        >
                          Mês Ant.
                          <SortIcon field="previous" />
                        </th>
                        <th
                          className="cursor-pointer pb-3 text-right"
                          onClick={() => toggleSort("changePercent")}
                        >
                          Variação
                          <SortIcon field="changePercent" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedComparison.map((row) => (
                        <tr
                          key={row.cluster}
                          className="border-b border-border-glass/50 hover:bg-surface-1"
                        >
                          <td className="py-2.5 pr-4 font-medium text-text-primary">
                            {row.cluster}
                          </td>
                          <td className="py-2.5 pr-4 text-text-secondary">
                            {row.project}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-text-primary">
                            {formatBRL(row.current)}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-text-secondary">
                            {formatBRL(row.previous)}
                          </td>
                          <td className="py-2.5 text-right">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium ${
                                row.changePercent > 0
                                  ? "text-danger"
                                  : row.changePercent < 0
                                    ? "text-success"
                                    : "text-text-muted"
                              }`}
                            >
                              {row.changePercent > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : row.changePercent < 0 ? (
                                <TrendingDown className="h-3 w-3" />
                              ) : null}
                              {row.changePercent > 0 ? "+" : ""}
                              {row.changePercent.toFixed(1)}%
                            </span>
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

      {/* Empty state when no data and config exists */}
      {hasConfig &&
        dashboard &&
        dashboard.totalMongo === 0 &&
        dashboard.monthlyTrend.length === 0 && (
          <GlassCard className="py-12 text-center">
            <Database className="mx-auto h-12 w-12 text-text-muted/40" />
            <p className="mt-4 text-sm text-text-secondary">
              Nenhum dado encontrado. Clique em &quot;Sincronizar&quot; para
              importar as faturas do MongoDB Atlas.
            </p>
          </GlassCard>
        )}
    </div>
  );
}
