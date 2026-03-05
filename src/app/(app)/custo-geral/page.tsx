"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Cloud,
  Database,
  Layers,
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
  ReferenceLine,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CloudCostsData {
  referenceMonth: string;
  totalCloud: number;
  totalAzure: number;
  totalMongo: number;
  variationCloud: number;
  variationAzure: number;
  variationMongo: number;
  monthlyTrend: { month: string; azure: number; mongo: number; total: number }[];
  topAzureServices: { name: string; total: number }[];
  topMongoClusters: { name: string; total: number }[];
  byCategory: { category: string; color: string; total: number }[];
}

// ---------------------------------------------------------------------------
// Chart styles
// ---------------------------------------------------------------------------
const AZURE_COLOR = "#2563EB";
const MONGO_COLOR = "#10B981";

const AZURE_COLORS = ["#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];
const MONGO_COLORS = ["#10B981", "#34D399", "#6EE7B7", "#A7F3D0", "#D1FAE5"];

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
// Component
// ---------------------------------------------------------------------------
export default function CustoGeralPage() {
  const [data, setData] = useState<CloudCostsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/custo-geral")
      .then((res) => res.json())
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const monthlyAvg = useMemo(() => {
    if (!data?.monthlyTrend?.length) return 0;
    return (
      data.monthlyTrend.reduce((sum, m) => sum + m.total, 0) /
      data.monthlyTrend.length
    );
  }, [data]);

  const providerDistribution = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Azure", value: data.totalAzure, color: AZURE_COLOR },
      { name: "MongoDB", value: data.totalMongo, color: MONGO_COLOR },
    ].filter((d) => d.value > 0);
  }, [data]);

  // -------------------------------------------------------------------------
  // Variation badge
  // -------------------------------------------------------------------------
  const VariationBadge = ({ value }: { value: number }) => {
    if (value === 0) {
      return <span className="text-xs text-text-muted">vs. mês anterior</span>;
    }
    const isUp = value > 0;
    return (
      <div className="flex items-center gap-1">
        {isUp ? (
          <TrendingUp className="h-3 w-3 text-danger" />
        ) : (
          <TrendingDown className="h-3 w-3 text-success" />
        )}
        <span
          className={`text-xs font-medium ${isUp ? "text-danger" : "text-success"}`}
        >
          {isUp ? "+" : ""}
          {value.toFixed(1)}%
        </span>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <GlassCard className="py-12 text-center">
          <Layers className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-sm text-text-secondary">
            Nenhum dado disponível. Sincronize Azure e/ou MongoDB primeiro.
          </p>
        </GlassCard>
      </div>
    );
  }

  const azurePercent =
    data.totalCloud > 0
      ? ((data.totalAzure / data.totalCloud) * 100).toFixed(0)
      : "0";
  const mongoPercent =
    data.totalCloud > 0
      ? ((data.totalMongo / data.totalCloud) * 100).toFixed(0)
      : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-50 p-2">
            <Layers className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">
              Custo Geral Cloud
            </h1>
            <p className="text-xs text-text-muted">
              {data.referenceMonth
                ? `Ref.: ${data.referenceMonth}`
                : "Azure + MongoDB consolidado"}
              {" · "}
              <span className="text-amber-600">MongoDB convertido de USD via PTAX/BCB</span>
            </p>
          </div>
        </div>
      </GlassCard>

      {/* KPI Cards */}
      <div className="grid gap-4 xl:grid-cols-4 sm:grid-cols-2">
        {/* Total Cloud */}
        <GlassCard className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Total Cloud</span>
            <div className="rounded-lg bg-purple-50 p-1.5">
              <DollarSign className="h-3.5 w-3.5 text-purple-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-text-primary">
              {formatBRL(data.totalCloud)}
            </p>
            <VariationBadge value={data.variationCloud} />
          </div>
        </GlassCard>

        {/* Azure */}
        <GlassCard className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Azure</span>
            <div className="rounded-lg bg-blue-50 p-1.5">
              <Cloud className="h-3.5 w-3.5 text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-text-primary">
              {formatBRL(data.totalAzure)}
            </p>
            <VariationBadge value={data.variationAzure} />
          </div>
        </GlassCard>

        {/* MongoDB */}
        <GlassCard className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">MongoDB</span>
            <div className="rounded-lg bg-emerald-50 p-1.5">
              <Database className="h-3.5 w-3.5 text-emerald-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-bold text-text-primary">
              {formatBRL(data.totalMongo)}
            </p>
            <VariationBadge value={data.variationMongo} />
          </div>
        </GlassCard>

        {/* Proportion */}
        <GlassCard className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Proporção</span>
            <div className="rounded-lg bg-slate-100 p-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-600" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-blue-600">{azurePercent}%</span>
              <span className="text-xs text-text-muted">/</span>
              <span className="text-lg font-bold text-emerald-600">{mongoPercent}%</span>
            </div>
            <div className="mt-1.5 flex gap-2 text-[10px] text-text-muted">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                Azure
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
                MongoDB
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Stacked Monthly Trend */}
      {data.monthlyTrend.length > 0 && (
        <GlassCard className="flex flex-col">
          <span className="mb-4 text-sm font-medium text-text-secondary">
            Evolução Mensal — Azure vs MongoDB
          </span>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.monthlyTrend}
                margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
              >
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
                  formatter={(value: any, name: any) => [
                    formatBRL(Number(value)),
                    name === "azure" ? "Azure" : "MongoDB",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                  iconSize={10}
                  formatter={(value) =>
                    value === "azure" ? "Azure" : "MongoDB"
                  }
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
                  dataKey="azure"
                  stackId="cloud"
                  fill={AZURE_COLOR}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="mongo"
                  stackId="cloud"
                  fill={MONGO_COLOR}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Donuts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Provider Distribution */}
        {providerDistribution.length > 0 && (
          <GlassCard className="flex flex-col">
            <span className="mb-4 text-sm font-medium text-text-secondary">
              Distribuição por Provedor
            </span>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={providerDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={110}
                    paddingAngle={3}
                    label={({
                      name,
                      percent,
                    }: {
                      name?: string;
                      percent?: number;
                    }) => `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={true}
                    fontSize={11}
                  >
                    {providerDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [formatBRL(Number(value)), "Custo"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}

        {/* Category Distribution */}
        {data.byCategory.length > 0 && (
          <GlassCard className="flex flex-col">
            <span className="mb-4 text-sm font-medium text-text-secondary">
              Distribuição por Categoria
            </span>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byCategory}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={110}
                    paddingAngle={2}
                    label={({
                      name,
                      percent,
                    }: {
                      name?: string;
                      percent?: number;
                    }) =>
                      `${(name ?? "").length > 15 ? (name ?? "").slice(0, 15) + "…" : (name ?? "")} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                    labelLine={true}
                    fontSize={10}
                  >
                    {data.byCategory.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [formatBRL(Number(value)), "Custo"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Top Services / Clusters */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Azure Services */}
        {data.topAzureServices.length > 0 && (
          <GlassCard className="flex flex-col">
            <div className="mb-4 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-text-secondary">
                Top Azure Services
              </span>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topAzureServices}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    type="number"
                    stroke={axisStroke}
                    fontSize={11}
                    tickFormatter={(v) =>
                      v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                    }
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke={axisStroke}
                    fontSize={10}
                    width={130}
                    tickFormatter={(v: string) =>
                      v.length > 20 ? v.slice(0, 20) + "…" : v
                    }
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [formatBRL(Number(value)), "Custo"]}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {data.topAzureServices.map((_, i) => (
                      <Cell key={i} fill={AZURE_COLORS[i % AZURE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}

        {/* Top Mongo Clusters */}
        {data.topMongoClusters.length > 0 && (
          <GlassCard className="flex flex-col">
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-text-secondary">
                Top MongoDB Clusters
              </span>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topMongoClusters}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    type="number"
                    stroke={axisStroke}
                    fontSize={11}
                    tickFormatter={(v) =>
                      v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                    }
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke={axisStroke}
                    fontSize={10}
                    width={130}
                    tickFormatter={(v: string) =>
                      v.length > 20 ? v.slice(0, 20) + "…" : v
                    }
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [formatBRL(Number(value)), "Custo"]}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {data.topMongoClusters.map((_, i) => (
                      <Cell key={i} fill={MONGO_COLORS[i % MONGO_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Empty state */}
      {data.totalCloud === 0 && data.monthlyTrend.length === 0 && (
        <GlassCard className="py-12 text-center">
          <Layers className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-sm text-text-secondary">
            Nenhum custo cloud encontrado. Sincronize Azure e/ou MongoDB para
            visualizar os dados consolidados.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
