"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  Package,
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
  Search,
  X,
} from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ResourceEntry {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  resourceGroup: string;
  serviceName: string;
  meterCategory: string;
  cost: number;
  prevCost: number;
  variation: number;
  entries: number;
}

interface InventoryDashboardData {
  referenceMonth: string;
  totalCost: number;
  resourceCount: number;
  variationVsPrev: number;
  topResource: { name: string; cost: number } | null;
  resources: ResourceEntry[];
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
// Sort & Filter
// ---------------------------------------------------------------------------
type SortField = "resourceName" | "serviceName" | "resourceGroup" | "cost" | "prevCost" | "variation";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function InventarioPage() {
  const [dashboard, setDashboard] = useState<InventoryDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("cost");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterRG, setFilterRG] = useState("");

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/inventario/dashboard");
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
  // Filter options (derived from data)
  // -------------------------------------------------------------------------
  const serviceOptions = useMemo(() => {
    if (!dashboard) return [];
    const set = new Set(dashboard.resources.map((r) => r.serviceName));
    return Array.from(set).sort();
  }, [dashboard]);

  const rgOptions = useMemo(() => {
    if (!dashboard) return [];
    const set = new Set(dashboard.resources.map((r) => r.resourceGroup));
    return Array.from(set).sort();
  }, [dashboard]);

  // -------------------------------------------------------------------------
  // Sort & filter
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

  const filteredAndSorted = useMemo(() => {
    if (!dashboard) return [];
    let items = [...dashboard.resources];

    // Search
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (r) =>
          r.resourceName.toLowerCase().includes(q) ||
          r.resourceId.toLowerCase().includes(q) ||
          r.resourceType.toLowerCase().includes(q) ||
          r.meterCategory.toLowerCase().includes(q)
      );
    }

    // Filters
    if (filterService) {
      items = items.filter((r) => r.serviceName === filterService);
    }
    if (filterRG) {
      items = items.filter((r) => r.resourceGroup === filterRG);
    }

    // Sort
    items.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortField === "resourceName") return mul * a.resourceName.localeCompare(b.resourceName);
      if (sortField === "serviceName") return mul * a.serviceName.localeCompare(b.serviceName);
      if (sortField === "resourceGroup") return mul * a.resourceGroup.localeCompare(b.resourceGroup);
      return mul * ((a[sortField] as number) - (b[sortField] as number));
    });

    return items;
  }, [dashboard, search, filterService, filterRG, sortField, sortDir]);

  // -------------------------------------------------------------------------
  // Chart data – top 15 resources bar chart
  // -------------------------------------------------------------------------
  const topBarData = useMemo(() => {
    if (!dashboard) return [];
    return [...dashboard.resources]
      .filter((r) => r.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 15)
      .map((r) => ({ name: r.resourceName, custo: r.cost }));
  }, [dashboard]);

  // Filtered totals
  const filteredTotal = filteredAndSorted.reduce((sum, r) => sum + r.cost, 0);
  const hasFilters = search || filterService || filterRG;

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
        <h1 className="text-2xl font-bold text-text-primary">Inventário</h1>
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
          <Package className="h-6 w-6 text-accent-cyan" />
          Inventário
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Custo por recurso individual — {d.referenceMonth}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Recursos</span>
            <Hash className="h-4 w-4 text-accent-cyan" />
          </div>
          <p className="text-2xl font-bold text-text-primary">{d.resourceCount}</p>
          <p className="text-xs text-text-secondary mt-1">Recursos individuais com custo</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Recurso Mais Caro</span>
            <Award className="h-4 w-4 text-accent-pink" />
          </div>
          <p className="text-lg font-bold text-text-primary truncate">
            {d.topResource?.name ?? "—"}
          </p>
          <p className="text-sm text-accent-purple mt-1">
            {d.topResource ? formatBRL(d.topResource.cost) : "—"}
          </p>
        </GlassCard>

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

      {/* Top Resources Bar Chart */}
      {topBarData.length > 0 && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Top 15 Recursos por Custo
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
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
                width={180}
                stroke={axisStroke}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [formatBRL(Number(value)), "Custo"]}
              />
              <Bar dataKey="custo" radius={[0, 4, 4, 0]}>
                {topBarData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* Monthly Trend – Stacked Bar */}
      {d.monthlyTrend.length > 0 && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Evolução Mensal — Top 10 Recursos
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
              <Legend wrapperStyle={{ fontSize: 11 }} />
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

      {/* Filters + Table */}
      <GlassCard>
        <div className="flex flex-col gap-4 mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Todos os Recursos</h3>

          {/* Search & Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Buscar por nome, ID, tipo..."
                className="glass-input w-full pl-9 pr-8 py-2 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <select
              className="glass-input py-2 px-3 text-sm min-w-[160px]"
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
            >
              <option value="">Todos os serviços</option>
              {serviceOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              className="glass-input py-2 px-3 text-sm min-w-[160px]"
              value={filterRG}
              onChange={(e) => setFilterRG(e.target.value)}
            >
              <option value="">Todos os RGs</option>
              {rgOptions.map((rg) => (
                <option key={rg} value={rg}>
                  {rg}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>
                {filteredAndSorted.length} recurso{filteredAndSorted.length !== 1 ? "s" : ""} —{" "}
                {formatBRL(filteredTotal)}
              </span>
              <button
                onClick={() => {
                  setSearch("");
                  setFilterService("");
                  setFilterRG("");
                }}
                className="text-accent-purple hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-text-secondary">
                <th
                  className="text-left py-3 px-3 cursor-pointer select-none"
                  onClick={() => handleSort("resourceName")}
                >
                  Recurso
                  <SortIcon field="resourceName" />
                </th>
                <th
                  className="text-left py-3 px-3 cursor-pointer select-none"
                  onClick={() => handleSort("serviceName")}
                >
                  Serviço
                  <SortIcon field="serviceName" />
                </th>
                <th
                  className="text-left py-3 px-3 cursor-pointer select-none"
                  onClick={() => handleSort("resourceGroup")}
                >
                  Resource Group
                  <SortIcon field="resourceGroup" />
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
                  Anterior
                  <SortIcon field="prevCost" />
                </th>
                <th
                  className="text-right py-3 px-3 cursor-pointer select-none"
                  onClick={() => handleSort("variation")}
                >
                  Var. %
                  <SortIcon field="variation" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((r) => (
                <tr
                  key={r.resourceId}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="py-3 px-3">
                    <div>
                      <span className="text-text-primary font-medium">{r.resourceName}</span>
                      <span className="block text-xs text-text-secondary">{r.resourceType}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-text-secondary text-xs">{r.serviceName}</td>
                  <td className="py-3 px-3 text-text-secondary text-xs">{r.resourceGroup}</td>
                  <td className="text-right py-3 px-3 text-text-primary font-mono">
                    {formatBRL(r.cost)}
                  </td>
                  <td className="text-right py-3 px-3 text-text-secondary font-mono">
                    {formatBRL(r.prevCost)}
                  </td>
                  <td className="text-right py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        r.variation > 0
                          ? "text-red-400"
                          : r.variation < 0
                            ? "text-green-400"
                            : "text-text-secondary"
                      }`}
                    >
                      {r.variation > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : r.variation < 0 ? (
                        <ArrowDownRight className="h-3 w-3" />
                      ) : null}
                      {r.variation > 0 ? "+" : ""}
                      {r.variation}%
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-text-secondary">
                    Nenhum recurso encontrado
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
