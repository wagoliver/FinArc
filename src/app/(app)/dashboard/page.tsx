"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/glass/glass-card";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Server,
  Users,
  Package,
  MoreHorizontal,
  Bell,
  Cloud,
  Target,
  Plus,
  AlertTriangle,
  Upload,
  GitCompareArrows,
} from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import type { DashboardData } from "@/types";
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
} from "recharts";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Workload: <Server className="h-4 w-4" />,
  Pessoas: <Users className="h-4 w-4" />,
  Software: <Package className="h-4 w-4" />,
  Outros: <MoreHorizontal className="h-4 w-4" />,
};

const CHART_STYLES = {
  tooltip: {
    background: "var(--color-surface-1)",
    border: "1px solid var(--color-border-glass)",
    borderRadius: "0.75rem",
    color: "var(--color-text-primary)",
    fontSize: "0.8rem",
  },
  gridStroke: "var(--color-border-glass)",
  axisStroke: "var(--color-text-muted)",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar dados");
        return res.json();
      })
      .then((res) => {
        if (res.success) setData(res.data);
        else throw new Error(res.error || "Erro desconhecido");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-10 w-10 text-warning" />
        <p className="text-sm text-text-secondary">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-border-glass px-4 py-2 text-sm text-text-secondary hover:bg-surface-2"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const d = data || {
    totalCosts: 0,
    monthlyVariation: 0,
    costsByCategory: [],
    monthlyCosts: [],
    recentTransactions: [],
    alerts: [],
    budgetProgress: [],
  };

  const variationPositive = d.monthlyVariation > 0;
  const totalCategories = d.costsByCategory.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary">
            Visão geral dos custos operacionais
          </p>
        </div>
        <a
          href="/custos?new=true"
          className="btn-accent flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          Novo Custo
        </a>
      </div>

      {/* Bento Grid */}
      <div className="bento-grid">
        {/* Total Costs */}
        <GlassCard className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Total de Custos</span>
            <div className="rounded-lg bg-accent-purple/15 p-2">
              <DollarSign className="h-4 w-4 text-accent-purple" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">
              {formatBRL(d.totalCosts)}
            </p>
            <p className="mt-1 text-xs text-text-muted">Mês atual</p>
          </div>
        </GlassCard>

        {/* Monthly Variation */}
        <GlassCard className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Variação Mensal</span>
            <div
              className={`rounded-lg p-2 ${
                variationPositive ? "bg-danger/15" : "bg-success/15"
              }`}
            >
              {variationPositive ? (
                <TrendingUp className="h-4 w-4 text-danger" />
              ) : (
                <TrendingDown className="h-4 w-4 text-success" />
              )}
            </div>
          </div>
          <div>
            <p
              className={`text-2xl font-bold ${
                variationPositive ? "text-danger" : "text-success"
              }`}
            >
              {variationPositive ? "+" : ""}
              {d.monthlyVariation.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-text-muted">vs. mês anterior</p>
          </div>
        </GlassCard>

        {/* Trend Chart — single unified chart (removed duplicate BarChart) */}
        <GlassCard className="bento-card bento-card-wide flex flex-col">
          <span className="mb-3 text-sm font-medium text-text-secondary">
            Tendência de Custos
          </span>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.monthlyCosts}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_STYLES.gridStroke}
                />
                <XAxis
                  dataKey="month"
                  stroke={CHART_STYLES.axisStroke}
                  fontSize={11}
                />
                <YAxis
                  stroke={CHART_STYLES.axisStroke}
                  fontSize={11}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={CHART_STYLES.tooltip}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [formatBRL(Number(value)), "Total"]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#2563EB"
                  fill="url(#colorTotal)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Categories — unified donut + legend (merged two cards into one) */}
        <GlassCard className="bento-card bento-card-wide flex flex-col">
          <span className="mb-3 text-sm font-medium text-text-secondary">
            Custos por Categoria
          </span>
          {d.costsByCategory.length > 0 ? (
            <div className="flex flex-1 items-center gap-6">
              <div className="h-full w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={d.costsByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      dataKey="total"
                      nameKey="category"
                      strokeWidth={0}
                    >
                      {d.costsByCategory.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_STYLES.tooltip}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [formatBRL(Number(value)), ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2.5">
                {d.costsByCategory.map((cat) => {
                  const pct = totalCategories > 0
                    ? ((cat.total / totalCategories) * 100).toFixed(0)
                    : "0";
                  return (
                    <div
                      key={cat.category}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${cat.color}20` }}
                        >
                          <span style={{ color: cat.color }}>
                            {CATEGORY_ICONS[cat.category] || (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </span>
                        </div>
                        <span className="text-sm text-text-primary">
                          {cat.category}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-text-primary">
                          {formatBRL(cat.total)}
                        </span>
                        <span className="ml-2 text-xs text-text-muted">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-text-muted">
              Sem dados
            </div>
          )}
        </GlassCard>

        {/* Recent Transactions */}
        <GlassCard className="bento-card flex flex-col">
          <span className="mb-3 text-sm font-medium text-text-secondary">
            Transações Recentes
          </span>
          <div className="flex-1 space-y-2 overflow-auto">
            {d.recentTransactions.length > 0 ? (
              d.recentTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-surface-2/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">
                      {tx.description}
                    </p>
                    <p className="text-xs text-text-muted">{tx.category}</p>
                  </div>
                  <span className="ml-2 shrink-0 text-sm font-medium text-text-primary">
                    {formatBRL(tx.amount)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-text-muted">
                Sem transações
              </div>
            )}
          </div>
        </GlassCard>

        {/* Alerts */}
        <GlassCard className="bento-card flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">
              Alertas
            </span>
            <Bell className="h-4 w-4 text-text-muted" />
          </div>
          <div className="flex-1 space-y-2 overflow-auto">
            {d.alerts.length > 0 ? (
              d.alerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border border-border-glass p-2.5"
                >
                  <p className="text-xs font-medium text-warning">
                    {alert.title}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {alert.message}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-text-muted">
                Nenhum alerta
              </div>
            )}
          </div>
        </GlassCard>

        {/* Budget Progress */}
        <GlassCard className="bento-card flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">
              Orçamentos
            </span>
            <Target className="h-4 w-4 text-text-muted" />
          </div>
          <div className="flex-1 space-y-3">
            {d.budgetProgress.length > 0 ? (
              d.budgetProgress.slice(0, 3).map((budget) => (
                <div key={budget.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">{budget.name}</span>
                    <span className="text-text-muted">
                      {budget.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(budget.percentage, 100)}%`,
                        backgroundColor:
                          budget.percentage > 90
                            ? "var(--color-danger)"
                            : budget.percentage > 70
                            ? "var(--color-warning)"
                            : "#2563EB",
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-text-muted">
                Sem orçamentos
              </div>
            )}
          </div>
        </GlassCard>

        {/* Azure Status — improved with context */}
        <GlassCard className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Azure Cloud</span>
            <Cloud className="h-4 w-4 text-accent-blue" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-text-muted" />
              <span className="text-sm text-text-secondary">
                Não conectado
              </span>
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              Conecte sua conta Azure para importar custos de cloud automaticamente.
            </p>
            <a
              href="/azure"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-blue hover:underline"
            >
              Conectar Azure <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </GlassCard>

        {/* Quick Actions — deduplicated, grouped by context */}
        <GlassCard className="bento-card flex flex-col">
          <span className="mb-3 text-sm font-medium text-text-secondary">
            Ações Rápidas
          </span>
          <div className="flex flex-1 flex-col gap-2">
            {[
              { label: "Importar OFX/CSV", href: "/importacao", icon: Upload },
              { label: "Conciliar Lançamentos", href: "/conciliacao", icon: GitCompareArrows },
              { label: "Ver Relatórios", href: "/relatorios", icon: ArrowUpRight },
              { label: "Conectar Azure", href: "/azure", icon: Cloud },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="flex items-center gap-2 rounded-lg p-2 text-sm text-text-secondary transition-colors hover:bg-surface-2/40 hover:text-text-primary"
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </a>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
