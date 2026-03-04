import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET – Services dashboard (cost allocation by Resource Group)
// Uses only closed months (same pattern as Azure dashboard)
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const referenceMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const referenceMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const comparisonMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const comparisonMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

    const [
      costByRgRef,
      costByRgComp,
      monthlyTrendRaw,
      resourceCountByRg,
      aliases,
    ] = await Promise.all([
      // Cost by RG – reference month
      prisma.costEntry.groupBy({
        by: ["azureResourceGroup"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
          azureResourceGroup: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      }),

      // Cost by RG – comparison month
      prisma.costEntry.groupBy({
        by: ["azureResourceGroup"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: comparisonMonthStart, lte: comparisonMonthEnd },
          azureResourceGroup: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      }),

      // Monthly trend by RG (12 closed months)
      prisma.$queryRaw<{ month: Date; rg: string; total: Prisma.Decimal }[]>`
        SELECT
          date_trunc('month', date) AS month,
          azure_resource_group AS rg,
          SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${twelveMonthsAgo}
          AND date < ${currentMonthStart}
          AND azure_resource_group IS NOT NULL
        GROUP BY date_trunc('month', date), azure_resource_group
        ORDER BY month ASC
      `,

      // Distinct resource count per RG (reference month)
      prisma.$queryRaw<{ rg: string; resource_count: bigint }[]>`
        SELECT
          azure_resource_group AS rg,
          COUNT(DISTINCT azure_resource_id) AS resource_count
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${referenceMonthStart}
          AND date <= ${referenceMonthEnd}
          AND azure_resource_group IS NOT NULL
          AND azure_resource_id IS NOT NULL
        GROUP BY azure_resource_group
      `,

      // Aliases
      prisma.serviceAlias.findMany(),
    ]);

    // Build alias map
    const aliasMap = new Map<string, { alias: string; color?: string | null }>();
    for (const a of aliases) {
      aliasMap.set(a.resourceGroup, { alias: a.alias, color: a.color });
    }

    // Build resource count map
    const resourceCountMap = new Map<string, number>();
    for (const r of resourceCountByRg) {
      resourceCountMap.set(r.rg, Number(r.resource_count));
    }

    // Build comparison map
    const compMap = new Map<string, number>();
    for (const r of costByRgComp) {
      if (r.azureResourceGroup) {
        compMap.set(r.azureResourceGroup, Number(r._sum.amount ?? 0));
      }
    }

    // Build services array
    let totalCost = 0;
    const services = costByRgRef.map((r) => {
      const rg = r.azureResourceGroup ?? "Desconhecido";
      const cost = Number(r._sum.amount ?? 0);
      const prevCost = compMap.get(rg) ?? 0;
      const variation = prevCost > 0 ? ((cost - prevCost) / prevCost) * 100 : cost > 0 ? 100 : 0;
      totalCost += cost;

      const aliasInfo = aliasMap.get(rg);
      return {
        resourceGroup: rg,
        displayName: aliasInfo?.alias ?? rg,
        color: aliasInfo?.color ?? null,
        cost: Math.round(cost * 100) / 100,
        prevCost: Math.round(prevCost * 100) / 100,
        variation: Math.round(variation * 10) / 10,
        entries: r._count,
        resources: resourceCountMap.get(rg) ?? 0,
      };
    });

    // Also include services that existed in comparison but not in reference (shrunk to 0)
    for (const [rg, prevCost] of compMap) {
      if (!costByRgRef.some((r) => r.azureResourceGroup === rg)) {
        const aliasInfo = aliasMap.get(rg);
        services.push({
          resourceGroup: rg,
          displayName: aliasInfo?.alias ?? rg,
          color: aliasInfo?.color ?? null,
          cost: 0,
          prevCost: Math.round(prevCost * 100) / 100,
          variation: -100,
          entries: 0,
          resources: 0,
        });
      }
    }

    // Total previous
    const totalPrev = Array.from(compMap.values()).reduce((a, b) => a + b, 0);
    const variationVsPrev = totalPrev > 0 ? ((totalCost - totalPrev) / totalPrev) * 100 : 0;

    // Top service
    const topService = services.length > 0
      ? { name: services[0].displayName, cost: services[0].cost }
      : null;

    // Monthly trend – pivot by RG (top 5 by total across all months)
    const rgTotalAgg: Record<string, number> = {};
    for (const row of monthlyTrendRaw) {
      rgTotalAgg[row.rg] = (rgTotalAgg[row.rg] || 0) + Number(row.total);
    }
    const top5RGs = Object.entries(rgTotalAgg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const monthMap = new Map<string, Record<string, number | string>>();
    for (const row of monthlyTrendRaw) {
      if (!top5RGs.includes(row.rg)) continue;
      const monthKey = new Date(row.month).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { month: monthKey });
      }
      const entry = monthMap.get(monthKey)!;
      const displayName = aliasMap.get(row.rg)?.alias ?? row.rg;
      entry[displayName] = Number(row.total);
    }
    const monthlyTrend = Array.from(monthMap.values());
    const monthlyTrendKeys = top5RGs.map((rg) => aliasMap.get(rg)?.alias ?? rg);

    return NextResponse.json({
      success: true,
      data: {
        referenceMonth: referenceMonthStart.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        }),
        totalCost: Math.round(totalCost * 100) / 100,
        serviceCount: services.filter((s) => s.cost > 0).length,
        topService,
        variationVsPrev: Math.round(variationVsPrev * 10) / 10,
        services,
        monthlyTrend,
        monthlyTrendKeys,
      },
    });
  } catch (error) {
    console.error("Services dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar dados do dashboard de serviços" },
      { status: 500 }
    );
  }
}
