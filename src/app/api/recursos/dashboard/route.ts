import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET – Resources dashboard (cost allocation by Azure Service Name)
// Uses only closed months (same pattern as other dashboards)
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
      costByServiceRef,
      costByServiceComp,
      monthlyTrendRaw,
      resourceCountByService,
    ] = await Promise.all([
      // Cost by service name – reference month
      prisma.costEntry.groupBy({
        by: ["azureServiceName"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
          azureServiceName: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      }),

      // Cost by service name – comparison month
      prisma.costEntry.groupBy({
        by: ["azureServiceName"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: comparisonMonthStart, lte: comparisonMonthEnd },
          azureServiceName: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      }),

      // Monthly trend by service (12 closed months)
      prisma.$queryRaw<{ month: Date; service: string; total: Prisma.Decimal }[]>`
        SELECT
          date_trunc('month', date) AS month,
          azure_service_name AS service,
          SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${twelveMonthsAgo}
          AND date < ${currentMonthStart}
          AND azure_service_name IS NOT NULL
        GROUP BY date_trunc('month', date), azure_service_name
        ORDER BY month ASC
      `,

      // Distinct resource count per service (reference month)
      prisma.$queryRaw<{ service: string; resource_count: bigint }[]>`
        SELECT
          azure_service_name AS service,
          COUNT(DISTINCT azure_resource_id) AS resource_count
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${referenceMonthStart}
          AND date <= ${referenceMonthEnd}
          AND azure_service_name IS NOT NULL
          AND azure_resource_id IS NOT NULL
        GROUP BY azure_service_name
      `,
    ]);

    // Build resource count map
    const resourceCountMap = new Map<string, number>();
    for (const r of resourceCountByService) {
      resourceCountMap.set(r.service, Number(r.resource_count));
    }

    // Build comparison map
    const compMap = new Map<string, number>();
    for (const r of costByServiceComp) {
      if (r.azureServiceName) {
        compMap.set(r.azureServiceName, Number(r._sum.amount ?? 0));
      }
    }

    // Build services array
    let totalCost = 0;
    const services = costByServiceRef.map((r) => {
      const name = r.azureServiceName ?? "Desconhecido";
      const cost = Number(r._sum.amount ?? 0);
      const prevCost = compMap.get(name) ?? 0;
      const variation = prevCost > 0 ? ((cost - prevCost) / prevCost) * 100 : cost > 0 ? 100 : 0;
      totalCost += cost;

      return {
        serviceName: name,
        cost: Math.round(cost * 100) / 100,
        prevCost: Math.round(prevCost * 100) / 100,
        variation: Math.round(variation * 10) / 10,
        entries: r._count,
        resources: resourceCountMap.get(name) ?? 0,
      };
    });

    // Include services that existed in comparison but not in reference
    for (const [name, prevCost] of compMap) {
      if (!costByServiceRef.some((r) => r.azureServiceName === name)) {
        services.push({
          serviceName: name,
          cost: 0,
          prevCost: Math.round(prevCost * 100) / 100,
          variation: -100,
          entries: 0,
          resources: 0,
        });
      }
    }

    // Totals
    const totalPrev = Array.from(compMap.values()).reduce((a, b) => a + b, 0);
    const variationVsPrev = totalPrev > 0 ? ((totalCost - totalPrev) / totalPrev) * 100 : 0;

    const topService = services.length > 0
      ? { name: services[0].serviceName, cost: services[0].cost }
      : null;

    // Monthly trend – pivot by service (top 5)
    const serviceTotalAgg: Record<string, number> = {};
    for (const row of monthlyTrendRaw) {
      serviceTotalAgg[row.service] = (serviceTotalAgg[row.service] || 0) + Number(row.total);
    }
    const top5Services = Object.entries(serviceTotalAgg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const monthMap = new Map<string, Record<string, number | string>>();
    for (const row of monthlyTrendRaw) {
      if (!top5Services.includes(row.service)) continue;
      const monthKey = new Date(row.month).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { month: monthKey });
      }
      monthMap.get(monthKey)![row.service] = Number(row.total);
    }

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
        monthlyTrend: Array.from(monthMap.values()),
        monthlyTrendKeys: top5Services,
      },
    });
  } catch (error) {
    console.error("Resources dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar dados do dashboard de recursos" },
      { status: 500 }
    );
  }
}
