"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  Server,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Hash,
  Loader2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { formatBRL } from "@/lib/formatters";
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
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ResourceEntry {
  serviceName: string;
  cost: number;
  prevCost: number;
  variation: number;
  entries: number;
  resources: number;
}

interface ResourcesDashboardData {
  referenceMonth: string;
  totalCost: number;
  serviceCount: number;
  topService: { name: string; cost: number } | null;
  variationVsPrev: number;
  services: ResourceEntry[];
  monthlyTrend: Record<string, string | number>[];
  monthlyTrendKeys: string[];
}

// ---------------------------------------------------------------------------
// Chart config
// ---------------------------------------------------------------------------
const CHART_COLORS = [
  "#2563EB",
  "#0EA5E9",
  "#8B5CF6",
  "#D97706",
  "#10B981",
  "#F43F5E",
  "#6366F1",
  "#EC4899",
  "#14B8A6",
  "#F59E0B",
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
type SortField = "serviceName" | "cost" | "prevCost" | "variation" | "resources";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function RecursosPage() {
  const [dashboard, setDashboard] = useState<ResourcesDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("cost");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/recursos/dashboard");
      const data = await res.json();
      if (data.success) setDashboard(data.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchDashboard().finally(() => setLoading(false));
  }, [fetchDashboard]);

  // -------------------------------------------------------------------------
  // Sort helpers
  // -------------------------------------------------------------------------
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="inline h-3 w-3 ml-1" />
    );
  };

  const sortedServices = dashboard
    ? [...dashboard.services].sort((a, b) => {
        const mul = sortDir === "asc" ? 1 : -1;
        if (sortField === "serviceName") return mul * a.serviceName.localeCompare(b.serviceName);
        return mul * ((a[sortField] as number) - (b[sortField] as number));
      })
    : [];

  // -------------------------------------------------------------------------
  // Chart data
  // -------------------------------------------------------------------------
  const barData = dashboard
    ? [...dashboard.services]
        .filter((s) => s.cost > 0)
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10)
        .map((s) => ({ name: s.serviceName, custo: s.cost }))
    : [];

  const pieData = dashboard
    ? (() => {
        const sorted = [...dashboard.services].filter((s) => s.cost > 0).sort((a, b) => b.cost - a.cost);
        const top5 = sorted.slice(0, 5);
        const othersTotal = sorted.slice(5).reduce((sum, s) => sum + s.cost, 0);
        const result = top5.map((s) => ({ name: s.serviceName, value: s.cost }));
        if (othersTotal > 0) result.push({ name: "Outros", value: othersTotal });
        return result;
      })()
    : [];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Recursos</h1>
        <GlassCard>
          <p className="text-text-secondary text-center py-12">
            Nenhum dado encontrado. Sincronize os dados do Azure primeiro.
          </p>
        </GlassCard>
      </div>
    );
  }

  const d = dashboard;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Server className="h-6 w-6 text-accent-blue" />
          Recursos
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Cost allocation por Serviço Azure — {d.referenceMonth}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost */}
        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Custo Total</span>
            <DollarSign className="h-4 w-4 text-accent-blue" />
          </div>
          <p className="text-2xl font-bold text-text-primary">{formatBRL(d.totalCost)}</p>
          <div className="flex items-center gap-1 mt-1">
            {d.variationVsPrev >= 0 ? (
              <ArrowUpRight className="h-3 w-3 text-red-400" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-green-400" />
            )}
            <span className={`text-xs ${d.variationVsPrev >= 0 ? "text-red-400" : "text-green-400"}`}>
              {d.variationVsPrev > 0 ? "+" : ""}
              {d.variationVsPrev}% vs mês anterior
            </span>
          </div>
        </GlassCard>

        {/* Active Services */}
        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Tipos de Serviço</span>
            <Hash className="h-4 w-4 text-accent-cyan" />
          </div>
          <p className="text-2xl font-bold text-text-primary">{d.serviceCount}</p>
          <p className="text-xs text-text-secondary mt-1">Serviços Azure com custo</p>
        </GlassCard>

        {/* Most Expensive */}
        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Serviço Mais Caro</span>
            <Award className="h-4 w-4 text-accent-pink" />
          </div>
          <p className="text-lg font-bold text-text-primary truncate">
            {d.topService?.name ?? "—"}
          </p>
          <p className="text-sm text-accent-purple mt-1">
            {d.topService ? formatBRL(d.topService.cost) : "—"}
          </p>
        </GlassCard>

        {/* Variation */}
        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Variação Mensal</span>
            {d.variationVsPrev >= 0 ? (
              <TrendingUp className="h-4 w-4 text-red-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-400" />
            )}
          </div>
          <p
            className={`text-2xl font-bold ${
              d.variationVsPrev >= 0 ? "text-red-400" : "text-green-400"
            }`}
          >
            {d.variationVsPrev > 0 ? "+" : ""}
            {d.variationVsPrev}%
          </p>
          <p className="text-xs text-text-secondary mt-1">vs mês anterior</p>
        </GlassCard>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart – Cost by Service */}
        <GlassCard>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Custo por Serviço Azure</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis
                  type="number"
                  stroke={axisStroke}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => formatBRL(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  stroke={axisStroke}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any) => [formatBRL(Number(value)), "Custo"]}
                />
                <Bar dataKey="custo" radius={[0, 4, 4, 0]}>
                  {barData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-text-secondary text-center py-12">Sem dados</p>
          )}
        </GlassCard>

        {/* Pie/Donut Chart */}
        <GlassCard>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Distribuição por Serviço</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }: any) =>
                    `${name} (${((percent ?? 0) * 100).toFixed(1)}%)`
                  }
                  labelLine={{ stroke: axisStroke }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any) => [formatBRL(Number(value)), "Custo"]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-text-secondary text-center py-12">Sem dados</p>
          )}
        </GlassCard>
      </div>

      {/* Stacked Bar Chart – Monthly Trend */}
      {d.monthlyTrend.length > 0 && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Evolução Mensal — Top 5 Serviços Azure
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={d.monthlyTrend} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="month" stroke={axisStroke} tick={{ fontSize: 11 }} />
              <YAxis
                stroke={axisStroke}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => formatBRL(v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [formatBRL(Number(value)), ""]}
              />
              <Legend />
              {d.monthlyTrendKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="1"
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={i === d.monthlyTrendKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* Services Table */}
      <GlassCard>
        <h3 className="text-sm font-semibold text-text-primary mb-4">Detalhamento por Serviço Azure</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-text-secondary">
                <th
                  className="text-left py-3 px-3 cursor-pointer select-none"
                  onClick={() => handleSort("serviceName")}
                >
                  Serviço
                  <SortIcon field="serviceName" />
                </th>
                <th
                  className="text-right py-3 px-3 cursor-pointer select-none"
                  onClick={() => handleSort("cost")}
                >
                  Custo Ref.
                  <SortIcon field="cost" />
                </th>
                <th
                  className="text-right py-3 px-3 cursor-pointer select-none"
                  onClick={() => handleSort("prevCost")}
                >
                  Custo Anterior
                  <SortIcon field="prevCost" />
                </th>
                <th
                  className="text-right py-3 px-3 cursor-pointer select-none"
                  onClick={() => handleSort("variation")}
                >
                  Variação %
                  <SortIcon field="variation" />
                </th>
                <th
                  className="text-right py-3 px-3 cursor-pointer select-none"
                  onClick={() => handleSort("resources")}
                >
                  Recursos
                  <SortIcon field="resources" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedServices.map((s) => (
                <tr
                  key={s.serviceName}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="py-3 px-3 text-text-primary font-medium">{s.serviceName}</td>
                  <td className="text-right py-3 px-3 text-text-primary font-mono">
                    {formatBRL(s.cost)}
                  </td>
                  <td className="text-right py-3 px-3 text-text-secondary font-mono">
                    {formatBRL(s.prevCost)}
                  </td>
                  <td className="text-right py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        s.variation > 0
                          ? "text-red-400"
                          : s.variation < 0
                            ? "text-green-400"
                            : "text-text-secondary"
                      }`}
                    >
                      {s.variation > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : s.variation < 0 ? (
                        <ArrowDownRight className="h-3 w-3" />
                      ) : null}
                      {s.variation > 0 ? "+" : ""}
                      {s.variation}%
                    </span>
                  </td>
                  <td className="text-right py-3 px-3 text-text-secondary">{s.resources}</td>
                </tr>
              ))}
              {sortedServices.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-text-secondary">
                    Nenhum serviço encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
