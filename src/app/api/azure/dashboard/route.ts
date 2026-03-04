import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET – Azure dashboard aggregations (FinOps-grade)
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
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Run all independent queries in parallel
    const [
      currentTotal,
      prevTotal,
      byServiceRaw,
      byRgRaw,
      byMeterRaw,
      monthlyTrendRaw,
      distinctServices,
      distinctRGs,
      topResources,
      totalEntries,
      dailyTrendRaw,
      prevByServiceRaw,
      allCurrentEntries,
      costStatsRaw,
    ] = await Promise.all([
      // Total current month
      prisma.costEntry.aggregate({
        where: {
          source: "AZURE_SYNC",
          date: { gte: currentMonthStart, lte: currentMonthEnd },
        },
        _sum: { amount: true },
      }),

      // Total previous month
      prisma.costEntry.aggregate({
        where: {
          source: "AZURE_SYNC",
          date: { gte: prevMonthStart, lte: prevMonthEnd },
        },
        _sum: { amount: true },
      }),

      // Top 10 by service name
      prisma.costEntry.groupBy({
        by: ["azureServiceName"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: currentMonthStart, lte: currentMonthEnd },
          azureServiceName: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),

      // Top 10 by resource group
      prisma.costEntry.groupBy({
        by: ["azureResourceGroup"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: currentMonthStart, lte: currentMonthEnd },
          azureResourceGroup: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),

      // Top 10 by meter category
      prisma.costEntry.groupBy({
        by: ["azureMeterCategory"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: currentMonthStart, lte: currentMonthEnd },
          azureMeterCategory: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),

      // Monthly trend (last 12 months)
      prisma.$queryRaw<{ month: Date; total: Prisma.Decimal }[]>`
        SELECT date_trunc('month', date) AS month, SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${twelveMonthsAgo}
        GROUP BY date_trunc('month', date)
        ORDER BY month ASC
      `,

      // Distinct services
      prisma.costEntry.groupBy({
        by: ["azureServiceName"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: currentMonthStart, lte: currentMonthEnd },
          azureServiceName: { not: null },
        },
      }),

      // Distinct resource groups
      prisma.costEntry.groupBy({
        by: ["azureResourceGroup"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: currentMonthStart, lte: currentMonthEnd },
          azureResourceGroup: { not: null },
        },
      }),

      // Top 20 resources with extended fields
      prisma.costEntry.findMany({
        where: {
          source: "AZURE_SYNC",
          date: { gte: currentMonthStart, lte: currentMonthEnd },
        },
        orderBy: { amount: "desc" },
        take: 20,
        select: {
          id: true,
          description: true,
          amount: true,
          date: true,
          azureServiceName: true,
          azureResourceGroup: true,
          azureMeterCategory: true,
          azureResourceId: true,
        },
      }),

      // Total entries count
      prisma.costEntry.count({
        where: { source: "AZURE_SYNC" },
      }),

      // Daily trend (last 30 days)
      prisma.$queryRaw<{ day: Date; total: Prisma.Decimal }[]>`
        SELECT date_trunc('day', date) AS day, SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${thirtyDaysAgo}
        GROUP BY date_trunc('day', date)
        ORDER BY day ASC
      `,

      // Previous month by service (for growth comparison)
      prisma.costEntry.groupBy({
        by: ["azureServiceName"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: prevMonthStart, lte: prevMonthEnd },
          azureServiceName: { not: null },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      }),

      // All current month entries for distribution histogram
      prisma.costEntry.findMany({
        where: {
          source: "AZURE_SYNC",
          date: { gte: currentMonthStart, lte: currentMonthEnd },
        },
        select: { amount: true },
      }),

      // Cost stats (min, max, avg, median, p95)
      prisma.$queryRaw<{ min_val: Prisma.Decimal; max_val: Prisma.Decimal; avg_val: Prisma.Decimal; median_val: Prisma.Decimal; p95_val: Prisma.Decimal }[]>`
        SELECT
          MIN(amount) AS min_val,
          MAX(amount) AS max_val,
          AVG(amount) AS avg_val,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) AS median_val,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY amount) AS p95_val
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${currentMonthStart}
          AND date <= ${currentMonthEnd}
      `,
    ]);

    // -----------------------------------------------------------------------
    // Process basic KPI data
    // -----------------------------------------------------------------------
    const totalAzure = Number(currentTotal._sum.amount ?? 0);
    const totalPrev = Number(prevTotal._sum.amount ?? 0);
    const variationVsPrev =
      totalPrev > 0 ? ((totalAzure - totalPrev) / totalPrev) * 100 : 0;

    const byService = byServiceRaw.map((r) => ({
      name: r.azureServiceName ?? "Desconhecido",
      total: Number(r._sum.amount ?? 0),
      count: r._count,
    }));

    const byResourceGroup = byRgRaw.map((r) => ({
      name: r.azureResourceGroup ?? "Desconhecido",
      total: Number(r._sum.amount ?? 0),
      count: r._count,
    }));

    const byMeterCategory = byMeterRaw.map((r) => ({
      name: r.azureMeterCategory ?? "Desconhecido",
      total: Number(r._sum.amount ?? 0),
      count: r._count,
    }));

    const monthlyTrend = monthlyTrendRaw.map((r) => {
      const d = new Date(r.month);
      return {
        month: d.toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        }),
        total: Number(r.total),
      };
    });

    // -----------------------------------------------------------------------
    // Daily trend (30 days)
    // -----------------------------------------------------------------------
    const dailyTrend = dailyTrendRaw.map((r) => ({
      day: new Date(r.day).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      total: Number(r.total),
    }));

    const dailyAmounts = dailyTrendRaw.map((r) => Number(r.total));
    const avgDailyCost =
      dailyAmounts.length > 0
        ? dailyAmounts.reduce((a, b) => a + b, 0) / dailyAmounts.length
        : 0;

    // Highest day
    let highestDayAmount = 0;
    let highestDayDate = "";
    if (dailyTrendRaw.length > 0) {
      const maxEntry = dailyTrendRaw.reduce((max, r) =>
        Number(r.total) > Number(max.total) ? r : max
      );
      highestDayAmount = Number(maxEntry.total);
      highestDayDate = new Date(maxEntry.day).toLocaleDateString("pt-BR");
    }

    // -----------------------------------------------------------------------
    // Service over time (top 5 services across months – stacked area)
    // -----------------------------------------------------------------------
    const serviceOverTimeRaw: { month: Date; service: string; total: Prisma.Decimal }[] =
      await prisma.$queryRaw`
        SELECT
          date_trunc('month', date) AS month,
          azure_service_name AS service,
          SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${twelveMonthsAgo}
          AND azure_service_name IS NOT NULL
        GROUP BY date_trunc('month', date), azure_service_name
        ORDER BY month ASC
      `;

    // Determine top 5 services by total across all months
    const serviceAgg: Record<string, number> = {};
    for (const row of serviceOverTimeRaw) {
      serviceAgg[row.service] = (serviceAgg[row.service] || 0) + Number(row.total);
    }
    const top5Services = Object.entries(serviceAgg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Pivot: each month row has keys for each service
    const monthMap = new Map<string, Record<string, number>>();
    for (const row of serviceOverTimeRaw) {
      if (!top5Services.includes(row.service)) continue;
      const monthKey = new Date(row.month).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, { month: monthKey } as unknown as Record<string, number>);
      const entry = monthMap.get(monthKey)!;
      entry[row.service] = Number(row.total);
    }
    const serviceOverTime = Array.from(monthMap.values());
    const serviceOverTimeKeys = top5Services;

    // -----------------------------------------------------------------------
    // Top growing / shrinking services
    // -----------------------------------------------------------------------
    const prevServiceMap = new Map<string, number>();
    for (const r of prevByServiceRaw) {
      if (r.azureServiceName) {
        prevServiceMap.set(r.azureServiceName, Number(r._sum.amount ?? 0));
      }
    }

    const currentServiceMap = new Map<string, number>();
    for (const r of byServiceRaw) {
      if (r.azureServiceName) {
        currentServiceMap.set(r.azureServiceName, Number(r._sum.amount ?? 0));
      }
    }

    const growthData: { name: string; current: number; previous: number; change: number; changePercent: number }[] = [];

    for (const [name, current] of currentServiceMap) {
      const previous = prevServiceMap.get(name) ?? 0;
      const change = current - previous;
      const changePercent = previous > 0 ? (change / previous) * 100 : (current > 0 ? 100 : 0);
      growthData.push({ name, current, previous, change, changePercent });
    }
    // Also include services that existed in prev but not in current (shrunk to 0)
    for (const [name, previous] of prevServiceMap) {
      if (!currentServiceMap.has(name)) {
        growthData.push({ name, current: 0, previous, change: -previous, changePercent: -100 });
      }
    }

    const topGrowing = growthData
      .filter((d) => d.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 5);

    const topShrinking = growthData
      .filter((d) => d.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 5);

    // -----------------------------------------------------------------------
    // Cost distribution histogram
    // -----------------------------------------------------------------------
    const buckets = [
      { label: "R$0–10", min: 0, max: 10, count: 0 },
      { label: "R$10–50", min: 10, max: 50, count: 0 },
      { label: "R$50–100", min: 50, max: 100, count: 0 },
      { label: "R$100–500", min: 100, max: 500, count: 0 },
      { label: "R$500+", min: 500, max: Infinity, count: 0 },
    ];

    for (const entry of allCurrentEntries) {
      const val = Number(entry.amount);
      for (const bucket of buckets) {
        if (val >= bucket.min && (val < bucket.max || bucket.max === Infinity)) {
          bucket.count++;
          break;
        }
      }
    }

    const stats = costStatsRaw[0]
      ? {
          min: Number(costStatsRaw[0].min_val ?? 0),
          max: Number(costStatsRaw[0].max_val ?? 0),
          avg: Number(costStatsRaw[0].avg_val ?? 0),
          median: Number(costStatsRaw[0].median_val ?? 0),
          p95: Number(costStatsRaw[0].p95_val ?? 0),
        }
      : { min: 0, max: 0, avg: 0, median: 0, p95: 0 };

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      data: {
        totalAzure,
        variationVsPrev: Math.round(variationVsPrev * 10) / 10,
        serviceCount: distinctServices.length,
        resourceGroupCount: distinctRGs.length,
        avgDailyCost: Math.round(avgDailyCost * 100) / 100,
        totalEntries,
        highestDayAmount: Math.round(highestDayAmount * 100) / 100,
        highestDayDate,
        byService,
        byResourceGroup,
        byMeterCategory,
        monthlyTrend,
        dailyTrend,
        serviceOverTime,
        serviceOverTimeKeys,
        topGrowing,
        topShrinking,
        costDistribution: {
          buckets: buckets.map((b) => ({ label: b.label, count: b.count })),
          stats,
        },
        topResources: topResources.map((r) => ({
          id: r.id,
          description: r.description,
          amount: Number(r.amount),
          date: r.date.toISOString(),
          serviceName: r.azureServiceName,
          resourceGroup: r.azureResourceGroup,
          meterCategory: r.azureMeterCategory,
          resourceId: r.azureResourceId,
        })),
      },
    });
  } catch (error) {
    console.error("Azure dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar dados do dashboard Azure" },
      { status: 500 }
    );
  }
}
