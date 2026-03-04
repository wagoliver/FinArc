"use client";

import { useEffect, useState, useCallback } from "react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  BarChart3,
  DollarSign,
  Download,
  Filter,
  Hash,
  TrendingUp,
} from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CategoryData {
  categoryId: string;
  category: string;
  color: string;
  total: number;
  count: number;
}

interface MonthData {
  month: string;
  label: string;
  total: number;
}

interface SourceData {
  source: string;
  label: string;
  total: number;
  count: number;
}

interface EntryData {
  id: string;
  description: string;
  amount: number;
  date: string;
  source: string;
  category: { id: string; name: string; color: string };
}

interface ReportData {
  summary: {
    totalCosts: number;
    count: number;
    avgCost: number;
  };
  byCategory: CategoryData[];
  byMonth: MonthData[];
  bySource: SourceData[];
  entries: EntryData[];
}

interface CategoryOption {
  id: string;
  name: string;
}

const TOOLTIP_STYLE = {
  background: "oklch(0.17 0.02 260 / 0.9)",
  border: "1px solid oklch(0.4 0.02 260 / 0.3)",
  borderRadius: "0.75rem",
  color: "oklch(0.95 0.01 260)",
  fontSize: "0.8rem",
};

const PIE_COLORS = [
  "oklch(0.65 0.25 290)",
  "oklch(0.65 0.2 250)",
  "oklch(0.7 0.15 160)",
  "oklch(0.75 0.15 80)",
  "oklch(0.65 0.25 25)",
  "oklch(0.6 0.2 330)",
  "oklch(0.7 0.2 200)",
  "oklch(0.65 0.15 120)",
];

export default function RelatoriosPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    categoryId: "",
    source: "",
  });

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categorias");
      const json = await res.json();
      if (json.success) setCategories(json.data);
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.source) params.set("source", filters.source);

      const res = await fetch(`/api/relatorios?${params.toString()}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (error) {
      console.error("Erro ao buscar relatório:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.source) params.set("source", filters.source);
    params.set("format", "csv");

    window.open(`/api/relatorios?${params.toString()}`, "_blank");
  };

  if (loading && !data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
      </div>
    );
  }

  const d = data || {
    summary: { totalCosts: 0, count: 0, avgCost: 0 },
    byCategory: [],
    byMonth: [],
    bySource: [],
    entries: [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Relatórios</h1>
          <p className="text-sm text-text-secondary">
            Análise detalhada dos custos operacionais
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="btn-accent flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {/* Filter Bar */}
      <GlassCard variant="subtle">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-medium text-text-secondary">Filtros</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              Data Início
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
              className="glass-input w-full px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              Data Fim
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
              className="glass-input w-full px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              Categoria
            </label>
            <select
              value={filters.categoryId}
              onChange={(e) =>
                setFilters({ ...filters, categoryId: e.target.value })
              }
              className="glass-input w-full px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Fonte</label>
            <select
              value={filters.source}
              onChange={(e) =>
                setFilters({ ...filters, source: e.target.value })
              }
              className="glass-input w-full px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              <option value="MANUAL">Manual</option>
              <option value="AZURE_SYNC">Azure Sync</option>
              <option value="OFX_IMPORT">Importação OFX</option>
              <option value="CSV_IMPORT">Importação CSV</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <GlassCard className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-secondary">Total</p>
            <p className="text-2xl font-bold text-text-primary">
              {formatBRL(d.summary.totalCosts)}
            </p>
          </div>
          <div className="rounded-lg bg-accent-purple/15 p-3">
            <DollarSign className="h-5 w-5 text-accent-purple" />
          </div>
        </GlassCard>

        <GlassCard className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-secondary">Quantidade</p>
            <p className="text-2xl font-bold text-text-primary">
              {d.summary.count}
            </p>
          </div>
          <div className="rounded-lg bg-accent-blue/15 p-3">
            <Hash className="h-5 w-5 text-accent-blue" />
          </div>
        </GlassCard>

        <GlassCard className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-secondary">Média</p>
            <p className="text-2xl font-bold text-text-primary">
              {formatBRL(d.summary.avgCost)}
            </p>
          </div>
          <div className="rounded-lg bg-success/15 p-3">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
        </GlassCard>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Bar Chart - By Month */}
        <GlassCard>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-text-muted" />
            <h3 className="text-sm font-medium text-text-secondary">
              Custos por Mês
            </h3>
          </div>
          <div className="h-[300px]">
            {d.byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.byMonth}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.3 0.02 260 / 0.3)"
                  />
                  <XAxis
                    dataKey="label"
                    stroke="oklch(0.5 0.02 260)"
                    fontSize={11}
                  />
                  <YAxis
                    stroke="oklch(0.5 0.02 260)"
                    fontSize={11}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [formatBRL(Number(value)), "Total"]}
                  />
                  <Bar
                    dataKey="total"
                    fill="oklch(0.65 0.2 250)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                Sem dados para o período selecionado
              </div>
            )}
          </div>
        </GlassCard>

        {/* Pie Chart - By Category */}
        <GlassCard>
          <h3 className="mb-3 text-sm font-medium text-text-secondary">
            Custos por Categoria
          </h3>
          <div className="h-[300px]">
            {d.byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={d.byCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="total"
                    nameKey="category"
                    strokeWidth={0}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ name, percent }: any) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {d.byCategory.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [formatBRL(Number(value)), ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                Sem dados para o período selecionado
              </div>
            )}
          </div>
          {d.byCategory.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {d.byCategory.map((cat, i) => (
                <div key={cat.categoryId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor:
                          cat.color || PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                    <span className="text-xs text-text-secondary">
                      {cat.category}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-text-primary">
                    {formatBRL(cat.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Entries Table */}
      <GlassCard>
        <h3 className="mb-4 text-sm font-medium text-text-secondary">
          Lançamentos ({d.entries.length})
        </h3>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-glass text-left">
                <th className="px-3 py-2 text-xs font-medium text-text-muted">
                  Data
                </th>
                <th className="px-3 py-2 text-xs font-medium text-text-muted">
                  Descrição
                </th>
                <th className="px-3 py-2 text-xs font-medium text-text-muted">
                  Categoria
                </th>
                <th className="px-3 py-2 text-xs font-medium text-text-muted">
                  Fonte
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-text-muted">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {d.entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-text-muted"
                  >
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              ) : (
                d.entries.slice(0, 50).map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border-glass/50 hover:bg-surface-2/30"
                  >
                    <td className="px-3 py-2.5 text-text-secondary">
                      {formatDateBR(entry.date)}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-text-primary">
                      {entry.description}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-text-secondary"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: entry.category.color }}
                        />
                        {entry.category.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-text-muted">
                      {entry.source === "MANUAL"
                        ? "Manual"
                        : entry.source === "AZURE_SYNC"
                        ? "Azure"
                        : entry.source === "OFX_IMPORT"
                        ? "OFX"
                        : "CSV"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-text-primary">
                      {formatBRL(entry.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {d.entries.length > 50 && (
            <p className="mt-3 text-center text-xs text-text-muted">
              Exibindo 50 de {d.entries.length} lançamentos. Exporte o CSV para ver
              todos.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
