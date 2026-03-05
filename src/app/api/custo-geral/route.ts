import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET – Combined cloud costs dashboard (Azure + MongoDB)
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
      azureCurrent,
      azurePrev,
      mongoCurrent,
      mongoPrev,
      azureMonthlyRaw,
      mongoMonthlyRaw,
      topAzureServicesRaw,
      topMongoClustersRaw,
      byCategoryRaw,
    ] = await Promise.all([
      // Azure total – reference month
      prisma.costEntry.aggregate({
        where: {
          source: "AZURE_SYNC",
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
        },
        _sum: { amount: true },
      }),

      // Azure total – comparison month
      prisma.costEntry.aggregate({
        where: {
          source: "AZURE_SYNC",
          date: { gte: comparisonMonthStart, lte: comparisonMonthEnd },
        },
        _sum: { amount: true },
      }),

      // Mongo total – reference month
      prisma.costEntry.aggregate({
        where: {
          source: "MONGO_SYNC",
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
        },
        _sum: { amount: true },
      }),

      // Mongo total – comparison month
      prisma.costEntry.aggregate({
        where: {
          source: "MONGO_SYNC",
          date: { gte: comparisonMonthStart, lte: comparisonMonthEnd },
        },
        _sum: { amount: true },
      }),

      // Azure monthly trend (12 closed months)
      prisma.$queryRaw<{ month: Date; total: Prisma.Decimal }[]>`
        SELECT date_trunc('month', date) AS month, SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${twelveMonthsAgo}
          AND date < ${currentMonthStart}
        GROUP BY date_trunc('month', date)
        ORDER BY month ASC
      `,

      // Mongo monthly trend (12 closed months)
      prisma.$queryRaw<{ month: Date; total: Prisma.Decimal }[]>`
        SELECT date_trunc('month', date) AS month, SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'MONGO_SYNC'
          AND date >= ${twelveMonthsAgo}
          AND date < ${currentMonthStart}
        GROUP BY date_trunc('month', date)
        ORDER BY month ASC
      `,

      // Top 5 Azure services (reference month)
      prisma.costEntry.groupBy({
        by: ["azureServiceName"],
        where: {
          source: "AZURE_SYNC",
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
          azureServiceName: { not: null },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),

      // Top 5 Mongo clusters (reference month)
      prisma.costEntry.groupBy({
        by: ["mongoClusterName"],
        where: {
          source: "MONGO_SYNC",
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
          mongoClusterName: { not: null },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),

      // By category (both sources combined)
      prisma.costEntry.groupBy({
        by: ["categoryId"],
        where: {
          source: { in: ["AZURE_SYNC", "MONGO_SYNC"] },
          date: { gte: referenceMonthStart, lte: referenceMonthEnd },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      }),
    ]);

    // -----------------------------------------------------------------------
    // KPIs
    // -----------------------------------------------------------------------
    const totalAzure = Number(azureCurrent._sum.amount ?? 0);
    const totalMongo = Number(mongoCurrent._sum.amount ?? 0);
    const totalCloud = totalAzure + totalMongo;

    const prevAzure = Number(azurePrev._sum.amount ?? 0);
    const prevMongo = Number(mongoPrev._sum.amount ?? 0);
    const prevCloud = prevAzure + prevMongo;

    const variation = (prev: number, current: number) =>
      prev > 0 ? Math.round(((current - prev) / prev) * 1000) / 10 : 0;

    const variationCloud = variation(prevCloud, totalCloud);
    const variationAzure = variation(prevAzure, totalAzure);
    const variationMongo = variation(prevMongo, totalMongo);

    // -----------------------------------------------------------------------
    // Monthly trend – merge Azure + Mongo by month key
    // -----------------------------------------------------------------------
    const fmt = (d: Date) =>
      d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

    const trendMap = new Map<string, { month: string; azure: number; mongo: number; total: number }>();

    for (const r of azureMonthlyRaw) {
      const key = fmt(new Date(r.month));
      const entry = trendMap.get(key) ?? { month: key, azure: 0, mongo: 0, total: 0 };
      entry.azure = Number(r.total);
      entry.total = entry.azure + entry.mongo;
      trendMap.set(key, entry);
    }

    for (const r of mongoMonthlyRaw) {
      const key = fmt(new Date(r.month));
      const entry = trendMap.get(key) ?? { month: key, azure: 0, mongo: 0, total: 0 };
      entry.mongo = Number(r.total);
      entry.total = entry.azure + entry.mongo;
      trendMap.set(key, entry);
    }

    const monthlyTrend = Array.from(trendMap.values());

    // -----------------------------------------------------------------------
    // Top services / clusters
    // -----------------------------------------------------------------------
    const topAzureServices = topAzureServicesRaw.map((r) => ({
      name: r.azureServiceName ?? "Desconhecido",
      total: Number(r._sum.amount ?? 0),
    }));

    const topMongoClusters = topMongoClustersRaw.map((r) => ({
      name: r.mongoClusterName ?? "Desconhecido",
      total: Number(r._sum.amount ?? 0),
    }));

    // -----------------------------------------------------------------------
    // By category – resolve names
    // -----------------------------------------------------------------------
    const categoryIds = byCategoryRaw.map((r) => r.categoryId);
    const categories = categoryIds.length > 0
      ? await prisma.costCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, color: true },
        })
      : [];

    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const byCategory = byCategoryRaw.map((r) => {
      const cat = categoryMap.get(r.categoryId);
      return {
        category: cat?.name ?? "Outros",
        color: cat?.color ?? "#94A3B8",
        total: Number(r._sum.amount ?? 0),
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
        totalCloud,
        totalAzure,
        totalMongo,
        variationCloud,
        variationAzure,
        variationMongo,
        monthlyTrend,
        topAzureServices,
        topMongoClusters,
        byCategory,
      },
    });
  } catch (error) {
    console.error("Cloud costs dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar dados de custo geral" },
      { status: 500 }
    );
  }
}
