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
  BarChart,
  Bar,
} from "recharts";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Workload: <Server className="h-4 w-4" />,
  Pessoas: <Users className="h-4 w-4" />,
  Software: <Package className="h-4 w-4" />,
  Outros: <MoreHorizontal className="h-4 w-4" />,
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
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

        {/* Trend Chart */}
        <GlassCard className="bento-card bento-card-wide flex flex-col">
          <span className="mb-3 text-sm font-medium text-text-secondary">
            Tendência de Custos
          </span>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.monthlyCosts}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="oklch(0.65 0.25 290)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor="oklch(0.65 0.25 290)"
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
                    `R$${(v / 1000).toFixed(0)}k`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.17 0.02 260 / 0.9)",
                    border: "1px solid oklch(0.4 0.02 260 / 0.3)",
                    borderRadius: "0.75rem",
                    color: "oklch(0.95 0.01 260)",
                    fontSize: "0.8rem",
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [formatBRL(Number(value)), "Total"]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="oklch(0.65 0.25 290)"
                  fill="url(#colorTotal)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Category Donut */}
        <GlassCard className="bento-card flex flex-col">
          <span className="mb-3 text-sm font-medium text-text-secondary">
            Por Categoria
          </span>
          <div className="flex-1">
            {d.costsByCategory.length > 0 ? (
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
                    contentStyle={{
                      background: "oklch(0.17 0.02 260 / 0.9)",
                      border: "1px solid oklch(0.4 0.02 260 / 0.3)",
                      borderRadius: "0.75rem",
                      color: "oklch(0.95 0.01 260)",
                      fontSize: "0.8rem",
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [formatBRL(Number(value)), ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-text-muted">
                Sem dados
              </div>
            )}
          </div>
        </GlassCard>

        {/* Category List */}
        <GlassCard className="bento-card flex flex-col">
          <span className="mb-3 text-sm font-medium text-text-secondary">
            Categorias
          </span>
          <div className="flex-1 space-y-3">
            {d.costsByCategory.length > 0 ? (
              d.costsByCategory.map((cat) => (
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
                  <span className="text-sm font-medium text-text-primary">
                    {formatBRL(cat.total)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-text-muted">
                Sem dados
              </div>
            )}
          </div>
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

        {/* Monthly Bars */}
        <GlassCard className="bento-card bento-card-wide flex flex-col">
          <span className="mb-3 text-sm font-medium text-text-secondary">
            Custos Mensais
          </span>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.monthlyCosts}>
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
                    `R$${(v / 1000).toFixed(0)}k`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.17 0.02 260 / 0.9)",
                    border: "1px solid oklch(0.4 0.02 260 / 0.3)",
                    borderRadius: "0.75rem",
                    color: "oklch(0.95 0.01 260)",
                    fontSize: "0.8rem",
                  }}
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
          </div>
        </GlassCard>

        {/* Azure Status */}
        <GlassCard className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Azure Status</span>
            <Cloud className="h-4 w-4 text-accent-blue" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-text-muted" />
              <span className="text-sm text-text-secondary">
                Não configurado
              </span>
            </div>
            <a
              href="/azure"
              className="mt-2 flex items-center gap-1 text-xs text-accent-blue hover:underline"
            >
              Configurar <ArrowUpRight className="h-3 w-3" />
            </a>
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
                            ? "oklch(0.65 0.25 25)"
                            : budget.percentage > 70
                            ? "oklch(0.75 0.15 80)"
                            : "oklch(0.65 0.25 290)",
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

        {/* Quick Actions */}
        <GlassCard className="bento-card flex flex-col">
          <span className="mb-3 text-sm font-medium text-text-secondary">
            Ações Rápidas
          </span>
          <div className="flex flex-1 flex-col gap-2">
            {[
              { label: "Novo Custo", href: "/custos?new=true", icon: Plus },
              { label: "Importar OFX/CSV", href: "/importacao", icon: ArrowUpRight },
              { label: "Sync Azure", href: "/azure", icon: Cloud },
              { label: "Conciliar", href: "/conciliacao", icon: Target },
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
