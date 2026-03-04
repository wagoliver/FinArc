import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET – MongoDB dashboard aggregations
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
      currentTotal,
      prevTotal,
      byClusterRaw,
      byProjectRaw,
      bySkuRaw,
      monthlyTrendRaw,
      prevByClusterRaw,
    ] = await Promise.all([
      // Total reference month
      prisma.costEntry.aggregate({
        where: {
          source: "MONGO_SYNC",
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
        },
        _sum: { amount: true },
      }),

      // Total comparison month
      prisma.costEntry.aggregate({
        where: {
          source: "MONGO_SYNC",
          date: { gte: comparisonMonthStart, lte: comparisonMonthEnd },
        },
        _sum: { amount: true },
      }),

      // By cluster (reference month)
      prisma.costEntry.groupBy({
        by: ["mongoClusterName"],
        where: {
          source: "MONGO_SYNC",
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
          mongoClusterName: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
        take: 15,
      }),

      // By project (reference month)
      prisma.costEntry.groupBy({
        by: ["mongoProjectName"],
        where: {
          source: "MONGO_SYNC",
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
          mongoProjectName: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),

      // By SKU (reference month)
      prisma.costEntry.groupBy({
        by: ["mongoSku"],
        where: {
          source: "MONGO_SYNC",
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
          mongoSku: { not: null },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),

      // Monthly trend (12 closed months)
      prisma.$queryRaw<{ month: Date; total: Prisma.Decimal }[]>`
        SELECT date_trunc('month', date) AS month, SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'MONGO_SYNC'
          AND date >= ${twelveMonthsAgo}
          AND date < ${currentMonthStart}
        GROUP BY date_trunc('month', date)
        ORDER BY month ASC
      `,

      // Comparison month by cluster
      prisma.costEntry.groupBy({
        by: ["mongoClusterName"],
        where: {
          source: "MONGO_SYNC",
          date: { gte: comparisonMonthStart, lte: comparisonMonthEnd },
          mongoClusterName: { not: null },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      }),
    ]);

    // -----------------------------------------------------------------------
    // KPIs
    // -----------------------------------------------------------------------
    const totalMongo = Number(currentTotal._sum.amount ?? 0);
    const totalPrev = Number(prevTotal._sum.amount ?? 0);
    const variationVsPrev =
      totalPrev > 0 ? ((totalMongo - totalPrev) / totalPrev) * 100 : 0;

    const byCluster = byClusterRaw.map((r) => ({
      name: r.mongoClusterName ?? "Desconhecido",
      total: Number(r._sum.amount ?? 0),
      count: r._count,
    }));

    const byProject = byProjectRaw.map((r) => ({
      name: r.mongoProjectName ?? "Desconhecido",
      total: Number(r._sum.amount ?? 0),
      count: r._count,
    }));

    const bySku = bySkuRaw.map((r) => ({
      name: r.mongoSku ?? "Desconhecido",
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

    // Most expensive cluster
    const topCluster = byCluster.length > 0 ? byCluster[0] : null;

    // -----------------------------------------------------------------------
    // Cluster over time (top 5 clusters across months – stacked bar)
    // -----------------------------------------------------------------------
    const clusterOverTimeRaw: { month: Date; cluster: string; total: Prisma.Decimal }[] =
      await prisma.$queryRaw`
        SELECT
          date_trunc('month', date) AS month,
          mongo_cluster_name AS cluster,
          SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'MONGO_SYNC'
          AND date >= ${twelveMonthsAgo}
          AND date < ${currentMonthStart}
          AND mongo_cluster_name IS NOT NULL
        GROUP BY date_trunc('month', date), mongo_cluster_name
        ORDER BY month ASC
      `;

    // Determine top 5 clusters by total
    const clusterAgg: Record<string, number> = {};
    for (const row of clusterOverTimeRaw) {
      clusterAgg[row.cluster] =
        (clusterAgg[row.cluster] || 0) + Number(row.total);
    }
    const top5Clusters = Object.entries(clusterAgg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const monthMap = new Map<string, Record<string, number>>();
    for (const row of clusterOverTimeRaw) {
      if (!top5Clusters.includes(row.cluster)) continue;
      const monthKey = new Date(row.month).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });
      if (!monthMap.has(monthKey))
        monthMap.set(monthKey, { month: monthKey } as unknown as Record<string, number>);
      const entry = monthMap.get(monthKey)!;
      entry[row.cluster] = Number(row.total);
    }
    const clusterOverTime = Array.from(monthMap.values());
    const clusterOverTimeKeys = top5Clusters;

    // -----------------------------------------------------------------------
    // Cluster comparison table: reference vs comparison month
    // -----------------------------------------------------------------------
    const prevClusterMap = new Map<string, number>();
    for (const r of prevByClusterRaw) {
      if (r.mongoClusterName) {
        prevClusterMap.set(
          r.mongoClusterName,
          Number(r._sum.amount ?? 0)
        );
      }
    }

    const clusterComparison = byCluster.map((c) => {
      const previous = prevClusterMap.get(c.name) ?? 0;
      const change = c.total - previous;
      const changePercent =
        previous > 0
          ? (change / previous) * 100
          : c.total > 0
            ? 100
            : 0;
      // Get project name from entries
      const projectEntry = byProjectRaw.find(
        (p) => p.mongoProjectName !== null
      );
      return {
        cluster: c.name,
        project: projectEntry?.mongoProjectName ?? "-",
        current: c.total,
        previous,
        change,
        changePercent,
      };
    });

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      data: {
        referenceMonth: referenceMonthStart.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        }),
        totalMongo,
        variationVsPrev: Math.round(variationVsPrev * 10) / 10,
        activeClusters: byCluster.length,
        topClusterName: topCluster?.name ?? "-",
        topClusterCost: topCluster?.total ?? 0,
        byCluster,
        byProject,
        bySku,
        monthlyTrend,
        clusterOverTime,
        clusterOverTimeKeys,
        clusterComparison,
      },
    });
  } catch (error) {
    console.error("Mongo dashboard error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao carregar dados do dashboard MongoDB",
      },
      { status: 500 }
    );
  }
}
